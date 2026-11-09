import { useEffect, useState } from 'react';
import { api } from './api';

// Artículos de "Salud al día": se escriben en el panel (Contenido del sitio → Salud al día)

// Lista de artículos publicados (null mientras carga)
export function useArticulos() {
  const [articulos, setArticulos] = useState(null);
  useEffect(() => {
    let cancelado = false;
    api('/contenido/articulos', { token: null })
      .then((d) => !cancelado && setArticulos(d.articulos))
      .catch(() => !cancelado && setArticulos([]));
    return () => {
      cancelado = true;
    };
  }, []);
  return articulos;
}

// Un artículo por su dirección: { estado: 'cargando' | 'ok' | 'no-existe', articulo }
export function useArticulo(slug) {
  const [r, setR] = useState({ estado: 'cargando' });
  useEffect(() => {
    let cancelado = false;
    setR({ estado: 'cargando' });
    api(`/contenido/articulos/${encodeURIComponent(slug)}`, { token: null })
      .then((d) => !cancelado && setR({ estado: 'ok', articulo: d.articulo }))
      .catch(() => !cancelado && setR({ estado: 'no-existe' }));
    return () => {
      cancelado = true;
    };
  }, [slug]);
  return r;
}

// "2026-11-03" → "3 de noviembre de 2026"
export const fechaArticulo = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};
