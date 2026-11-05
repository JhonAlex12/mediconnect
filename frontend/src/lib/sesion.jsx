import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, alVencer, guardarToken, leerToken } from './api';

const ContextoSesion = createContext(null);

export function SesionProvider({ children }) {
  const [token, setToken] = useState(leerToken);
  const [usuario, setUsuario] = useState(null);
  // "verificando" mientras se confirma con el backend un token guardado
  const [verificando, setVerificando] = useState(() => Boolean(leerToken()));

  const cerrarSesion = useCallback(() => {
    guardarToken(null);
    setToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    alVencer(cerrarSesion);
    return () => alVencer(null);
  }, [cerrarSesion]);

  // Al cargar la página: ¿el token guardado sigue vigente?
  useEffect(() => {
    if (!token || usuario) return;
    let cancelado = false;
    api('/auth/yo', { token })
      .then((d) => !cancelado && setUsuario(d.usuario))
      .catch(() => !cancelado && cerrarSesion())
      .finally(() => !cancelado && setVerificando(false));
    return () => {
      cancelado = true;
    };
  }, [token, usuario, cerrarSesion]);

  const iniciarSesion = useCallback(async (nombreUsuario, clave) => {
    const d = await api('/auth/login', {
      metodo: 'POST',
      cuerpo: { usuario: nombreUsuario, clave },
      token: null,
    });
    guardarToken(d.token);
    setToken(d.token);
    setUsuario(d.usuario);
  }, []);

  return (
    <ContextoSesion.Provider value={{ token, usuario, verificando, iniciarSesion, cerrarSesion }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export function useSesion() {
  return useContext(ContextoSesion);
}
