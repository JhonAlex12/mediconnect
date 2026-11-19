import { autorizarConexion } from './acceso.js';

let io = null;

export function setIo(instancia) {
  io = instancia;
}

// Envía un evento solo a los clientes de una sala
export async function emitir(sala, evento, datos) {
  if (!io) return;
  if (!['pantalla', 'farmacia'].includes(sala)) {
    io.to(sala).emit(evento, datos);
    return;
  }
  // Revalida antes de enviar: cubre cambios de rol, bajas y conexiones
  // que se estaban autenticando mientras se modificaban los permisos.
  const sockets = await io.in(sala).fetchSockets();
  await Promise.all(sockets.map(async (socket) => {
    try {
      const acceso = await autorizarConexion(socket.handshake.auth);
      if (!acceso.salas.includes(sala)) return socket.disconnect(true);
      socket.emit(evento, datos);
    } catch {
      socket.disconnect(true);
    }
  }));
}

// Envía un evento a las conexiones en vivo de un empleado (p. ej., alguien intentó entrar con su cuenta)
export function avisarEmpleado(id, evento, datos) {
  for (const socket of io?.of('/').sockets.values() ?? []) {
    if (socket.data.empleadoId === id) socket.emit(evento, datos);
  }
}

// Cierra las conexiones en vivo de un empleado; "exceptoEquipo": deja las del navegador
// que acaba de iniciar sesión (las de otro equipo se cierran: una sola sesión por cuenta)
export function desconectarEmpleado(id, { exceptoEquipo } = {}) {
  for (const socket of io?.of('/').sockets.values() ?? []) {
    if (socket.data.empleadoId === id && (!exceptoEquipo || socket.data.equipo !== exceptoEquipo)) {
      socket.disconnect(true);
    }
  }
}
