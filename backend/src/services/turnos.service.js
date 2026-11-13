import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { calcularEstado } from './disponibilidad.service.js';
import {
  ZONA_HORARIA, HORAS_RESERVA, MINUTOS_RETRASO, MINUTOS_POR_TURNO,
  FALTAS_CONFIRMACION, FALTAS_LIMITE_DIARIO, ESTADOS_ACTIVOS, PRIORIDADES,
} from '../config/negocio.js';

// "Hoy" según la hora de Colombia, calculado por PostgreSQL
const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;

// ============================================================
// TOMAR TURNO VIRTUAL
// ============================================================
export async function tomarTurno({ codigo, documento, confirmar, prioridad = 'ninguna' }) {
  if (typeof codigo !== 'string' || typeof documento !== 'string') {
    throw new ErrorNegocio('Ingresa el código de la fórmula y tu documento', 400);
  }
  if (!PRIORIDADES.includes(prioridad)) {
    throw new ErrorNegocio('Prioridad no válida', 400);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // 1. Fórmula y paciente. FOR UPDATE bloquea al paciente: si pide turno
    //    dos veces al mismo tiempo, la segunda petición espera a la primera.
    const { rows: [f] } = await cliente.query(
      `SELECT f.id AS formula_id, f.codigo, p.id AS paciente_id, p.nombre, p.faltas_seguidas,
              (f.fecha_limite - ${HOY}) AS dias_restantes
         FROM formulas f
         JOIN pacientes p ON p.id = f.paciente_id
        WHERE f.codigo = $1 AND p.documento = $2
          FOR UPDATE OF p`,
      [codigo.trim().toUpperCase(), documento.trim()]
    );
    if (!f) throw new ErrorNegocio('Código o documento incorrectos', 404);
    if (f.dias_restantes < 0) {
      throw new ErrorNegocio('La fórmula superó su fecha límite de reclamo', 400);
    }

    // 2. Un solo turno activo por paciente (RF-10)
    const { rows: [activo] } = await cliente.query(
      `SELECT numero FROM turnos WHERE paciente_id = $1 AND estado = ANY($2)`,
      [f.paciente_id, ESTADOS_ACTIVOS]
    );
    if (activo) {
      throw new ErrorNegocio(`Ya tienes un turno activo (${activo.numero})`, 409);
    }

    // 3. Medidas suaves por faltas seguidas (RN-11): nunca hay bloqueo permanente
    if (f.faltas_seguidas >= FALTAS_LIMITE_DIARIO) {
      const { rows: [hoy] } = await cliente.query(
        `SELECT COUNT(*)::int AS total FROM turnos
          WHERE paciente_id = $1 AND tipo = 'virtual' AND fecha = ${HOY}`,
        [f.paciente_id]
      );
      if (hoy.total > 0) {
        throw new ErrorNegocio(
          'Por hoy solo puedes tomar un turno virtual. Puedes acercarte y pedir turno en la farmacia.',
          429
        );
      }
    }

    // 4. Medicamentos con algo pendiente. FOR UPDATE bloquea esas filas:
    //    nadie más puede reservarlos hasta que esta transacción termine.
    const { rows: items } = await cliente.query(
      `SELECT m.id AS medicamento_id, m.nombre, m.stock_actual, m.stock_minimo,
              (fi.cantidad_formulada - fi.cantidad_entregada) AS pendiente
         FROM formula_items fi
         JOIN medicamentos m ON m.id = fi.medicamento_id
        WHERE fi.formula_id = $1 AND fi.cantidad_entregada < fi.cantidad_formulada
        ORDER BY m.id
          FOR UPDATE OF m`,
      [f.formula_id]
    );
    if (items.length === 0) {
      throw new ErrorNegocio('Ya se entregaron todos los medicamentos de esta fórmula', 400);
    }

    // Lo que ya tienen apartado otros turnos (RN-02)
    const { rows: apartados } = await cliente.query(
      `SELECT medicamento_id, SUM(cantidad)::int AS total
         FROM reservas
        WHERE medicamento_id = ANY($1) AND liberada = FALSE AND vence_en > now()
        GROUP BY medicamento_id`,
      [items.map((i) => i.medicamento_id)]
    );
    const reservadoPor = new Map(apartados.map((a) => [a.medicamento_id, a.total]));

    // 5. Estado de cada medicamento y avisos
    const avisos = [];
    for (const i of items) {
      i.reservadoOtros = reservadoPor.get(i.medicamento_id) ?? 0;
      i.estado = calcularEstado({
        pendiente: i.pendiente,
        stockActual: i.stock_actual,
        reservadoOtros: i.reservadoOtros,
      });
      if (i.estado === 'agotado') avisos.push(`${i.nombre}: agotado`);
      if (i.estado === 'pocas_unidades') avisos.push(`${i.nombre}: pocas unidades, puede que no alcance`);
    }
    if (f.faltas_seguidas >= FALTAS_CONFIRMACION) {
      avisos.push('Has faltado a tus últimos turnos. Confirma que podrás asistir.');
    }

    // Si hay avisos y el paciente aún no confirmó, no se crea nada:
    // se le muestran los avisos y decide si continúa (diagrama de secuencia, pasos 9-13)
    if (avisos.length > 0 && !confirmar) {
      await cliente.query('ROLLBACK');
      return { requiere_confirmacion: true, avisos };
    }

    // 6. Número de turno del día. El bloqueo evita que dos turnos
    //    reciban el mismo número. La numeración es una sola para la fila
    //    única (V-009, F-010, V-011...), como en el wireframe del panel.
    await cliente.query(`SELECT pg_advisory_xact_lock(hashtext('mediconect_numeracion_turnos'))`);
    const { rows: [sig] } = await cliente.query(
      `SELECT COALESCE(MAX(substring(numero FROM 3)::int), 0) + 1 AS n
         FROM turnos WHERE fecha = ${HOY}`
    );
    const numero = `V-${String(sig.n).padStart(3, '0')}`;

    // 7. Crear el turno en estado "reservado"
    const { rows: [turno] } = await cliente.query(
      `INSERT INTO turnos (numero, fecha, tipo, prioridad, estado, paciente_id, formula_id, hora_vencimiento)
       VALUES ($1, ${HOY}, 'virtual', $2, 'reservado', $3, $4, now() + make_interval(hours => $5))
       RETURNING id, numero, estado, prioridad, hora_toma, hora_vencimiento`,
      [numero, prioridad, f.paciente_id, f.formula_id, HORAS_RESERVA]
    );

    // 8. Apartar los medicamentos (RN-12): lo pendiente, o lo que quede libre
    for (const i of items) {
      const libre = Math.max(0, i.stock_actual - i.reservadoOtros);
      const cantidad = Math.min(i.pendiente, libre);
      if (cantidad > 0) {
        await cliente.query(
          `INSERT INTO reservas (turno_id, medicamento_id, cantidad, vence_en)
           VALUES ($1, $2, $3, $4)`,
          [turno.id, i.medicamento_id, cantidad, turno.hora_vencimiento]
        );
      }
    }

    // 9. Una notificación por el cambio importante (RN-14)
    await cliente.query(
      `INSERT INTO notificaciones (paciente_id, tipo, mensaje) VALUES ($1, 'turno_confirmado', $2)`,
      [f.paciente_id, `Tu turno ${numero} fue confirmado.`]
    );

    await cliente.query('COMMIT');

    // Token de turno: lo guarda el celular para usar los botones del turno
    const token = jwt.sign(
      { tipo: 'paciente_turno', turno_id: turno.id, paciente_id: f.paciente_id },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    return { requiere_confirmacion: false, avisos, token, turno: await obtenerMiTurno(turno.id) };
  } catch (error) {
    await cliente.query('ROLLBACK');
    // Respaldo: el índice único de la base de datos también impide un segundo turno activo
    if (error.code === '23505') {
      throw new ErrorNegocio('Ya tienes un turno activo', 409);
    }
    throw error;
  } finally {
    cliente.release();
  }
}

// ============================================================
// CONSULTAR MI TURNO: estado, posición y tiempo estimado (RF-12)
// ============================================================
export async function obtenerMiTurno(turnoId) {
  // LEFT JOIN: los turnos físicos pueden no tener fórmula vinculada
  const { rows: [t] } = await pool.query(
    `SELECT t.id, t.numero, t.estado, t.prioridad, t.fecha, t.hora_toma,
            t.hora_vencimiento, t.retraso_usado, t.caja, f.codigo AS formula, f.fecha_limite,
            CASE WHEN EXISTS (SELECT 1 FROM pagos pg WHERE pg.formula_id = f.id) THEN 0
                 ELSE COALESCE(f.cuota_moderadora, 0) END AS valor_a_pagar
       FROM turnos t
       LEFT JOIN formulas f ON f.id = t.formula_id
      WHERE t.id = $1`,
    [turnoId]
  );
  if (!t) throw new ErrorNegocio('Turno no encontrado', 404);

  // Turno que se está llamando ahora mismo
  const { rows: [actual] } = await pool.query(
    `SELECT numero FROM turnos
      WHERE fecha = $1 AND estado = 'llamado'
      ORDER BY hora_llamado DESC LIMIT 1`,
    [t.fecha]
  );

  // Posición aproximada: turnos activos del día tomados antes que el mío.
  // Se afinará con la prioridad y la fila efectiva en el paso de la fila.
  let posicion = null;
  let minutosEstimados = null;
  if (['reservado', 'en_camino', 'presente'].includes(t.estado)) {
    const { rows: [delante] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM turnos
        WHERE fecha = $1 AND hora_toma < $2
          AND estado IN ('reservado', 'en_camino', 'presente')`,
      [t.fecha, t.hora_toma]
    );
    posicion = delante.total + 1;
    minutosEstimados = delante.total * MINUTOS_POR_TURNO;
  }

  return {
    id: t.id,
    numero: t.numero,
    estado: t.estado,
    prioridad: t.prioridad,
    formula: t.formula,
    reclamar_hasta: t.fecha_limite,
    caja: t.estado === 'llamado' ? t.caja : null,
    valor_a_pagar: t.valor_a_pagar,
    vence_turno: t.hora_vencimiento,
    retraso_disponible: !t.retraso_usado && ['reservado', 'en_camino'].includes(t.estado),
    turno_actual: actual?.numero ?? null,
    posicion,
    minutos_estimados: minutosEstimados,
  };
}

// ============================================================
// BOTONES DEL PACIENTE: Voy en camino, Ya llegué, Voy retrasado, Cancelar
// ============================================================

// Desde qué estados se permite cada botón (diagrama de estados del turno)
const TRANSICIONES = {
  'en-camino': { desde: ['reservado'], hacia: 'en_camino' },
  'llegue':    { desde: ['reservado', 'en_camino', 'en_pausa'], hacia: 'presente' },
  'cancelar':  { desde: ESTADOS_ACTIVOS, hacia: 'cancelado' },
};

export async function accionPaciente(turnoId, accion) {
  if (accion !== 'retrasado' && !TRANSICIONES[accion]) {
    throw new ErrorNegocio('Acción no válida', 400);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // Bloquea el turno mientras se cambia
    const { rows: [t] } = await cliente.query(
      `SELECT id, estado, retraso_usado FROM turnos WHERE id = $1 FOR UPDATE`,
      [turnoId]
    );
    if (!t) throw new ErrorNegocio('Turno no encontrado', 404);

    if (accion === 'retrasado') {
      // RN-13: 20 minutos más, una sola vez, y solo antes de llegar
      if (!['reservado', 'en_camino'].includes(t.estado)) {
        throw new ErrorNegocio('Solo puedes avisar retraso antes de llegar a la farmacia', 409);
      }
      if (t.retraso_usado) {
        throw new ErrorNegocio('Ya usaste el aviso de retraso para este turno', 409);
      }
      await cliente.query(
        `UPDATE turnos
            SET retraso_usado = TRUE,
                hora_vencimiento = hora_vencimiento + make_interval(mins => $2)
          WHERE id = $1`,
        [turnoId, MINUTOS_RETRASO]
      );
      // La reserva de medicamentos se extiende igual que el turno
      await cliente.query(
        `UPDATE reservas SET vence_en = vence_en + make_interval(mins => $2)
          WHERE turno_id = $1 AND liberada = FALSE`,
        [turnoId, MINUTOS_RETRASO]
      );
    } else {
      const regla = TRANSICIONES[accion];
      if (!regla.desde.includes(t.estado)) {
        throw new ErrorNegocio(`No se puede hacer esto con el turno en estado "${t.estado}"`, 409);
      }
      const llega = regla.hacia === 'presente';
      await cliente.query(
        `UPDATE turnos
            SET estado = $2,
                hora_llegada = CASE WHEN $3 THEN now() ELSE hora_llegada END
          WHERE id = $1`,
        [turnoId, regla.hacia, llega]
      );
      // Al cancelar, lo apartado vuelve al inventario (RN-12)
      if (regla.hacia === 'cancelado') {
        await cliente.query(
          `UPDATE reservas SET liberada = TRUE WHERE turno_id = $1 AND liberada = FALSE`,
          [turnoId]
        );
      }
    }

    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }

  return obtenerMiTurno(turnoId);
}

// ============================================================
// NOTIFICACIONES DEL PACIENTE (CU-04)
// ============================================================

// Devuelve las últimas 50 notificaciones del paciente dueño del turno
export async function listarNotificaciones(turnoId) {
  const { rows } = await pool.query(
    `SELECT n.id, n.tipo, n.mensaje, n.leida, n.fecha
       FROM notificaciones n
       JOIN turnos t ON t.paciente_id = n.paciente_id
      WHERE t.id = $1
      ORDER BY n.fecha DESC
      LIMIT 50`,
    [turnoId]
  );
  return rows;
}

// Marca como leídas todas las notificaciones pendientes de ese paciente
export async function marcarLeidas(turnoId) {
  await pool.query(
    `UPDATE notificaciones n
        SET leida = TRUE
       FROM turnos t
      WHERE t.id = $1 AND n.paciente_id = t.paciente_id AND n.leida = FALSE`,
    [turnoId]
  );
}