import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

// Título de la pestaña del navegador para cada página
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Mediconect` : 'Mediconect · Tu farmacia conectada';
  }, [titulo]);
}

// Logo: cruz de farmacia + nombre
export function Logo({ claro = false, subtitulo }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0">
      <span className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
        <Plus className="w-7 h-7 text-white" strokeWidth={3.5} />
      </span>
      <span className="leading-tight">
        <span className={`block font-black text-xl tracking-tight ${claro ? 'text-white' : 'text-blue-950'}`}>
          Medi<span className="text-emerald-500">conect</span>
        </span>
        {subtitulo && (
          <span className={`block text-xs ${claro ? 'text-blue-200' : 'text-slate-500'}`}>{subtitulo}</span>
        )}
      </span>
    </Link>
  );
}

// Barra superior de las páginas internas (farmacia, 404)
export default function Encabezado({ seccion, children, ancho = 'max-w-7xl' }) {
  return (
    <header className="bg-blue-950 text-white shadow-md">
      <div className={`${ancho} mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4`}>
        <Logo claro subtitulo={seccion} />
        {children}
      </div>
    </header>
  );
}
