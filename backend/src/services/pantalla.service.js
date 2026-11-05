import { pool } from '../db/pool.js';
import { ZONA_HORARIA } from '../config/negocio.js';

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;

// Solo números de turno, nunca nombres: la pantalla está en un lugar público
export async function estadoPantalla() {
  const { rows } = await pool.query(
    `SELECT t.numero, t.estado
       FROM turnos t
      WHERE t.fecha = ${HOY}
        AND t.estado IN ('llamado', 'presente', 'en_camino', 'reservado', 'en_pausa')
      ORDER BY CASE t.estado
                 WHEN 'llamado'   THEN 0
                 WHEN 'presente'  THEN 1
                 WHEN 'en_camino' THEN 2
                 WHEN 'reservado' THEN 3
                 ELSE 4
               END,
               (t.prioridad <> 'ninguna') DESC, t.orden ASC`
  );

  return {
    llamando: rows.find((r) => r.estado === 'llamado')?.numero ?? null,
    proximos: rows
      .filter((r) => ['presente', 'en_camino', 'reservado'].includes(r.estado))
      .slice(0, 5)
      .map((r) => r.numero),
    en_pausa: rows.filter((r) => r.estado === 'en_pausa').map((r) => r.numero),
  };
}