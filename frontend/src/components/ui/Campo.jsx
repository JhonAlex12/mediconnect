import React from 'react';

// Clase de cualquier control de formulario (input, select, textarea)
export const claseControl =
  'block w-full h-10 rounded-md border border-borde-campo bg-superficie px-3 text-base text-tinta ' +
  'placeholder:text-tinta-tenue disabled:bg-hundido disabled:text-tinta-tenue ' +
  'aria-[invalid=true]:border-error-texto';

// Envoltorio: etiqueta arriba, control, ayuda y error debajo.
// El control recibe id, aria-describedby y aria-invalid ya calculados.
export default function Campo({ id, etiqueta, ayuda, error, opcional = false, className = '', children }) {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = error ? `${id}-error` : undefined;
  const describe = [idAyuda, idError].filter(Boolean).join(' ') || undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id,
        'aria-describedby': describe,
        'aria-invalid': error ? true : undefined,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold text-tinta mb-1">
        {etiqueta}
        {opcional && <span className="font-normal text-tinta-tenue"> (opcional)</span>}
      </label>
      {control}
      {ayuda && (
        <p id={idAyuda} className="mt-1 text-sm text-tinta-tenue">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="mt-1 text-sm font-bold text-error-texto">
          {error}
        </p>
      )}
    </div>
  );
}

export function Entrada({ className = '', ...props }) {
  return <input className={`${claseControl} ${className}`} {...props} />;
}

export function Selector({ className = '', children, ...props }) {
  return (
    <select className={`${claseControl} pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
}

// Casilla con su texto al lado (la etiqueta es el propio texto)
export function Casilla({ children, className = '', ...props }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-tinta cursor-pointer ${className}`}>
      <input type="checkbox" className="w-4 h-4 accent-primario-600" {...props} />
      {children}
    </label>
  );
}
