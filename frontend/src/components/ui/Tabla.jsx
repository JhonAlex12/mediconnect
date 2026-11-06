import React from 'react';

// Tabla densa para el panel: borde fino, encabezado hundido, filas separadas por líneas.
// "etiqueta" describe la tabla a los lectores de pantalla.
export default function Tabla({ etiqueta, children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left text-sm border-collapse" aria-label={etiqueta}>
        {children}
      </table>
    </div>
  );
}

export function Encabezado({ children }) {
  return (
    <thead className="bg-hundido text-tinta-suave">
      <tr>{children}</tr>
    </thead>
  );
}

// numero: alinea a la derecha (cantidades, horas, turnos)
export function Th({ numero = false, oculto = false, className = '', children, ...props }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-bold text-xs uppercase tracking-wide border-b border-borde ${
        numero ? 'text-right' : ''
      } ${className}`}
      {...props}
    >
      {/* oculto: la celda se mantiene (fondo y borde) y el texto solo lo leen los lectores de pantalla */}
      {oculto ? <span className="sr-only">{children}</span> : children}
    </th>
  );
}

export function Cuerpo({ children }) {
  return <tbody className="divide-y divide-borde">{children}</tbody>;
}

export function Fila({ resaltada = false, tenue = false, className = '', children, ...props }) {
  return (
    <tr
      className={`${resaltada ? 'bg-primario-50' : ''} ${tenue ? 'text-tinta-tenue' : ''} ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ numero = false, className = '', children, ...props }) {
  return (
    <td className={`px-3 py-2.5 align-middle ${numero ? 'text-right cifras' : ''} ${className}`} {...props}>
      {children}
    </td>
  );
}
