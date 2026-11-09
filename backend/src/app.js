import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { estadoPantalla } from './services/pantalla.service.js';
import { exigirEmpleado } from './middleware/autenticacion.js';
import formulasRoutes from './routes/formulas.routes.js';
import { pool } from './db/pool.js';
import turnosRoutes from './routes/turnos.routes.js';
import ipsRoutes from './routes/ips.routes.js';
import simuladorRoutes from './routes/simulador.routes.js';
import authRoutes from './routes/auth.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import dispensacionRoutes from './routes/dispensacion.routes.js';
import filaRoutes from './routes/fila.routes.js';
import { ErrorNegocio } from './services/formulas.service.js';
import reportesRoutes from './routes/reportes.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import tarifasRoutes from './routes/tarifas.routes.js';
import cuentaRoutes from './routes/cuenta.routes.js';
import domiciliosRoutes from './routes/domicilios.routes.js';
import contenidoRoutes from './routes/contenido.routes.js';

const app = express();

app.use(helmet());        // cabeceras de seguridad
app.use(cors());          // permite peticiones desde el frontend
// Subida de imágenes del panel: admite cuerpos grandes (la imagen viaja en base64).
// Va antes del límite general; express.json no vuelve a leer un cuerpo ya leído.
app.use('/api/contenido/admin/imagenes', exigirEmpleado('administrador'), express.json({ limit: '15mb' }));
app.use(express.json());
app.use('/api/formulas', formulasRoutes); // entiende cuerpos de petición en JSON
app.use('/api/turnos', turnosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/fila', filaRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/dispensacion', dispensacionRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/tarifas', tarifasRoutes);
app.use('/api/cuenta', cuentaRoutes);          // cuentas de pacientes
app.use('/api/domicilios', domiciliosRoutes);  // gestión de domicilios (panel)
app.use('/api/contenido', contenidoRoutes);    // contenido del sitio (público y administración)
// Estado inicial de la pantalla de la sala (con sesión de empleado; luego se actualiza por Socket.IO)
app.get('/api/pantalla', exigirEmpleado('administrador', 'auxiliar'), async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await estadoPantalla()) });
  } catch (error) {
    next(error);
  }
});
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
app.use('/api/simulador', simuladorRoutes); // solo con MODO_DEMO=true

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