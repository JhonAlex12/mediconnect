import pg from 'pg';
import 'dotenv/config';

// El "pool" mantiene varias conexiones abiertas a PostgreSQL
// y las reparte entre las peticiones, para que sea rápido.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
