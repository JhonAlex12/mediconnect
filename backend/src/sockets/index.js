import { Server } from 'socket.io';
import { setIo } from './emisor.js';
import { autorizarConexion } from './acceso.js';

export function iniciarSockets(servidor) {
  const origen = process.env.URL_SITIO || process.env.RENDER_EXTERNAL_URL;
  const io = new Server(servidor, { cors: { origin: origen || '*' } });

  // Se ejecuta antes de aceptar cada conexión
  io.use(async (socket, next) => {
    try {
      Object.assign(socket.data, await autorizarConexion(socket.handshake.auth));
      next();
    } catch {
      next(new Error('No autorizado'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.exp * 1000 <= Date.now()) return socket.disconnect(true);
    socket.join(socket.data.salas);
    // Un socket abierto tampoco puede sobrevivir al vencimiento del JWT.
    const vencimiento = setTimeout(() => socket.disconnect(true),
      Math.min(socket.data.exp * 1000 - Date.now(), 2_147_483_647));
    vencimiento.unref();
    socket.on('disconnect', () => clearTimeout(vencimiento));
  });

  setIo(io);
  return io;
}
