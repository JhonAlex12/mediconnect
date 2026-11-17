import 'dotenv/config';
import http from 'node:http';
import app from './app.js';
import { iniciarSockets } from './sockets/index.js';
import { iniciarTareas } from './jobs/mantenimiento.job.js';
import { iniciarPush } from './services/push.service.js';
import { pool } from './db/pool.js';

// Express y Socket.IO comparten el mismo servidor HTTP
const servidor = http.createServer(app);

const io = iniciarSockets(servidor);
iniciarTareas();
iniciarPush();   // avisos al celular de cada notificación nueva

const puerto = process.env.PORT || 3000;
servidor.listen(puerto, () => {
  console.log(`Mediconect API escuchando en http://localhost:${puerto}`);
});

// Apagado ordenado (Render envía SIGTERM en cada publicación): deja de recibir visitas,
// termina las peticiones en curso y cierra las conexiones a la base de datos.
let apagando = false;
async function apagar(motivo, codigo = 0) {
  if (apagando) return;
  apagando = true;
  console.log(`Apagando el servidor (${motivo})...`);
  // Si algo se queda colgado, se sale de todas formas
  setTimeout(() => process.exit(1), 10_000).unref();
  try {
    await io.close();    // desconecta los sockets y cierra el servidor HTTP
    await pool.end();    // espera las consultas en curso
  } catch (error) {
    console.error('Error al apagar:', error.message);
    codigo = 1;
  }
  process.exit(codigo);
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));

// Un error suelto en segundo plano (p. ej. un aviso que no se pudo enviar) no debe tumbar la farmacia
process.on('unhandledRejection', (error) => console.error('[error no manejado]', error));
// Tras un error sin capturar el estado ya no es confiable: se apaga y el servicio vuelve a arrancar
process.on('uncaughtException', (error) => {
  console.error('[error sin capturar]', error);
  apagar('error sin capturar', 1);
});
