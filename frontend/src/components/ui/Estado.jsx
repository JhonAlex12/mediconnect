import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Inbox, Loader2 } from 'lucide-react';
import { ICONO_MD } from './Boton';

// Tono por SIGNIFICADO, nunca por gusto:
//   ok     → disponible, entregado, activo
//   alerta → por vencer, stock bajo, pocas unidades
//   error  → vencido, agotado, sin stock
//   neutro → cualquier otro estado informativo (sin color)
const TONOS = {
  ok: 'bg-ok-fondo text-ok-texto border-ok-borde',
  alerta: 'bg-alerta-fondo text-alerta-texto border-alerta-borde',
  error: 'bg-error-fondo text-error-texto border-error-borde',
  neutro: 'bg-hundido text-tinta-suave border-borde',
};

export function EstadoBadge({ tono = 'neutro', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold whitespace-nowrap ${
        TONOS[tono] ?? TONOS.neutro
      } ${className}`}
    >
      {children}
    </span>
  );
}

const ICONOS_AVISO = { ok: CheckCircle2, alerta: AlertTriangle, error: AlertCircle, neutro: Info };

// Mensaje en línea: resultado de una acción, error de carga, advertencia
export function Aviso({ tono = 'neutro', titulo, children, className = '' }) {
  const Icono = ICONOS_AVISO[tono] ?? Info;
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 ${TONOS[tono] ?? TONOS.neutro} ${className}`}
    >
      <Icono size={ICONO_MD} className="shrink-0 mt-px" aria-hidden="true" />
      <div className="text-sm">
        {titulo && <p className="font-bold">{titulo}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

// Lista o tabla sin datos
export function EstadoVacio({ titulo, children, icono: Icono = Inbox, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center gap-1 px-4 py-8 text-tinta-suave ${className}`}>
      <Icono size={ICONO_MD} className="text-tinta-tenue mb-1" aria-hidden="true" />
      <p className="font-bold text-tinta">{titulo}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

// Mientras llegan los datos
export function Cargando({ texto = 'Cargando…', className = '' }) {
  return (
    <p role="status" className={`flex items-center gap-2 px-4 py-6 text-sm text-tinta-suave ${className}`}>
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      {texto}
    </p>
  );
}
