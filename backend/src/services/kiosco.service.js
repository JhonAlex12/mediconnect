import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { siguienteNumeroFisico } from './fila.service.js';
import { accionPaciente } from './turnos.service.js';
import { ZONA_HORARIA, ESTADOS_ACTIVOS, PRIORIDADES } from '../config/negocio.js';

// Pantalla de turnos de la entrada (kiosco): el paciente saca su turno o registra su llegada
// escribiendo su cédula. Usa una sesión propia que SOLO sirve para esto: aunque alguien
// manipule el equipo, no tiene acceso al panel de la farmacia.

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;
const DOCUMENTO = /^\d{5,20}$/;

// ---------- Sesión de la pantalla ----------

// Al "desactivar todas las pantallas" sube la versión y las sesiones anteriores dejan de servir
async function versionActual() {
  const { rows: [v] } = await pool.query(`SELECT valor FROM configuracion WHERE clave = 'version_kiosco'`);
  return v?.valor ?? 1;
}

export async function activarPantalla(empleado) {
  const token = jwt.sign({ tipo: 'kiosco', ver: await versionActual() }, process.env.JWT_SECRET, { expiresIn: '365d' });
  await registrarAcceso({ usuarioId: empleado.id, accion: 'activar_pantalla_turnos' });
  return token;
}

export async function desactivarPantallas(empleado) {
  await pool.query(
    `INSERT INTO configuracion (clave, valor, actualizado_por) VALUES ('version_kiosco', 2, $1)
     ON CONFLICT (clave) DO UPDATE SET valor = configuracion.valor + 1, actualizado_por = $1, actualizado_en = now()`,
    [empleado.id]
  );
  await registrarAcceso({ usuarioId: empleado.id, accion: 'desactivar_pantallas_turnos' });
}

export async function sesionValida(token) {
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    return datos.tipo === 'kiosco' && datos.ver === await versionActual();
  } catch {
    return false;
  }
}

// ---------- Impresión del tiquete ----------

// Se guardan como números en "configuracion": impresión 0 = no, 1 = con botón, 2 = automática; papel en mm
const IMPRESION = ['ninguna', 'boton', 'automatica'];
const PAPELES = [58, 80];

export async function leerAjustes() {
  const { rows } = await pool.query(
    `SELECT clave, valor FROM configuracion WHERE clave IN ('impresion_kiosco', 'papel_kiosco')`
  );
  const v = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
  return {
    impresion: IMPRESION[v.impresion_kiosco ?? 2] ?? 'automatica', // por defecto: automática
    papel: PAPELES.includes(v.papel_kiosco) ? v.papel_kiosco : 80,
  };
}

export async function guardarAjustes(empleado, { impresion, papel } = {}) {
  const i = IMPRESION.indexOf(impresion);
  if (i < 0) throw new ErrorNegocio('Opción de impresión no válida', 400);
  if (!PAPELES.includes(papel)) throw new ErrorNegocio('El papel debe ser de 58 u 80 mm', 400);
  await pool.query(
    `INSERT INTO configuracion (clave, valor, actualizado_por) VALUES ('impresion_kiosco', $1, $3), ('papel_kiosco', $2, $3)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
    [i, papel, empleado.id]
  );
  await registrarAcceso({ usuarioId: empleado.id, accion: 'ajustes_pantalla_turnos', detalle: `${impresion}, ${papel} mm` });
  return leerAjustes();
}

// ---------- Lo que hace el paciente ----------

function validarDocumento(documento) {
  const d = typeof documento === 'string' ? documento.trim() : '';
  if (!DOCUMENTO.test(d)) throw new ErrorNegocio('Escribe tu número de documento (solo números)', 400);
  return d;
}

const prioridadValida = (p = 'ninguna') => {
  if (!PRIORIDADES.includes(p)) throw new ErrorNegocio('Prioridad no válida', 400);
  return p;
};

// Turno activo del paciente y sus fórmulas vigentes con algo por entregar.
// No devuelve el nombre, el código ni los medicamentos: la pantalla está a la vista de todos.
export async function buscar(documento) {
  const doc = validarDocumento(documento);
  const { rows: [p] } = await pool.query('SELECT id FROM pacientes WHERE documento = $1', [doc]);
  if (!p) return { turno: null, formulas: [] };

  const [{ rows: [turno] }, { rows: formulas }] = await Promise.all([
    pool.query(
      `SELECT numero, estado FROM turnos WHERE paciente_id = $1 AND estado = ANY($2) ORDER BY id DESC LIMIT 1`,
      [p.id, ESTADOS_ACTIVOS]
    ),
    pool.query(
      `SELECT f.id, to_char(f.fecha_emision, 'YYYY-MM-DD') AS emitida, count(*)::int AS medicamentos
         FROM formulas f
         JOIN formula_items fi ON fi.formula_id = f.id
        WHERE f.paciente_id = $1 AND f.fecha_limite >= ${HOY}
        GROUP BY f.id
       HAVING sum(fi.cantidad_formulada - fi.cantidad_entregada) > 0
        ORDER BY f.fecha_emision DESC, f.id DESC`,
      [p.id]
    ),
  ]);
  return { turno: turno ?? null, formulas };
}

// Quien sacó turno virtual registra que ya está en la farmacia
export async function registrarLlegada(documento) {
  const doc = validarDocumento(documento);
  const { rows: [t] } = await pool.query(
    `SELECT t.id, t.numero, t.estado
       FROM turnos t JOIN pacientes p ON p.id = t.paciente_id
      WHERE p.documento = $1 AND t.estado = ANY($2)
      ORDER BY t.id DESC LIMIT 1`,
    [doc, ESTADOS_ACTIVOS]
  );
  if (!t) throw new ErrorNegocio('No tienes un turno activo', 404);
  if (['presente', 'llamado'].includes(t.estado)) {
    return { id: t.id, numero: t.numero, estado: t.estado, yaEstaba: true };
  }
  await accionPaciente(t.id, 'llegue');
  return { id: t.id, numero: t.numero, estado: 'presente', yaEstaba: false };
}

// Turno físico con una fórmula del paciente: entra directo a la fila como "presente"
export async function pedirTurno({ documento, formula_id: formulaId, prioridad }) {
  const doc = validarDocumento(documento);
  const prio = prioridadValida(prioridad);
  if (!Number.isInteger(formulaId)) throw new ErrorNegocio('Elige una fórmula', 400);

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [f] } = await cliente.query(
      `SELECT f.id, f.paciente_id
         FROM formulas f JOIN pacientes p ON p.id = f.paciente_id
        WHERE f.id = $1 AND p.documento = $2 AND f.fecha_limite >= ${HOY}
          AND EXISTS (SELECT 1 FROM formula_items fi
                       WHERE fi.formula_id = f.id AND fi.cantidad_entregada < fi.cantidad_formulada)
          FOR UPDATE OF p`,
      [formulaId, doc]
    );
    if (!f) throw new ErrorNegocio('Esa fórmula ya no tiene medicamentos por reclamar o está vencida', 404);

    const numero = await siguienteNumeroFisico(cliente);
    const { rows: [turno] } = await cliente.query(
      `INSERT INTO turnos (numero, fecha, tipo, prioridad, estado, paciente_id, formula_id, hora_llegada)
       VALUES ($1, ${HOY}, 'fisico', $2, 'presente', $3, $4, now())
       RETURNING id, numero, estado, prioridad`,
      [numero, prio, f.paciente_id, f.id]
    );
    await registrarAcceso({ pacienteId: f.paciente_id, accion: 'turno_pantalla_entrada', detalle: numero }, cliente);
    await cliente.query('COMMIT');
    return turno;
  } catch (error) {
    await cliente.query('ROLLBACK');
    if (error.code === '23505') throw new ErrorNegocio('Ya tienes un turno activo', 409);
    throw error;
  } finally {
    cliente.release();
  }
}

// Turno sin fórmula (preguntas, PQRS, otros trámites)
export async function otroTramite({ prioridad }) {
  const prio = prioridadValida(prioridad);
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const numero = await siguienteNumeroFisico(cliente);
    const { rows: [turno] } = await cliente.query(
      `INSERT INTO turnos (numero, fecha, tipo, prioridad, estado, nombre_visitante, hora_llegada)
       VALUES ($1, ${HOY}, 'fisico', $2, 'presente', 'Otro trámite', now())
       RETURNING id, numero, estado, prioridad`,
      [numero, prio]
    );
    await registrarAcceso({ accion: 'turno_pantalla_entrada', detalle: `${numero} (otro trámite)` }, cliente);
    await cliente.query('COMMIT');
    return turno;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
