import { pool } from '../db/pool.js';

// "cliente" permite usarla dentro de una transacción; si no se pasa, usa el pool
export async function registrarAcceso(
  { usuarioId = null, pacienteId = null, accion, detalle = null },
  cliente = pool
) {
  await cliente.query(
    `INSERT INTO registro_accesos (usuario_id, paciente_id, accion, detalle)
     VALUES ($1, $2, $3, $4)`,
    [usuarioId, pacienteId, accion, detalle]
  );
}