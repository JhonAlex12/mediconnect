import cron from 'node-cron';
import { pool } from '../db/pool.js';
import { publicarCambios } from '../services/tiempoReal.service.js';
import { limpiarSinRespuesta } from '../services/bot.service.js';
import {
  ZONA_HORARIA, MINUTOS_GRACIA, MINUTOS_VENCE_PAUSA, CRON_MANTENIMIENTO,
} from '../config/negocio.js';

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;

// Evita que una ejecución empiece si la anterior no ha terminado
let enEjecucion = false;

async function notificar(cliente, pacienteId, tipo, mensaje) {
  if (!pacienteId) return;
  await cliente.query(
    `INSERT INTO notificaciones (paciente_id, tipo, mensaje) VALUES ($1, $2, $3)`,
    [pacienteId, tipo, mensaje]
  );
}

export async function ejecutarMantenimiento() {
  if (enEjecucion) return;
  enEjecucion = true;

  let cambiados = [];
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // 1. Llamados sin respuesta en el tiempo de gracia → en pausa (RN-07)
    const { rows: pausados } = await cliente.query(
      `UPDATE turnos
          SET estado = 'en_pausa', veces_pausado = veces_pausado + 1
        WHERE estado = 'llamado'
          AND hora_llamado < now() - make_interval(mins => $1)
        RETURNING id, numero, paciente_id`,
      [MINUTOS_GRACIA]
    );
    for (const t of pausados) {
      await notificar(cliente, t.paciente_id, 'turno_pausado',
        `Tu turno ${t.numero} está en pausa porque no te presentaste. Si estás en la farmacia, acércate a la fila.`);
    }

    // 2. Turnos que vencen por no presentarse → cuentan como falta (RN-09)
    const { rows: vencidosConFalta } = await cliente.query(
      `UPDATE turnos
          SET estado = 'vencido'
        WHERE (estado IN ('reservado', 'en_camino') AND hora_vencimiento < now())
           OR (estado = 'en_pausa'
               AND COALESCE(hora_llamado, hora_llegada, hora_toma) < now() - make_interval(mins => $1))
           OR (estado IN ('reservado', 'en_camino', 'en_pausa') AND fecha < ${HOY})
        RETURNING id, numero, paciente_id`,
      [MINUTOS_VENCE_PAUSA]
    );

    // 3. Cierre del día: quien estaba presente no tiene la culpa → sin falta
    const { rows: cerrados } = await cliente.query(
      `UPDATE turnos SET estado = 'vencido'
        WHERE estado IN ('presente', 'llamado') AND fecha < ${HOY}
        RETURNING id`
    );

    // Lo apartado por los turnos vencidos vuelve al inventario
    const idsVencidos = [...vencidosConFalta, ...cerrados].map((t) => t.id);
    if (idsVencidos.length > 0) {
      await cliente.query(
        `UPDATE reservas SET liberada = TRUE WHERE turno_id = ANY($1) AND liberada = FALSE`,
        [idsVencidos]
      );
    }

    // Registra la falta (no-show) para las medidas suaves de RN-11
    const pacientesConFalta = vencidosConFalta.map((t) => t.paciente_id).filter(Boolean);
    if (pacientesConFalta.length > 0) {
      await cliente.query(
        `UPDATE pacientes SET faltas_seguidas = faltas_seguidas + 1 WHERE id = ANY($1)`,
        [pacientesConFalta]
      );
    }
    for (const t of vencidosConFalta) {
      await notificar(cliente, t.paciente_id, 'turno_vencido',
        `Tu turno ${t.numero} venció. Tu fórmula sigue vigente: puedes tomar un turno nuevo.`);
    }

    // 4. Reservas cuyo tiempo terminó (RN-12)
    await cliente.query(
      `UPDATE reservas SET liberada = TRUE WHERE liberada = FALSE AND vence_en < now()`
    );

    await cliente.query('COMMIT');

    cambiados = [...pausados, ...vencidosConFalta, ...cerrados].map((t) => t.id);
    if (cambiados.length > 0) {
      console.log(
        `[tareas] pausados: ${pausados.length}, vencidos: ${vencidosConFalta.length}, cierre: ${cerrados.length}`
      );
    }
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('[tareas] error:', error.message);
  } finally {
    cliente.release();
    enEjecucion = false;
  }

  if (cambiados.length > 0) publicarCambios(cambiados);
}

export function iniciarTareas() {
  cron.schedule(CRON_MANTENIMIENTO, ejecutarMantenimiento);
  // Cada madrugada: borra las preguntas del bot sin respuesta de hace más de 60 días
  cron.schedule('15 3 * * *', () => limpiarSinRespuesta().catch((e) => console.error('[tareas] bot:', e.message)));
  console.log('Tareas automáticas activas');
}