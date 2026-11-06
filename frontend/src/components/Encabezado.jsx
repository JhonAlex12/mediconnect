import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

// Título de la pestaña del navegador para cada página
export function useTitulo(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Mediconnect` : 'Mediconnect · Tu farmacia conectada';
  }, [titulo]);
}

// Logo: el símbolo de la marca + el nombre con sus dos colores.
// El símbolo tiene fondo transparente: sirve igual sobre fondos claros y oscuros.
export function Logo({ claro = false, subtitulo }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label="Mediconnect, ir al inicio">
      <span className={`flex items-center justify-center shrink-0 ${claro ? 'w-12 h-12' : 'w-14 h-14'}`}>
        <img src="/img/logo-simbolo.png" alt="" className="w-full h-full object-contain" />
      </span>
      <span className="leading-tight">
        <span className="block font-titulo font-extrabold text-xl tracking-tight">
          <span className={claro ? 'text-white' : 'text-marca-azul'}>Medi</span>
          <span className="text-marca-verde">connect</span>
        </span>
        {subtitulo && (
          <span className={`block text-xs ${claro ? 'text-white/80' : 'text-tinta-suave'}`}>{subtitulo}</span>
        )}
      </span>
    </Link>
  );
}
