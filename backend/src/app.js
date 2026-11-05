import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import formulasRoutes from './routes/formulas.routes.js';
import { pool } from './db/pool.js';
import turnosRoutes from './routes/turnos.routes.js';
import ipsRoutes from './routes/ips.routes.js';
import { ErrorNegocio } from './services/formulas.service.js';

const app = express();

app.use(helmet());        // cabeceras de seguridad
app.use(cors());          // permite peticiones desde el frontend
app.use(express.json()); 
app.use('/api/formulas', formulasRoutes); // entiende cuerpos de petición en JSON
app.use('/api/turnos', turnosRoutes);
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

// Entrada de fórmulas desde la IPS
app.use('/api/ips', ipsRoutes);

// Manejador de errores: convierte los errores en respuestas ordenadas
app.use((error, req, res, next) => {
  if (error instanceof ErrorNegocio) {
    return res.status(error.estado).json({
      ok: false,
      mensaje: error.message,
      detalles: error.detalles,
    });
  }
  console.error(error);
  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

export default app;