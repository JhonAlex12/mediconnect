import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { ZONA_HORARIA, ESTADOS_ACTIVOS, PRIORIDADES } from '../config/negocio.js';

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;

// Orden de llamado: primero quienes tienen prioridad (RN-05), luego por lugar en la fila
const ORDEN_LLAMADO = `(t.prioridad <> 'ninguna') DESC, t.orden ASC`;

// Notificación al paciente, solo si el turno tiene un paciente registrado (RN-14)
async function notificar(cliente, pacienteId, tipo, mensaje) {
  if (!pacienteId) return;
  await cliente.query(
    `INSERT INTO notificaciones (paciente_id, tipo, mensaje) VALUES ($1, $2, $3)`,
    [pacienteId, tipo, mensaje]
  );
}

// ============================================================
// VER LA FILA DEL DÍA
// ============================================================
export async function verFila() {
  const { rows } = await pool.query(
    `SELECT t.id, t.numero, t.tipo, t.prioridad, t.estado, t.veces_pausado,
            t.hora_toma, t.hora_llegada, t.hora_llamado,
            COALESCE(p.nombre, t.nombre_visitante) AS paciente,
            f.codigo AS formula
       FROM turnos t
       LEFT JOIN pacientes p ON p.id = t.paciente_id
       LEFT JOIN formulas f ON f.id = t.formula_id
      WHERE t.fecha = ${HOY} AND t.estado = ANY($1)
      ORDER BY CASE t.estado
                 WHEN 'llamado'   THEN 0
                 WHEN 'presente'  THEN 1
                 WHEN 'en_camino' THEN 2
                 WHEN 'reservado' THEN 3
                 ELSE 4
               END,
               ${ORDEN_LLAMADO}`,
    [ESTADOS_ACTIVOS]
  );

  return {
    turno_actual: rows.find((t) => t.estado === 'llamado')?.numero ?? null,
    presentes: rows.filter((t) => t.estado === 'presente').length,
    fila: rows,
  };
}

// ============================================================
// REGISTRAR TURNO FÍSICO (RN-17): en segundos y en la misma fila
// Se puede vincular a una fórmula (código + documento) o solo con un nombre
// ============================================================
export async function registrarFisico({ nombre, codigo, documento, prioridad = 'ninguna' }, empleado) {
  if (!PRIORIDADES.includes(prioridad)) {
    throw new ErrorNegocio('Prioridad no válida', 400);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    let pacienteId = null;
    let formulaId = null;

    if (codigo || documento) {
      if (!codigo || !documento) {
        throw new ErrorNegocio('Para vincular la fórmula ingresa el código y el documento', 400);
      }
      const { rows: [f] } = await cliente.query(
        `SELECT f.id AS formula_id, p.id AS paciente_id
           FROM formulas f JOIN pacientes p ON p.id = f.paciente_id
          WHERE f.codigo = $1 AND p.documento = $2`,
        [String(codigo).trim().toUpperCase(), String(documento).trim()]
      );
      if (!f) throw new ErrorNegocio('Código o documento incorrectos', 404);
      pacienteId = f.paciente_id;
      formulaId = f.formula_id;
    } else if (typeof nombre !== 'string' || nombre.trim().length < 2) {
      throw new ErrorNegocio('Ingresa el nombre del paciente o los datos de su fórmula', 400);
    }

    // Misma numeración que los turnos virtuales: es una sola fila
    await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('mediconect_numeracion_turnos'))`);
    const { rows: [sig] } = await cliente.query(
      `SELECT COALESCE(MAX(substring(numero FROM 3)::int), 0) + 1 AS n
         FROM turnos WHERE fecha = ${HOY}`
    );
    const numero = `F-${String(sig.n).padStart(3, '0')}`;

    // Quien toma turno físico ya está en la farmacia: entra como "presente"
    const { rows: [turno] } = await cliente.query(
      `INSERT INTO turnos (numero, fecha, tipo, prioridad, estado, paciente_id, formula_id,
                           registrado_por, nombre_visitante, hora_llegada)
       VALUES ($1, ${HOY}, 'fisico', $2, 'presente', $3, $4, $5, $6, now())
       RETURNING id, numero, estado, prioridad`,
      [numero, prioridad, pacienteId, formulaId, empleado.id, nombre?.trim() || null]
    );

    await registrarAcceso(
      { usuarioId: empleado.id, pacienteId, accion: 'registrar_turno_fisico', detalle: numero },
      cliente
    );

    await cliente.query('COMMIT');
    return turno;
  } catch (error) {
    await cliente.query('ROLLBACK');
    if (error.code === '23505') {
      throw new ErrorNegocio('Este paciente ya tiene un turno activo', 409);
    }
    throw error;
  } finally {
    cliente.release();
  }
}

// ============================================================
// LLAMAR SIGUIENTE (RF-21)
// ============================================================
export async function llamarSiguiente(empleado) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // Evita que dos empleados llamen al mismo tiempo y crucen turnos
    await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('mediconect_llamado'))`);

    const { rows: [actual] } = await cliente.query(
      `SELECT numero FROM turnos WHERE fecha = ${HOY} AND estado = 'llamado'`
    );
    if (actual) {
      throw new ErrorNegocio(
        `Primero marca como atendido o pausa el turno ${actual.numero}`,
        409
      );
    }

    // El primer turno presente según prioridad y lugar en la fila (RN-05, RN-06)
    const { rows: [siguiente] } = await cliente.query(
      `SELECT t.id FROM turnos t
        WHERE t.fecha = ${HOY} AND t.estado = 'presente'
        ORDER BY ${ORDEN_LLAMADO}
        LIMIT 1
          FOR UPDATE`
    );
    if (!siguiente) {
      throw new ErrorNegocio('No hay pacientes presentes en la fila', 404);
    }

    const { rows: [turno] } = await cliente.query(
      `UPDATE turnos SET estado = 'llamado', hora_llamado = now()
        WHERE id = $1
        RETURNING id, numero, estado, prioridad, paciente_id`,
      [siguiente.id]
    );

    await notificar(cliente, turno.paciente_id, 'llamado',
      `Es tu turno ${turno.numero}. Acércate a la ventanilla.`);
    await registrarAcceso(
      { usuarioId: empleado.id, pacienteId: turno.paciente_id, accion: 'llamar_turno', detalle: turno.numero },
      cliente
    );

    await cliente.query('COMMIT');
    const { paciente_id, ...publico } = turno;
    return publico;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// ============================================================
// PAUSAR, REUBICAR, SALTAR Y ATENDER (RF-22)
// ============================================================
const ACCIONES = {
  pausar:   ['llamado', 'presente'],
  reubicar: ['en_pausa'],
  saltar:   ['llamado', 'presente'],
  atender:  ['llamado', 'presente'],
};

export async function accionFila(turnoId, accion, empleado) {
  const permitidos = ACCIONES[accion];
  if (!permitidos) throw new ErrorNegocio('Acción no válida', 400);

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { rows: [t] } = await cliente.query(
      `SELECT id, numero, estado, paciente_id FROM turnos WHERE id = $1 FOR UPDATE`,
      [turnoId]
    );
    if (!t) throw new ErrorNegocio('Turno no encontrado', 404);
    if (!permitidos.includes(t.estado)) {
      throw new ErrorNegocio(`No se puede ${accion} un turno en estado "${t.estado}"`, 409);
    }

    switch (accion) {
      case 'pausar':
        // El paciente no apareció: sale de la fila efectiva hasta que vuelva
        await cliente.query(
          `UPDATE turnos SET estado = 'en_pausa', veces_pausado = veces_pausado + 1 WHERE id = $1`,
          [t.id]
        );
        await notificar(cliente, t.paciente_id, 'turno_pausado',
          `Tu turno ${t.numero} está en pausa. Si estás en la farmacia, acércate a la fila.`);
        break;

      case 'reubicar':
        // Conserva su "orden" original: queda en el siguiente hueco, no al final (RN-08)
        await cliente.query(
          `UPDATE turnos SET estado = 'presente', hora_llegada = now() WHERE id = $1`,
          [t.id]
        );
        break;

      case 'saltar':
        // Vuelve a la fila de presentes, pero al final
        await cliente.query(
          `UPDATE turnos SET estado = 'presente', orden = now() WHERE id = $1`,
          [t.id]
        );
        break;

      case 'atender':
        await cliente.query(`UPDATE turnos SET estado = 'atendido' WHERE id = $1`, [t.id]);
        // Lo que quedó apartado y no se usó vuelve al inventario
        await cliente.query(
          `UPDATE reservas SET liberada = TRUE WHERE turno_id = $1 AND liberada = FALSE`,
          [t.id]
        );
        // Asistió: se reinician sus faltas seguidas (RN-11)
        if (t.paciente_id) {
          await cliente.query(`UPDATE pacientes SET faltas_seguidas = 0 WHERE id = $1`, [t.paciente_id]);
        }
        break;
    }

    await registrarAcceso(
      { usuarioId: empleado.id, pacienteId: t.paciente_id, accion: `${accion}_turno`, detalle: t.numero },
      cliente
    );

    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }

  return verFila();
}