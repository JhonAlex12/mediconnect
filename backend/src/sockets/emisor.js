let io = null;

export function setIo(instancia) {
  io = instancia;
}

// Envía un evento solo a los clientes de una sala
export function emitir(sala, evento, datos) {
  io?.to(sala).emit(evento, datos);
}