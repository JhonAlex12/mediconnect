import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useSesion } from './sesion';

// Una sola conexión en vivo para todo el panel de la farmacia
const ContextoTiempoReal = createContext({ socket: null, conectado: false });

export function TiempoRealProvider({ children }) {
  const { token } = useSesion();
  const [socket, setSocket] = useState(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const s = io({ auth: { token } });
    s.on('connect', () => setConectado(true));
    s.on('disconnect', () => setConectado(false));
    s.on('connect_error', () => setConectado(false));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConectado(false);
    };
  }, [token]);

  return (
    <ContextoTiempoReal.Provider value={{ socket, conectado }}>
      {children}
    </ContextoTiempoReal.Provider>
  );
}

export function useConexionEnVivo() {
  return useContext(ContextoTiempoReal).conectado;
}

// Ejecuta "alRecibir" al montarse, cada vez que llega el evento y al (re)conectar,
// para ponerse al día con lo que pasó mientras no había conexión
export function useEventoEnVivo(evento, alRecibir) {
  const { socket } = useContext(ContextoTiempoReal);
  const ref = useRef(alRecibir);
  ref.current = alRecibir;

  useEffect(() => {
    ref.current();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const manejar = () => ref.current();
    socket.on(evento, manejar);
    socket.on('connect', manejar);
    return () => {
      socket.off(evento, manejar);
      socket.off('connect', manejar);
    };
  }, [socket, evento]);
}
