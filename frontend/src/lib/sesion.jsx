import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, alVencer, guardarToken, idEquipo, leerToken, LATIDO_SESION_MS } from './api';

const ContextoSesion = createContext(null);

export function SesionProvider({ children }) {
  const [token, setToken] = useState(leerToken);
  const [usuario, setUsuario] = useState(null);
  // "verificando" mientras se confirma con el backend un token guardado
  const [verificando, setVerificando] = useState(() => Boolean(leerToken()));
  // Por qué el servidor cerró la sesión (cambió la contraseña, se salió en otra pestaña…):
  // el sitio abre la ventana de ingreso con este aviso
  const [avisoSesion, setAvisoSesion] = useState('');

  const cerrarSesion = useCallback((motivo) => {
    guardarToken(null);
    setToken(null);
    setUsuario(null);
    if (typeof motivo === 'string') setAvisoSesion(motivo);
  }, []);
  const quitarAvisoSesion = useCallback(() => setAvisoSesion(''), []);

  // «Salir»: además de olvidar el token aquí, libera la cuenta en el servidor para que pueda
  // entrar desde otro equipo de inmediato (una sola sesión por cuenta)
  const salir = useCallback(() => {
    api('/auth/salir', { metodo: 'POST' }).catch(() => {});
    cerrarSesion();
  }, [cerrarSesion]);

  // Mientras la página esté abierta, la sesión se marca como en uso; si el servidor ya la
  // cerró, la respuesta 401 cierra la sesión aquí con su aviso
  useEffect(() => {
    if (!usuario) return undefined;
    const latido = setInterval(() => api('/auth/yo').catch(() => {}), LATIDO_SESION_MS);
    return () => clearInterval(latido);
  }, [usuario]);

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
      cuerpo: { usuario: nombreUsuario, clave, equipo: idEquipo() },
      token: null,
    });
    setAvisoSesion('');
    guardarToken(d.token);
    setToken(d.token);
    setUsuario(d.usuario);
  }, []);

  return (
    <ContextoSesion.Provider value={{ token, usuario, verificando, iniciarSesion, cerrarSesion, salir, avisoSesion, quitarAvisoSesion }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export function useSesion() {
  return useContext(ContextoSesion);
}
