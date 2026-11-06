import React from 'react';

// Contenedor de una sección de pantalla: borde fino, sin sombra marcada.
// "acciones" va a la derecha del título. "sinRelleno" para tablas que tocan el borde.
export default function Panel({ titulo, descripcion, acciones, sinRelleno = false, as: Etiqueta = 'section', className = '', children }) {
  return (
    <Etiqueta className={`bg-superficie border border-borde-fuerte rounded-md ${className}`}>
      {(titulo || acciones) && (
        <div className="flex items-start justify-between gap-3 flex-wrap px-4 py-3 border-b border-borde">
          <div>
            {titulo && <h2 className="text-base font-bold text-tinta">{titulo}</h2>}
            {descripcion && <p className="text-sm text-tinta-suave">{descripcion}</p>}
          </div>
          {acciones && <div className="flex items-center gap-2 flex-wrap">{acciones}</div>}
        </div>
      )}
      <div className={sinRelleno ? '' : 'p-4'}>{children}</div>
    </Etiqueta>
  );
}

// Título de pantalla: jerarquía con tamaño y peso, sin color
export function TituloPantalla({ titulo, descripcion, acciones }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
      <div>
        <h1 className="text-2xl font-bold text-tinta">{titulo}</h1>
        {descripcion && <p className="text-tinta-suave mt-0.5">{descripcion}</p>}
      </div>
      {acciones && <div className="flex items-center gap-2 flex-wrap">{acciones}</div>}
    </div>
  );
}
