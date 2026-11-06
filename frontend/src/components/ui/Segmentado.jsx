import React from 'react';

// Grupo de opciones excluyentes (2 a 4) mostrado como botones pegados.
// opciones: [{ valor, texto, icono? }]
export default function Segmentado({ etiqueta, opciones, valor, onChange, ancho = false }) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={`${ancho ? 'flex w-full' : 'inline-flex'} rounded-md border border-borde-campo bg-superficie p-0.5`}
    >
      {opciones.map(({ valor: v, texto, icono: Icono }) => {
        const activo = v === valor;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={activo}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activo ? 'bg-primario-600 text-white' : 'text-tinta-suave hover:bg-hundido hover:text-tinta'
            }`}
          >
            {Icono && <Icono size={16} aria-hidden="true" />}
            {texto}
          </button>
        );
      })}
    </div>
  );
}
