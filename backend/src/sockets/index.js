import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { setIo } from './emisor.js';

export function iniciarSockets(servidor) {
  // Más adelante, "origin" se limita al dominio real del frontend
  const io = new Server(servidor, { cors: { origin: '*' } });

  // Se ejecuta antes de aceptar cada conexión
  io.use((socket, next) => {
    const { tipo, token } = socket.handshake.auth ?? {};

    // La pantalla pública no necesita login: solo recibe números de turno
    if (tipo === 'pantalla') {
      socket.data.salas = ['pantalla'];
      return next();
    }

    try {
      const datos = jwt.verify(token, process.env.JWT_SECRET);
      if (datos.tipo === 'empleado') {
        socket.data.salas = ['farmacia', 'pantalla'];
      } else if (datos.tipo === 'paciente_turno') {
        socket.data.salas = [`turno:${datos.turno_id}`, 'pantalla'];
      } else {
        throw new Error('tipo inválido');
      }
      next();
    } catch {
      next(new Error('No autorizado'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.data.salas);
  });

  setIo(io);
}