import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { ZONA_HORARIA, FALTAS_CONFIRMACION } from '../config/negocio.js';

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Cada reporte recibe el rango [$1, $2] y devuelve filas
const REPORTES = {
  // Demanda no atendida: lo que falta por entregar en fórmulas vigentes
  faltantes: `
    SELECT m.nombre, m.presentacion, m.stock_actual,
           SUM(fi.cantidad_formulada - fi.cantidad_entregada)::int AS cantidad_pendiente,
           COUNT(DISTINCT fi.formula_id)::int AS formulas_afectadas
      FROM formula_items fi
      JOIN formulas f ON f.id = fi.formula_id
      JOIN medicamentos m ON m.id = fi.medicamento_id
     WHERE fi.cantidad_entregada < fi.cantidad_formulada
       AND f.fecha_limite >= ${HOY}
       AND f.fecha_emision BETWEEN $1 AND $2
     GROUP BY m.id
     ORDER BY cantidad_pendiente DESC`,

  // Espera en la farmacia: desde que llegó hasta que lo llamaron
  espera: `
    SELECT t.tipo,
           COUNT(*)::int AS atendidos,
           ROUND(AVG(GREATEST(0, EXTRACT(EPOCH FROM (t.hora_llamado - t.hora_llegada)) / 60))::numeric, 1)::float
             AS minutos_promedio,
           ROUND(MAX(GREATEST(0, EXTRACT(EPOCH FROM (t.hora_llamado - t.hora_llegada)) / 60))::numeric, 1)::float
             AS minutos_maximo
      FROM turnos t
     WHERE t.estado = 'atendido'
       AND t.hora_llegada IS NOT NULL AND t.hora_llamado IS NOT NULL
       AND t.fecha BETWEEN $1 AND $2
     GROUP BY t.tipo
     ORDER BY t.tipo`,

  // Turnos tomados por hora del día (hora de Colombia)
  'horas-pico': `
    SELECT EXTRACT(HOUR FROM t.hora_toma AT TIME ZONE '${ZONA_HORARIA}')::int AS hora,
           COUNT(*)::int AS turnos
      FROM turnos t
     WHERE t.fecha BETWEEN $1 AND $2
     GROUP BY 1
     ORDER BY 1`,

  // Resultado de los turnos por día. "No presentado" = venció sin llegar o tras ser pausado
  faltas: `
    SELECT t.fecha,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE t.estado = 'atendido')::int AS atendidos,
           COUNT(*) FILTER (WHERE t.estado = 'cancelado')::int AS cancelados,
           COUNT(*) FILTER (WHERE t.estado = 'vencido'
                              AND (t.hora_llegada IS NULL OR t.veces_pausado > 0))::int AS no_presentados
      FROM turnos t
     WHERE t.fecha BETWEEN $1 AND $2
     GROUP BY t.fecha
     ORDER BY t.fecha`,
};

export async function generarReporte(tipo, { desde, hasta } = {}, empleado) {
  const sql = REPORTES[tipo];
  if (!sql) {
    throw new ErrorNegocio(`Reporte no válido. Opciones: ${Object.keys(REPORTES).join(', ')}`, 400);
  }
  for (const [nombre, valor] of [['desde', desde], ['hasta', hasta]]) {
    if (valor !== undefined && (!FORMATO_FECHA.test(valor) || Number.isNaN(Date.parse(valor)))) {
      throw new ErrorNegocio(`${nombre}: formato AAAA-MM-DD`, 400);
    }
  }

  // Rango final: por defecto, los últimos 30 días
  const { rows: [r] } = await pool.query(
    `SELECT COALESCE($1::date, ${HOY} - 30) AS desde, COALESCE($2::date, ${HOY}) AS hasta`,
    [desde ?? null, hasta ?? null]
  );
  if (r.desde > r.hasta) throw new ErrorNegocio('"desde" no puede ser posterior a "hasta"', 400);

  const { rows } = await pool.query(sql, [r.desde, r.hasta]);

  const resultado = { tipo, desde: r.desde, hasta: r.hasta, sin_datos: rows.length === 0, datos: rows };

  // En el reporte de faltas se agrega cuántos pacientes acumulan faltas (sin nombres)
  if (tipo === 'faltas') {
    const { rows: [p] } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM pacientes WHERE faltas_seguidas >= $1`,
      [FALTAS_CONFIRMACION]
    );
    resultado.pacientes_con_faltas_seguidas = p.total;
  }

  await registrarAcceso({ usuarioId: empleado.id, accion: 'consultar_reporte', detalle: tipo });
  return resultado;
}