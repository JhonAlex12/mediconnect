import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

// Lee schema.sql y lo ejecuta contra PostgreSQL
const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(sql);
  console.log('Tablas creadas correctamente.');
} catch (error) {
  console.error('Error al crear las tablas:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();   // cierra la conexión para que el script termine
}
