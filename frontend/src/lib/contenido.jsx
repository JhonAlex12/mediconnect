import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

// Contenido del sitio que edita el administrador: contacto, carrusel e información al paciente.
// Se pide una vez al abrir el sitio. Mientras llega se usan estos valores, para que no se vea vacío.
const INICIAL = {
  contacto: {
    telefono: '', correo: '', direccion: '', ciudad: '', horario: '', lat: 7.8835, lon: -72.505,
  },
  slides: [
    {
      id: 'banner', nombre: 'Reclama tus medicamentos', imagen: '/img/banner-familia-1600.webp',
      imagen_movil: '/img/banner-familia-900.webp', fondo: null, enlace: null,
      texto_alt: 'Mediconnect. Tu salud, sin complicaciones: ¡reclama tus medicamentos desde casa! Evita filas y ahorra tiempo.',
    },
  ],
  secciones: null, // null = cargando
  cargado: false,
};

const Contexto = createContext({ ...INICIAL, recargar: () => {} });

export function ContenidoProvider({ children }) {
  const [contenido, setContenido] = useState(INICIAL);

  const recargar = useCallback(async () => {
    try {
      const d = await api('/contenido/sitio', { token: null });
      setContenido({ contacto: d.contacto, slides: d.slides, secciones: d.secciones, cargado: true });
    } catch {
      setContenido((c) => ({ ...c, secciones: c.secciones ?? [], cargado: true }));
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return <Contexto.Provider value={{ ...contenido, recargar }}>{children}</Contexto.Provider>;
}

export const useContenido = () => useContext(Contexto);
export const useContacto = () => useContext(Contexto).contacto;
