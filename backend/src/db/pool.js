import pg from 'pg';
import 'dotenv/config';

// Las columnas de tipo DATE (código 1082) se devuelven como texto "2026-11-15"
// en vez de convertirse a un objeto Date, que se corría por la zona horaria.
pg.types.setTypeParser(1082, (valor) => valor);

// El "pool" mantiene varias conexiones abiertas a PostgreSQL
// y las reparte entre las peticiones, para que sea rápido.
// DATABASE_SSL=true cuando la base de datos está en otro servidor (p. ej. la URL externa de Render)
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// Si la base de datos cierra una conexión que estaba libre (se reinició o se está apagando), el pool
// la descarta y abre otra en la siguiente consulta. Sin este manejador ese aviso tumbaría el servidor.
pool.on('error', (error) => console.error('[base de datos] se cerró una conexión libre:', error.message));
