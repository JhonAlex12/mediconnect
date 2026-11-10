import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { CIUDADES_DOMICILIO, HORAS_ENLACE_CORREO } from '../config/negocio.js';
import { ErrorNegocio } from './formulas.service.js';
import { consultarFormula } from './disponibilidad.service.js';
import { despacharDomicilio, devolverDespacho, entregarDomicilio } from './entregaDomicilio.service.js';
import { URL_SITIO, correoConfirmacion, correoRestablecer, enviarCorreo } from './correo.service.js';

// Cuentas de pacientes: registro, ingreso, datos personales, fórmulas y domicilios

export const TIPOS_DOCUMENTO = ['CC', 'TI', 'CE', 'PPT', 'PA', 'RC'];
const REGIMENES = ['contributivo', 'subsidiado'];
const SEXOS = ['F', 'M', 'O'];
const ESTADOS_DOMICILIO_ACTIVOS = ['recibido', 'en_preparacion', 'en_camino'];

const HASH_RELLENO = await bcrypt.hash('relleno-sin-uso', 10);

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const opcional = (v) => texto(v) || null;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Datos personales que se pueden editar (sin documento ni contraseña)
function validarDatosPersonales(d, errores) {
  const nombres = texto(d.nombres);
  const apellidos = texto(d.apellidos);
  if (nombres.length < 2 || nombres.length > 80) errores.push('Nombres: obligatorio');
  if (apellidos.length < 2 || apellidos.length > 80) errores.push('Apellidos: obligatorio');

  const nacimiento = texto(d.fecha_nacimiento);
  const hoy = new Date().toISOString().slice(0, 10);
  if (!FECHA.test(nacimiento) || Number.isNaN(Date.parse(nacimiento)) || nacimiento > hoy || nacimiento < '1900-01-01') {
    errores.push('Fecha de nacimiento: no es válida');
  }

  const sexo = opcional(d.sexo);
  if (sexo && !SEXOS.includes(sexo)) errores.push('Sexo: opción no válida');

  const celular = texto(d.celular).replace(/\s/g, '');
  if (!/^3\d{9}$/.test(celular)) errores.push('Celular: 10 dígitos y empieza por 3');

  const correo = texto(d.correo).toLowerCase();
  if (!CORREO.test(correo) || correo.length > 120) errores.push('Correo: no es válido');

  const direccion = texto(d.direccion);
  if (direccion.length < 5 || direccion.length > 150) errores.push('Dirección: obligatoria');
  const ciudad = texto(d.ciudad);
  if (ciudad.length < 2 || ciudad.length > 80) errores.push('Ciudad: obligatoria');
  const barrio = opcional(d.barrio);
  if (barrio && barrio.length > 80) errores.push('Barrio: máximo 80 caracteres');

  const eps = opcional(d.eps);
  if (eps && eps.length > 80) errores.push('EPS: máximo 80 caracteres');
  const regimen = opcional(d.regimen);
  if (regimen && !REGIMENES.includes(regimen)) errores.push('Régimen: opción no válida');

  return {
    nombres, apellidos, fecha_nacimiento: nacimiento, sexo, celular, correo,
    direccion, barrio, ciudad, eps, regimen,
  };
}

function validarClave(clave, errores) {
  if (typeof clave !== 'string' || clave.length < 8 || clave.length > 72) {
    errores.push('Contraseña: entre 8 y 72 caracteres');
  } else if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
    errores.push('Contraseña: debe tener letras y números');
  }
}

const COLUMNAS_PERFIL = `id, tipo_documento, documento, nombres, apellidos,
  to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, sexo, celular, correo,
  direccion, barrio, ciudad, eps, regimen, creado_en,
  (correo_verificado_en IS NOT NULL) AS correo_verificado`;

// "San José de Cúcuta", "cucuta" → "cucuta": compara ciudades sin tildes ni mayúsculas
const normalizar = (v) => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
export function ciudadConDomicilio(ciudad) {
  const n = normalizar(ciudad).replace(/^san jose de /, '');
  return CIUDADES_DOMICILIO.find((c) => normalizar(c) === n) ?? null;
}

// ---------- Confirmación del correo ----------

const hashToken = (t) => createHash('sha256').update(t).digest('hex');

// Genera un enlace nuevo (invalida el anterior) y lo envía al correo de la cuenta
async function enviarConfirmacion(cuentaId) {
  const token = randomBytes(32).toString('hex');
  const { rows: [c] } = await pool.query(
    `UPDATE cuentas_pacientes
        SET token_correo_hash = $2, token_correo_vence = now() + make_interval(hours => $3)
      WHERE id = $1 AND correo_verificado_en IS NULL
      RETURNING nombres, correo`,
    [cuentaId, hashToken(token), HORAS_ENLACE_CORREO]
  );
  if (!c) return false; // ya estaba confirmado
  const enlace = `${URL_SITIO}/confirmar-correo?token=${token}`;
  const { asunto, texto: cuerpo, html } = correoConfirmacion({
    nombre: c.nombres.split(' ')[0], enlace, horas: HORAS_ENLACE_CORREO,
  });
  try {
    await enviarCorreo({ para: c.correo, asunto, texto: cuerpo, html });
  } catch (error) {
    // La cuenta queda creada; el paciente puede pedir el reenvío desde "Mi cuenta"
    console.error('No se pudo enviar el correo de confirmación:', error.message);
    return false;
  }
  return true;
}

export async function reenviarConfirmacion(cuentaId) {
  const enviado = await enviarConfirmacion(cuentaId);
  if (!enviado) {
    const c = await verCuenta(cuentaId);
    if (c.correo_verificado) throw new ErrorNegocio('Tu correo ya está confirmado', 409);
    throw new ErrorNegocio('No pudimos enviar el correo. Intenta más tarde.', 502);
  }
  await registrarActividad(cuentaId, 'reenviar_confirmacion');
}

// ---------- Recuperar la contraseña ----------

const MINUTOS_ENLACE_CLAVE = 60;

// Siempre responde igual, exista o no la cuenta: así no se puede averiguar quién está registrado
export async function solicitarRestablecer(identificador) {
  const id = texto(identificador);
  if (!id) throw new ErrorNegocio('Escribe tu documento o tu correo', 400);

  const token = randomBytes(32).toString('hex');
  const { rows: [c] } = await pool.query(
    `UPDATE cuentas_pacientes
        SET token_clave_hash = $2, token_clave_vence = now() + make_interval(mins => $3)
      WHERE (documento = upper($1) OR correo = lower($1)) AND activa
      RETURNING id, nombres, correo`,
    [id, hashToken(token), MINUTOS_ENLACE_CLAVE]
  );
  if (c) {
    const { asunto, texto: cuerpo, html } = correoRestablecer({
      nombre: c.nombres.split(' ')[0],
      enlace: `${URL_SITIO}/restablecer-clave?token=${token}`,
      minutos: MINUTOS_ENLACE_CLAVE,
    });
    // Sin "await": la respuesta no espera el envío, así tarda lo mismo exista o no la cuenta
    enviarCorreo({ para: c.correo, asunto, texto: cuerpo, html })
      .then(() => registrarActividad(c.id, 'pedir_cambio_clave'))
      .catch((error) => console.error('No se pudo enviar el correo para restablecer la contraseña:', error.message));
  }
}

// Público: se abre desde el enlace del correo
export async function restablecerClave(token, clave) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new ErrorNegocio('El enlace no es válido', 400);
  }
  const errores = [];
  validarClave(clave, errores);
  if (errores.length) throw new ErrorNegocio('Revisa la contraseña', 400, errores);

  const { rows: [c] } = await pool.query(
    `UPDATE cuentas_pacientes
        SET clave_hash = $2, token_clave_hash = NULL, token_clave_vence = NULL
      WHERE token_clave_hash = $1 AND token_clave_vence > now() AND activa
      RETURNING id`,
    [hashToken(token), await bcrypt.hash(clave, 10)]
  );
  if (!c) throw new ErrorNegocio('El enlace venció o ya se usó. Pide uno nuevo desde "¿Olvidaste tu contraseña?".', 410);
  await registrarActividad(c.id, 'restablecer_clave');
}

// Público (sin sesión): se abre desde el enlace del correo
export async function confirmarCorreo(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new ErrorNegocio('El enlace no es válido', 400);
  }
  const { rows: [c] } = await pool.query(
    `UPDATE cuentas_pacientes
        SET correo_verificado_en = now(), token_correo_hash = NULL, token_correo_vence = NULL
      WHERE token_correo_hash = $1 AND token_correo_vence > now()
      RETURNING id, correo`,
    [hashToken(token)]
  );
  if (!c) throw new ErrorNegocio('El enlace venció o ya se usó. Pide uno nuevo desde "Mi cuenta".', 410);
  await registrarActividad(c.id, 'confirmar_correo', c.correo);
  return { correo: c.correo };
}

const firmar = (cuenta) =>
  jwt.sign({ tipo: 'paciente_cuenta', id: cuenta.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

export async function registrarCuenta(d = {}) {
  const errores = [];
  const tipo = texto(d.tipo_documento);
  if (!TIPOS_DOCUMENTO.includes(tipo)) errores.push('Tipo de documento: opción no válida');
  const documento = texto(d.documento);
  if (!/^[0-9A-Za-z]{5,20}$/.test(documento)) errores.push('Documento: entre 5 y 20 caracteres, sin puntos ni espacios');
  const datos = validarDatosPersonales(d, errores);
  validarClave(d.clave, errores);
  if (d.acepta_datos !== true) errores.push('Debes aceptar el tratamiento de datos personales');

  if (errores.length) throw new ErrorNegocio('Revisa los datos del formulario', 400, errores);

  const claveHash = await bcrypt.hash(d.clave, 10);
  try {
    const { rows: [cuenta] } = await pool.query(
      `INSERT INTO cuentas_pacientes
         (tipo_documento, documento, nombres, apellidos, fecha_nacimiento, sexo, celular, correo,
          direccion, barrio, ciudad, eps, regimen, clave_hash, consentimiento_en, ultimo_ingreso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now(), now())
       RETURNING ${COLUMNAS_PERFIL}`,
      [tipo, documento.toUpperCase(), datos.nombres, datos.apellidos, datos.fecha_nacimiento, datos.sexo,
        datos.celular, datos.correo, datos.direccion, datos.barrio, datos.ciudad, datos.eps, datos.regimen, claveHash]
    );
    await registrarActividad(cuenta.id, 'crear_cuenta');
    const correoEnviado = await enviarConfirmacion(cuenta.id);
    return { token: firmar(cuenta), cuenta, correo_enviado: correoEnviado };
  } catch (error) {
    if (error.code === '23505') {
      const campo = error.constraint?.includes('correo') ? 'correo' : 'documento';
      throw new ErrorNegocio(`Ya existe una cuenta con ese ${campo}. Inicia sesión.`, 409);
    }
    throw error;
  }
}

// Ingreso con documento (o correo) y contraseña
export async function iniciarSesionCuenta(identificador, clave) {
  const id = texto(identificador);
  if (!id || typeof clave !== 'string' || !clave) {
    throw new ErrorNegocio('Ingresa tu documento y contraseña', 400);
  }
  const { rows: [c] } = await pool.query(
    `SELECT id, clave_hash, activa FROM cuentas_pacientes
      WHERE documento = upper($1) OR correo = lower($1)`,
    [id]
  );
  const coincide = await bcrypt.compare(clave, c?.clave_hash ?? HASH_RELLENO);
  if (!c || !c.activa || !coincide) {
    throw new ErrorNegocio('Documento o contraseña incorrectos', 401);
  }
  await pool.query('UPDATE cuentas_pacientes SET ultimo_ingreso = now() WHERE id = $1', [c.id]);
  await registrarActividad(c.id, 'iniciar_sesion');
  return { token: firmar(c), cuenta: await verCuenta(c.id) };
}

export async function verCuenta(id) {
  const { rows: [c] } = await pool.query(
    `SELECT ${COLUMNAS_PERFIL} FROM cuentas_pacientes WHERE id = $1 AND activa`,
    [id]
  );
  if (!c) throw new ErrorNegocio('La cuenta no existe o está desactivada', 401);
  return c;
}

export async function actualizarCuenta(id, d = {}) {
  const errores = [];
  const datos = validarDatosPersonales(d, errores);
  const cambiaClave = Boolean(d.clave_nueva);
  if (cambiaClave) validarClave(d.clave_nueva, errores);
  if (errores.length) throw new ErrorNegocio('Revisa los datos del formulario', 400, errores);

  if (cambiaClave) {
    const { rows: [c] } = await pool.query('SELECT clave_hash FROM cuentas_pacientes WHERE id = $1', [id]);
    if (!(await bcrypt.compare(String(d.clave_actual ?? ''), c.clave_hash))) {
      throw new ErrorNegocio('La contraseña actual no es correcta', 400);
    }
  }

  // Si cambia el correo, hay que confirmarlo de nuevo
  const { rows: [antes] } = await pool.query('SELECT correo FROM cuentas_pacientes WHERE id = $1', [id]);
  const cambiaCorreo = antes.correo !== datos.correo;

  try {
    await pool.query(
      `UPDATE cuentas_pacientes
          SET ${cambiaCorreo ? 'correo_verificado_en = NULL,' : ''} nombres=$2, apellidos=$3, fecha_nacimiento=$4, sexo=$5, celular=$6, correo=$7,
              direccion=$8, barrio=$9, ciudad=$10, eps=$11, regimen=$12
              ${cambiaClave ? ', clave_hash = $13' : ''}
        WHERE id = $1`,
      [id, datos.nombres, datos.apellidos, datos.fecha_nacimiento, datos.sexo, datos.celular, datos.correo,
        datos.direccion, datos.barrio, datos.ciudad, datos.eps, datos.regimen,
        ...(cambiaClave ? [await bcrypt.hash(d.clave_nueva, 10)] : [])]
    );
  } catch (error) {
    if (error.code === '23505') throw new ErrorNegocio('Ese correo ya lo usa otra cuenta', 409);
    throw error;
  }
  await registrarActividad(id, cambiaClave ? 'cambiar_datos_y_clave' : 'cambiar_datos');
  if (cambiaCorreo) {
    await registrarActividad(id, 'cambiar_correo', datos.correo);
    await enviarConfirmacion(id);
  }
  return verCuenta(id);
}

// ---------- Fórmulas de la cuenta ----------

// Agrega una fórmula: el código debe pertenecer al documento de la cuenta
export async function agregarFormula(cuentaId, codigo) {
  const cuenta = await verCuenta(cuentaId);
  const formula = await consultarFormula(texto(codigo), cuenta.documento); // valida código + documento
  await pool.query(
    `INSERT INTO cuenta_formulas (cuenta_id, formula_id)
     SELECT $1, id FROM formulas WHERE codigo = $2
     ON CONFLICT DO NOTHING`,
    [cuentaId, formula.codigo]
  );
  await registrarActividad(cuentaId, 'agregar_formula', formula.codigo);
  return formula;
}

// Fórmulas de la cuenta con disponibilidad, cobro y su domicilio (si tiene)
export async function listarFormulas(cuentaId) {
  const cuenta = await verCuenta(cuentaId);
  const { rows } = await pool.query(
    `SELECT f.codigo FROM cuenta_formulas cf JOIN formulas f ON f.id = cf.formula_id
      WHERE cf.cuenta_id = $1 ORDER BY f.fecha_emision DESC, f.id DESC`,
    [cuentaId]
  );
  return Promise.all(rows.map((r) => consultarFormula(r.codigo, cuenta.documento)));
}

// ---------- Domicilios ----------

// ---------- Costo de envío ----------

export async function costoEnvio() {
  const { rows: [c] } = await pool.query(`SELECT valor FROM configuracion WHERE clave = 'costo_envio_domicilio'`);
  return c?.valor ?? 0;
}

export async function guardarCostoEnvio(empleadoId, valor) {
  if (!Number.isInteger(valor) || valor < 0 || valor > 1000000) {
    throw new ErrorNegocio('El costo de envío debe ser un valor entre $0 y $1.000.000', 400);
  }
  await pool.query(
    `INSERT INTO configuracion (clave, valor, actualizado_por) VALUES ('costo_envio_domicilio', $1, $2)
     ON CONFLICT (clave) DO UPDATE SET valor = $1, actualizado_por = $2, actualizado_en = now()`,
    [valor, empleadoId]
  );
  await pool.query(
    `INSERT INTO registro_accesos (usuario_id, accion, detalle) VALUES ($1, 'costo_envio', $2)`,
    [empleadoId, String(valor)]
  );
  return valor;
}

const COLUMNAS_DOMICILIO = `d.id, f.codigo, d.direccion, d.barrio, d.ciudad, d.telefono, d.recibe,
  d.indicaciones, d.estado, d.costo_envio, f.cuota_moderadora,
  (SELECT json_build_object('cuota', cd.cuota, 'envio', cd.envio, 'total', cd.cuota + cd.envio,
     'medio', cd.medio, 'recibido', cd.recibido, 'referencia', cd.referencia, 'fecha', cd.fecha)
   FROM cobros_domicilio cd WHERE cd.domicilio_id = d.id) AS cobro,
  EXISTS (SELECT 1 FROM pagos pg WHERE pg.formula_id = f.id) AS cuota_pagada, d.nota_farmacia, d.creado_en, d.actualizado_en`;

export async function listarDomicilios(cuentaId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_DOMICILIO}
       FROM domicilios d JOIN formulas f ON f.id = d.formula_id
      WHERE d.cuenta_id = $1 ORDER BY d.creado_en DESC`,
    [cuentaId]
  );
  return rows;
}

export async function solicitarDomicilio(cuentaId, d = {}) {
  const cuenta = await verCuenta(cuentaId);
  const errores = [];
  const direccion = texto(d.direccion);
  if (direccion.length < 5 || direccion.length > 150) errores.push('Dirección: obligatoria');
  if (!cuenta.correo_verificado) {
    throw new ErrorNegocio('Confirma tu correo antes de pedir un domicilio. Revisa tu bandeja de entrada.', 403);
  }
  const ciudad = ciudadConDomicilio(d.ciudad);
  if (!ciudad) errores.push(`Por ahora solo hacemos domicilios en ${CIUDADES_DOMICILIO.join(', ')}`);
  const barrio = opcional(d.barrio);
  if (!barrio || barrio.length > 80) errores.push('Barrio: obligatorio para ubicar la entrega');
  const telefono = texto(d.telefono).replace(/\s/g, '');
  if (!/^\d{7,10}$/.test(telefono)) errores.push('Teléfono: entre 7 y 10 dígitos');
  const recibe = opcional(d.recibe);
  if (recibe && recibe.length > 120) errores.push('Quién recibe: máximo 120 caracteres');
  const indicaciones = opcional(d.indicaciones);
  if (indicaciones && indicaciones.length > 300) errores.push('Indicaciones: máximo 300 caracteres');
  if (errores.length) throw new ErrorNegocio('Revisa los datos del domicilio', 400, errores);

  // La fórmula debe estar en la cuenta
  const { rows: [vinculo] } = await pool.query(
    `SELECT f.id, f.codigo FROM cuenta_formulas cf JOIN formulas f ON f.id = cf.formula_id
      WHERE cf.cuenta_id = $1 AND f.codigo = $2`,
    [cuentaId, texto(d.codigo).toUpperCase()]
  );
  if (!vinculo) throw new ErrorNegocio('Primero agrega esa fórmula a tu cuenta', 404);

  const formula = await consultarFormula(vinculo.codigo, cuenta.documento);
  if (formula.vencida) throw new ErrorNegocio('La fórmula está vencida: ya no se puede reclamar', 409);
  const pendientes = formula.medicamentos.filter((m) => m.cantidad_pendiente > 0);
  if (pendientes.length === 0) throw new ErrorNegocio('Esta fórmula ya fue entregada completa', 409);
  if (pendientes.every((m) => m.estado === 'agotado')) {
    throw new ErrorNegocio('Los medicamentos pendientes están agotados. Te avisaremos cuando lleguen.', 409);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT id FROM formulas WHERE id = $1 FOR UPDATE', [vinculo.id]);
    const { rows: [pendiente] } = await cliente.query(
      `SELECT COUNT(*)::int AS cantidad FROM formula_items
        WHERE formula_id = $1 AND cantidad_entregada < cantidad_formulada`, [vinculo.id]);
    if (!pendiente.cantidad) throw new ErrorNegocio('Esta fórmula ya fue entregada completa', 409);
    const { rows: [nuevo] } = await cliente.query(
      `INSERT INTO domicilios (cuenta_id, formula_id, direccion, barrio, ciudad, telefono, recibe, indicaciones, costo_envio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, costo_envio`,
      [cuentaId, vinculo.id, direccion, barrio, ciudad, telefono, recibe, indicaciones, await costoEnvio()]
    );
    await cliente.query(
      `INSERT INTO registro_accesos (cuenta_id, accion, detalle) VALUES ($1, 'cuenta:solicitar_domicilio', $2)`,
      [cuentaId, vinculo.codigo]);
    await cliente.query('COMMIT');
    return nuevo;
  } catch (error) {
    await cliente.query('ROLLBACK');
    if (error.code === '23505') throw new ErrorNegocio('Ya hay un domicilio en curso para esa fórmula', 409);
    throw error;
  } finally {
    cliente.release();
  }
}

export async function cancelarDomicilio(cuentaId, id) {
  const { rowCount } = await pool.query(
    `UPDATE domicilios SET estado = 'cancelado', actualizado_en = now()
      WHERE id = $1 AND cuenta_id = $2 AND estado = 'recibido'`,
    [id, cuentaId]
  );
  if (!rowCount) {
    throw new ErrorNegocio('Solo se puede cancelar mientras la farmacia no lo haya empezado a preparar', 409);
  }
  await registrarActividad(cuentaId, 'cancelar_domicilio', String(id));
}

// ---------- Historial de la cuenta ----------

// Se guarda en registro_accesos (el mismo registro de auditoría del sistema)
async function registrarActividad(cuentaId, accion, detalle = null) {
  await pool.query(
    `INSERT INTO registro_accesos (cuenta_id, accion, detalle) VALUES ($1, $2, $3)`,
    [cuentaId, `cuenta:${accion}`, detalle]
  );
}

export async function historial(cuentaId) {
  const { rows } = await pool.query(
    `SELECT substr(accion, 8) AS accion, detalle, fecha
       FROM registro_accesos
      WHERE cuenta_id = $1 AND accion LIKE 'cuenta:%'
      ORDER BY fecha DESC LIMIT 50`,
    [cuentaId]
  );
  return rows;
}

// ---------- Panel de la farmacia ----------

export async function domiciliosFarmacia({ estado } = {}) {
  const filtro = estado === 'activos' || !estado
    ? `d.estado = ANY($1)`
    : `d.estado = $1`;
  const valor = estado === 'activos' || !estado ? ESTADOS_DOMICILIO_ACTIVOS : estado;
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_DOMICILIO},
            c.tipo_documento, c.documento, c.nombres || ' ' || c.apellidos AS paciente, c.celular,
            -- Lo que falta por entregar en la fórmula y cuánto hay libre para despacharlo
            (SELECT json_agg(json_build_object(
                      'formula_item_id', fi.id, 'nombre', m.nombre, 'presentacion', m.presentacion,
                      'pendiente', fi.cantidad_formulada - fi.cantidad_entregada,
                      'disponible', GREATEST(0, m.stock_actual - COALESCE((
                         SELECT SUM(r.cantidad) FROM reservas r
                          WHERE r.medicamento_id = m.id AND NOT r.liberada AND r.vence_en > now()), 0))::int
                    ) ORDER BY fi.id)
               FROM formula_items fi JOIN medicamentos m ON m.id = fi.medicamento_id
              WHERE fi.formula_id = f.id AND fi.cantidad_formulada > fi.cantidad_entregada) AS medicamentos,
            -- Lo que salió con este domicilio y, al cerrarlo, cuánto se entregó
            (SELECT json_agg(json_build_object(
                      'formula_item_id', di.formula_item_id, 'nombre', m.nombre, 'presentacion', m.presentacion,
                      'despachada', di.despachada, 'entregada', di.entregada) ORDER BY di.formula_item_id)
               FROM domicilio_items di
               JOIN formula_items fi ON fi.id = di.formula_item_id
               JOIN medicamentos m ON m.id = fi.medicamento_id
              WHERE di.domicilio_id = d.id) AS despacho
       FROM domicilios d
       JOIN formulas f ON f.id = d.formula_id
       JOIN cuentas_pacientes c ON c.id = d.cuenta_id
      WHERE ${filtro}
      ORDER BY d.creado_en
      LIMIT 200`,
    [valor]
  );
  return rows;
}

const SIGUIENTE = {
  recibido: ['en_preparacion', 'cancelado'],
  en_preparacion: ['en_camino', 'cancelado'],
  en_camino: ['entregado', 'cancelado'],
};

export async function cambiarEstadoDomicilio(empleadoId, id, { estado, nota, items, pago } = {}) {
  const notaLimpia = opcional(nota);
  if (notaLimpia && notaLimpia.length > 300) throw new ErrorNegocio('La nota admite máximo 300 caracteres', 400);

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    let resultado = { turnosAvisados: [] };
    const { rows: [d] } = await cliente.query(
      `SELECT d.id, d.estado, d.formula_id, d.costo_envio, c.documento FROM domicilios d JOIN cuentas_pacientes c ON c.id = d.cuenta_id
        WHERE d.id = $1 FOR UPDATE OF d`,
      [id]
    );
    if (!d) throw new ErrorNegocio('El domicilio no existe', 404);
    if (!SIGUIENTE[d.estado]?.includes(estado)) {
      throw new ErrorNegocio(`No se puede pasar de "${d.estado}" a "${estado}"`, 409);
    }
    // El stock baja al despachar; al entregar o cancelar, lo que no llegó al paciente vuelve al inventario
    if (estado === 'en_camino') resultado = await despacharDomicilio(cliente, d, items, empleadoId);
    else if (estado === 'entregado') resultado = await entregarDomicilio(cliente, d, items, pago, empleadoId);
    else if (estado === 'cancelado' && d.estado === 'en_camino') resultado = await devolverDespacho(cliente, d, empleadoId);
    await cliente.query(
      `UPDATE domicilios
          SET estado = $2, nota_farmacia = COALESCE($3, nota_farmacia),
              actualizado_por = $4, actualizado_en = now()
        WHERE id = $1`,
      [id, estado, notaLimpia, empleadoId]
    );
    await cliente.query(
      `INSERT INTO registro_accesos (usuario_id, accion, detalle) VALUES ($1, 'domicilio_estado', $2)`,
      [empleadoId, `${id}: ${d.estado} → ${estado}`]
    );
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
