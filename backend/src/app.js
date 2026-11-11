import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
import botRoutes from './routes/bot.routes.js';
import kioscoRoutes from './routes/kiosco.routes.js';

const app = express();

// Dirección pública del sitio (en Render la da RENDER_EXTERNAL_URL automáticamente)
const URL_PUBLICA = process.env.URL_SITIO || process.env.RENDER_EXTERNAL_URL || null;

// IP real de cada visitante (para los límites de intentos):
// en Render hay un proxy delante; en local, el túnel de pruebas (cloudflared) corre en este mismo equipo
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback');

// Cabeceras de seguridad. La política de contenido solo permite lo que usa el sitio:
// fuentes de Google, el mapa de OpenStreetMap y la conexión en vivo (Socket.IO).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      frameSrc: ['https://www.google.com', 'https://maps.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
}));
// En producción el sitio y la API comparten dominio; solo se admite ese origen
app.use(cors(URL_PUBLICA ? { origin: URL_PUBLICA } : undefined));
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
app.use('/api/kiosco', kioscoRoutes);          // pantalla de turnos de la entrada
app.use('/api/bot', botRoutes);                // Mediconnect Bot (chat del sitio y sus preguntas)
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

// Sitio web (producción): el backend entrega también la página construida con "npm run build"
const DIST = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
if (existsSync(DIST)) {
  // Los archivos de /assets llevan un código en el nombre: se pueden guardar en caché un año
  app.use('/assets', express.static(`${DIST}assets`, { immutable: true, maxAge: '1y' }));
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  // Cualquier otra dirección (/, /farmacia/fila, /salud-al-dia/...) la resuelve React
  app.get(/^(?!\/api\/|\/socket\.io\/).*/, (req, res) => {
    const pagina = req.path.startsWith('/ips') ? 'ips/index.html' : 'index.html';
    res.set('Cache-Control', 'no-cache').sendFile(`${DIST}${pagina}`);
  });
}
// Ruta de la API que no existe
app.use('/api', (req, res) => res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' }));

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