import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

// Sesión del PACIENTE con cuenta. Va aparte de la del empleado (lib/sesion.jsx):
// cada una guarda su propio token.
const CLAVE = 'mediconect_token_cuenta';
const leer = () => {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
};
const guardar = (token) => {
  try {
    if (token) localStorage.setItem(CLAVE, token);
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: la sesión dura mientras la pestaña esté abierta
  }
};

const ContextoCuenta = createContext(null);

export function CuentaProvider({ children }) {
  const [token, setToken] = useState(leer);
  const [cuenta, setCuenta] = useState(null);
  const [verificando, setVerificando] = useState(() => Boolean(leer()));

  const cerrarSesion = useCallback(() => {
    guardar(null);
    setToken(null);
    setCuenta(null);
    setVerificando(false);
  }, []);

  // Llamadas con el token del paciente; si vence, se cierra la sesión
  const apiCuenta = useCallback(
    async (ruta, opciones = {}) => {
      try {
        return await api(`/cuenta${ruta}`, { ...opciones, token });
      } catch (err) {
        if (err.estado === 401 && token) cerrarSesion();
        throw err;
      }
    },
    [token, cerrarSesion]
  );

  // Al cargar: ¿el token guardado sigue vigente?
  useEffect(() => {
    if (!token || cuenta) return;
    let cancelado = false;
    api('/cuenta/yo', { token })
      .then((d) => !cancelado && setCuenta(d.cuenta))
      .catch(() => !cancelado && cerrarSesion())
      .finally(() => !cancelado && setVerificando(false));
    return () => {
      cancelado = true;
    };
  }, [token, cuenta, cerrarSesion]);

  // Vuelve a leer la cuenta (p. ej. después de confirmar el correo)
  const recargarCuenta = useCallback(async () => {
    if (!token) return;
    const d = await api('/cuenta/yo', { token });
    setCuenta(d.cuenta);
  }, [token]);

  const entrar = (d) => {
    guardar(d.token);
    setToken(d.token);
    setCuenta(d.cuenta);
  };

  const iniciarSesion = useCallback(async (documento, clave) => {
    entrar(await api('/cuenta/login', { metodo: 'POST', cuerpo: { documento, clave }, token: null }));
  }, []);

  const registrar = useCallback(async (datos) => {
    entrar(await api('/cuenta/registro', { metodo: 'POST', cuerpo: datos, token: null }));
  }, []);

  return (
    <ContextoCuenta.Provider
      value={{ token, cuenta, setCuenta, recargarCuenta, verificando, iniciarSesion, registrar, cerrarSesion, apiCuenta }}
    >
      {children}
    </ContextoCuenta.Provider>
  );
}

export function useCuenta() {
  return useContext(ContextoCuenta);
}
