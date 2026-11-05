import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';

// Express y Socket.IO comparten el mismo servidor HTTP
const servidor = http.createServer(app);
const io = new Server(servidor, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
});

const puerto = process.env.PORT || 3000;
servidor.listen(puerto, () => {
  console.log(`Mediconect API escuchando en http://localhost:${puerto}`);
});
