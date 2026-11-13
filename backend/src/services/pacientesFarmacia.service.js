import { pool } from '../db/pool.js';
import { ZONA_HORARIA } from '../config/negocio.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { enviarConfirmacion, solicitarRestablecer } from './cuentas.service.js';

// Pacientes en el panel de la farmacia.
// - Administrador: lista completa, ficha y acciones sobre la cuenta (nunca ve ni cambia la contraseña,
//   ni los datos personales: esos los corrige el paciente en "Mi cuenta").
// - Auxiliar: solo abre la ficha de un documento exacto (para atenderlo en caja), con menos datos.
// Cada ficha abierta y cada acción quedan en registro_accesos (Ley 1581).

const POR_PAGINA = 25;
const FILTROS = ['todos', 'con_cuenta', 'sin_cuenta', 'con_pendientes', 'cuenta_inactiva'];

// Quita tildes y mayúsculas en SQL, para que "maria" encuentre a "María"
const sinTildes = (col) => `lower(translate(${col}, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))`;
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DOCUMENTO = /^[0-9A-Za-z]{4,20}$/;

// Un paciente puede existir solo en "pacientes" (tiene fórmulas, sin cuenta), solo en
// "cuentas_pacientes" (se registró pero aún no tiene fórmulas) o en ambas: se unen por documento.
const BASE = `
  FROM pacientes p
  FULL JOIN cuentas_pacientes c ON c.documento = p.documento`;

// Fórmulas con algo por entregar y todavía vigentes
const PENDIENTES = `(
  SELECT count(*) FROM formulas f
   WHERE f.paciente_id = p.id
     AND f.fecha_limite >= (now() AT TIME ZONE '${ZONA_HORARIA}')::date
     AND EXISTS (SELECT 1 FROM formula_items fi
                  WHERE fi.formula_id = f.id AND fi.cantidad_entregada < fi.cantidad_formulada))::int`;

export async function listarPacientes({ q = '', filtro = 'todos', pagina = 1 } = {}) {
  const texto = typeof q === 'string' ? normalizar(q.trim()).slice(0, 80) : '';
  const tipo = FILTROS.includes(filtro) ? filtro : 'todos';
  const pag = Math.max(1, Number.parseInt(pagina, 10) || 1);

  const condiciones = [];
  const valores = [];
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    valores.push(`%${palabra}%`);
    const n = `$${valores.length}`;
    condiciones.push(`(
      COALESCE(p.documento, c.documento) ILIKE ${n}
      OR ${sinTildes(`COALESCE(p.nombre, '') || ' ' || COALESCE(c.nombres || ' ' || c.apellidos, '')`)} LIKE ${n}
      OR COALESCE(c.celular, '') LIKE ${n} OR COALESCE(p.telefono, '') LIKE ${n}
      OR COALESCE(c.correo, '') ILIKE ${n})`);
  }
  if (tipo === 'con_cuenta') condiciones.push('c.id IS NOT NULL');
  if (tipo === 'sin_cuenta') condiciones.push('c.id IS NULL');
  if (tipo === 'cuenta_inactiva') condiciones.push('c.id IS NOT NULL AND NOT c.activa');
  if (tipo === 'con_pendientes') condiciones.push(`p.id IS NOT NULL AND ${PENDIENTES} > 0`);
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows: [{ total }] } = await pool.query(`SELECT count(*)::int AS total ${BASE} ${where}`, valores);
  const { rows } = await pool.query(
    `SELECT COALESCE(p.documento, c.documento) AS documento,
            COALESCE(c.nombres || ' ' || c.apellidos, p.nombre) AS nombre,
            COALESCE(c.celular, p.telefono) AS celular,
            COALESCE(p.regimen, c.regimen) AS regimen, p.rango_ingreso, COALESCE(p.eps, c.eps) AS eps,
            c.id IS NOT NULL AS tiene_cuenta, c.activa AS cuenta_activa,
            c.correo_verificado_en IS NOT NULL AS correo_verificado,
            CASE WHEN p.id IS NULL THEN 0 ELSE ${PENDIENTES} END AS pendientes,
            (SELECT max(f.fecha_emision) FROM formulas f WHERE f.paciente_id = p.id) AS ultima_formula
       ${BASE} ${where}
      ORDER BY ultima_formula DESC NULLS LAST, nombre
      LIMIT ${POR_PAGINA} OFFSET ${(pag - 1) * POR_PAGINA}`,
    valores
  );
  return { pacientes: rows, total, pagina: pag, por_pagina: POR_PAGINA };
}

// "maria.rojas@correo.com" → "ma•••@correo.com" (lo que ve el auxiliar)
const ocultarCorreo = (correo) => {
  const [usuario, dominio] = correo.split('@');
  return `${usuario.slice(0, 2)}•••@${dominio}`;
};

export async function fichaPaciente(documento, empleado) {
  const doc = typeof documento === 'string' ? documento.trim().toUpperCase() : '';
  if (!DOCUMENTO.test(doc)) throw new ErrorNegocio('Escriba un número de documento válido', 400);
  const esAdmin = empleado.rol === 'administrador';

  const { rows: [p] } = await pool.query(
    `SELECT id, documento, nombre, telefono, regimen, rango_ingreso, eps, faltas_seguidas, consentimiento_en, creado_en
       FROM pacientes WHERE documento = $1`,
    [doc]
  );
  const { rows: [c] } = await pool.query(
    `SELECT id, tipo_documento, nombres, apellidos, to_char(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
            sexo, celular, correo, direccion, barrio, ciudad, eps, regimen, activa, ultimo_ingreso, creado_en,
            correo_verificado_en IS NOT NULL AS correo_verificado
       FROM cuentas_pacientes WHERE documento = $1`,
    [doc]
  );
  if (!p && !c) throw new ErrorNegocio('No hay ningún paciente con ese documento', 404);

  const formulas = p ? (await pool.query(
    `SELECT f.id, f.codigo, f.fecha_emision, f.fecha_limite, f.origen, f.regimen, f.exencion, f.cuota_moderadora,
            f.indicaciones,
            f.fecha_limite < (now() AT TIME ZONE $2)::date AS vencida,
            pg.valor AS pago_valor, pg.medio AS pago_medio, pg.fecha AS pago_fecha,
            COALESCE(json_agg(json_build_object(
              'nombre', m.nombre, 'presentacion', m.presentacion,
              'formulada', fi.cantidad_formulada, 'entregada', fi.cantidad_entregada
            ) ORDER BY fi.id) FILTER (WHERE fi.id IS NOT NULL), '[]') AS items
       FROM formulas f
       LEFT JOIN formula_items fi ON fi.formula_id = f.id
       LEFT JOIN medicamentos m ON m.id = fi.medicamento_id
       LEFT JOIN pagos pg ON pg.formula_id = f.id
      WHERE f.paciente_id = $1
      GROUP BY f.id, pg.id
      ORDER BY f.fecha_emision DESC, f.id DESC
      LIMIT 30`,
    [p.id, ZONA_HORARIA]
  )).rows.map((f) => {
    const formulado = f.items.reduce((s, i) => s + i.formulada, 0);
    const entregado = f.items.reduce((s, i) => s + i.entregada, 0);
    const estado = entregado >= formulado && formulado > 0 ? 'entregada'
      : f.vencida ? 'vencida'
      : entregado > 0 ? 'parcial' : 'pendiente';
    return { ...f, estado };
  }) : [];

  const turnos = p ? (await pool.query(
    `SELECT t.numero, t.fecha, t.tipo, t.estado, t.caja, f.codigo AS formula
       FROM turnos t LEFT JOIN formulas f ON f.id = t.formula_id
      WHERE t.paciente_id = $1
      ORDER BY t.fecha DESC, t.hora_toma DESC LIMIT 10`,
    [p.id]
  )).rows : [];

  const domicilios = c ? (await pool.query(
    `SELECT d.id, d.estado, d.creado_en, d.barrio, f.codigo AS formula
       FROM domicilios d JOIN formulas f ON f.id = d.formula_id
      WHERE d.cuenta_id = $1
      ORDER BY d.creado_en DESC LIMIT 10`,
    [c.id]
  )).rows : [];

  await registrarAcceso({
    usuarioId: empleado.id, pacienteId: p?.id ?? null, accion: 'ver_paciente', detalle: doc,
  });

  // El auxiliar ve lo necesario para atender: sin dirección, nacimiento ni correo completo
  const cuenta = !c ? null : esAdmin ? c : {
    activa: c.activa, correo: ocultarCorreo(c.correo), correo_verificado: c.correo_verificado,
    celular: c.celular, creado_en: c.creado_en,
  };

  return {
    documento: doc,
    nombre: c ? `${c.nombres} ${c.apellidos}` : p.nombre,
    celular: c?.celular ?? p?.telefono ?? null,
    afiliacion: {
      regimen: p?.regimen ?? c?.regimen ?? null,
      rango_ingreso: p?.rango_ingreso ?? null,
      eps: p?.eps ?? c?.eps ?? null,
    },
    faltas_seguidas: p?.faltas_seguidas ?? 0,
    consentimiento_en: p?.consentimiento_en ?? null,
    registrado_en: p?.creado_en ?? c?.creado_en,
    cuenta,
    formulas,
    turnos,
    domicilios,
  };
}

// ---------- Acciones del administrador sobre la cuenta ----------

async function cuentaDe(documento) {
  const doc = typeof documento === 'string' ? documento.trim().toUpperCase() : '';
  const { rows: [c] } = await pool.query(
    `SELECT c.id, c.documento, c.correo, c.activa, c.correo_verificado_en IS NOT NULL AS correo_verificado,
            p.id AS paciente_id
       FROM cuentas_pacientes c LEFT JOIN pacientes p ON p.documento = c.documento
      WHERE c.documento = $1`,
    [doc]
  );
  if (!c) throw new ErrorNegocio('Este paciente no tiene cuenta', 404);
  return c;
}

// Queda en el registro del sistema (quién lo hizo) y, si se indica, en el historial que ve el paciente
async function registrarAccionCuenta(c, empleado, accion, { enHistorialPaciente = true } = {}) {
  await pool.query(
    `INSERT INTO registro_accesos (usuario_id, paciente_id, cuenta_id, accion, detalle)
     VALUES ($1, $2, $3, $4, $5)`,
    [empleado.id, c.paciente_id, c.id, accion, c.documento]
  );
  if (enHistorialPaciente) {
    await pool.query(
      `INSERT INTO registro_accesos (cuenta_id, accion) VALUES ($1, $2)`,
      [c.id, `cuenta:farmacia_${accion}`]
    );
  }
}

export async function reenviarConfirmacionCuenta(documento, empleado) {
  const c = await cuentaDe(documento);
  if (!c.activa) throw new ErrorNegocio('La cuenta está desactivada. Actívela primero.', 409);
  if (c.correo_verificado) throw new ErrorNegocio('El correo de esta cuenta ya está confirmado', 409);
  if (!(await enviarConfirmacion(c.id))) {
    throw new ErrorNegocio('No se pudo enviar el correo. Intente más tarde.', 502);
  }
  await registrarAccionCuenta(c, empleado, 'reenviar_confirmacion');
  return { correo: c.correo };
}

export async function enviarCambioClave(documento, empleado) {
  const c = await cuentaDe(documento);
  if (!c.activa) throw new ErrorNegocio('La cuenta está desactivada. Actívela primero.', 409);
  // El historial del paciente lo escribe solicitarRestablecer cuando el correo sale
  await solicitarRestablecer(c.documento, 'farmacia_enviar_cambio_clave');
  await registrarAccionCuenta(c, empleado, 'enviar_cambio_clave', { enHistorialPaciente: false });
  return { correo: c.correo };
}

export async function cambiarEstadoCuenta(documento, activa, empleado) {
  if (typeof activa !== 'boolean') throw new ErrorNegocio('activa: debe ser verdadero o falso', 400);
  const c = await cuentaDe(documento);
  await pool.query('UPDATE cuentas_pacientes SET activa = $2 WHERE id = $1', [c.id, activa]);
  await registrarAccionCuenta(c, empleado, activa ? 'activar_cuenta' : 'desactivar_cuenta');
  return { activa };
}
