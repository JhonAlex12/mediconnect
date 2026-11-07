import { pool } from '../db/pool.js';
import { ZONA_HORARIA } from '../config/negocio.js';

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;

// "María Fernanda Rojas" → "María R.": basta para reconocerse y expone lo mínimo
export function nombreCorto(nombre) {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return null;
  // Con 3 o más palabras se asume nombre compuesto: la inicial es del primer apellido
  const apellido = partes.length >= 3 ? partes[partes.length - 2] : partes[1];
  return apellido ? `${partes[0]} ${apellido[0].toUpperCase()}.` : partes[0];
}

// La pantalla la abre un empleado con su sesión (no es pública):
// muestra el nombre corto SOLO del turno que se está llamando; la fila va sin nombres.
export async function estadoPantalla() {
  const { rows } = await pool.query(
    `SELECT t.numero, t.estado, COALESCE(p.nombre, t.nombre_visitante) AS nombre
       FROM turnos t
       LEFT JOIN pacientes p ON p.id = t.paciente_id
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

  const llamado = rows.find((r) => r.estado === 'llamado');
  return {
    llamando: llamado?.numero ?? null,
    llamando_nombre: llamado ? nombreCorto(llamado.nombre) : null,
    proximos: rows
      .filter((r) => ['presente', 'en_camino', 'reservado'].includes(r.estado))
      .slice(0, 5)
      .map((r) => r.numero),
    en_pausa: rows.filter((r) => r.estado === 'en_pausa').map((r) => r.numero),
  };
}