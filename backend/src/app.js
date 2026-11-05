import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db/pool.js';

const app = express();

app.use(helmet());        // cabeceras de seguridad
app.use(cors());          // permite peticiones desde el frontend
app.use(express.json());  // entiende cuerpos de petición en JSON

// Ruta de prueba: confirma que el servidor y la base de datos responden
app.get('/api/salud', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, baseDeDatos: 'conectada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, baseDeDatos: 'sin conexión' });
  }
});

export default app;
