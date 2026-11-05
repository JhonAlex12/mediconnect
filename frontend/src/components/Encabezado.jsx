import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

// Título de la pestaña del navegador para cada página
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Mediconect` : 'Mediconect';
  }, [titulo]);
}

// Barra superior común: logo, nombre de la sección y lo que cada página agregue a la derecha
export default function Encabezado({ seccion, children, ancho = 'max-w-7xl' }) {
  return (
    <header className="bg-slate-900 text-white shadow-md">
      <div className={`${ancho} mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4`}>
        <Link to="/" className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-900 text-lg">
            M
          </span>
          <span>
            <span className="block font-bold text-lg leading-tight">Mediconect</span>
            {seccion && <span className="block text-xs text-slate-400">{seccion}</span>}
          </span>
        </Link>
        {children}
      </div>
    </header>
  );
}
