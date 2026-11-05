import 'dotenv/config';
import http from 'node:http';
import app from './app.js';
import { iniciarSockets } from './sockets/index.js';
import { iniciarTareas } from './jobs/mantenimiento.job.js';

// Express y Socket.IO comparten el mismo servidor HTTP
const servidor = http.createServer(app);

iniciarSockets(servidor);
iniciarTareas();

const puerto = process.env.PORT || 3000;
servidor.listen(puerto, () => {
  console.log(`Mediconect API escuchando en http://localhost:${puerto}`);
});