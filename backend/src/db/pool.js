import pg from 'pg';
import 'dotenv/config';

// Las columnas de tipo DATE (código 1082) se devuelven como texto "2026-11-15"
// en vez de convertirse a un objeto Date, que se corría por la zona horaria.
pg.types.setTypeParser(1082, (valor) => valor);

// El "pool" mantiene varias conexiones abiertas a PostgreSQL
// y las reparte entre las peticiones, para que sea rápido.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});