import { pool } from '../db/pool.js';
import { ZONA_HORARIA } from '../config/negocio.js';

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;

// Partículas que forman parte del apellido: "de la Hoz", "del Río"
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

// "MARÍA" / "maría" → "María"; las partículas quedan en minúscula
const capitalizar = (p) =>
  PARTICULAS.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();

// Primer nombre + primer apellido, como en la cédula (uno o dos nombres y dos apellidos):
//   "María Fernanda Rojas Pérez" → "María Rojas"
//   "Laura Gómez Ruiz"           → "Laura Gómez"   (3 palabras: un nombre y dos apellidos)
//   "Juan Pérez"                 → "Juan Pérez"
//   "Ana María de la Hoz Pérez"  → "Ana de la Hoz"
export function nombreCorto(nombre) {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean).map(capitalizar);
  if (partes.length === 0) return null;
  if (partes.length <= 2) return partes.join(' ');

  // El primer apellido es la penúltima palabra, con las partículas que lleve antes
  let i = partes.length - 2;
  while (i > 1 && PARTICULAS.has(partes[i - 1].toLowerCase())) i -= 1;
  return `${partes[0]} ${partes.slice(i, partes.length - 1).join(' ')}`;
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