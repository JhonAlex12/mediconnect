import React from 'react';
import { Loader2 } from 'lucide-react';

// Tamaños de ícono comunes: 16 px dentro de botones y textos, 20 px en títulos
export const ICONO_SM = 16;
export const ICONO_MD = 20;

const VARIANTES = {
  // Acción principal de la pantalla (una sola por zona)
  primario: 'bg-primario-600 text-white border-primario-600 hover:bg-primario-700 hover:border-primario-700',
  // Acciones secundarias
  secundario: 'bg-superficie text-tinta border-borde-campo hover:bg-hundido',
  // Acciones que borran, cancelan o desactivan
  peligro: 'bg-superficie text-error-texto border-error-borde hover:bg-error-fondo',
  // Acciones discretas dentro de tablas o barras
  fantasma: 'bg-transparent text-primario-700 border-transparent hover:bg-primario-50',
};

const TAMANOS = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-base gap-2',
  lg: 'h-12 px-5 text-lg gap-2',
};

export function clasesBoton({ variante = 'secundario', tamano = 'md', ancho = false } = {}) {
  return [
    'inline-flex items-center justify-center font-bold rounded-md border whitespace-nowrap',
    'transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANTES[variante] ?? VARIANTES.secundario,
    TAMANOS[tamano] ?? TAMANOS.md,
    ancho ? 'w-full' : '',
  ].join(' ');
}

export default function Boton({
  variante = 'secundario',
  tamano = 'md',
  icono: Icono,
  cargando = false,
  ancho = false,
  type = 'button',
  disabled,
  className = '',
  children,
  ...props
}) {
  const tamIcono = tamano === 'lg' ? ICONO_MD : ICONO_SM;
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={`${clasesBoton({ variante, tamano, ancho })} ${className}`}
      {...props}
    >
      {cargando ? (
        <Loader2 size={tamIcono} className="animate-spin" aria-hidden="true" />
      ) : (
        Icono && <Icono size={tamIcono} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
