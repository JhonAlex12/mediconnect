import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { useConexionEnVivo } from '../../lib/tiempoReal';

export const claseCampo =
  'w-full border border-slate-400 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-600';

// Campo de dinero: muestra los puntos de miles mientras se escribe ("20.000").
// "valor" y "cambiar" usan solo los dígitos ("20000"), así el resto del formulario no cambia.
// Se arma a mano (no con toLocaleString) para que se vea igual en todos los navegadores
const conPuntos = (digitos) => String(digitos ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function CampoPesos({ id, valor, cambiar, placeholder, className = '', ...props }) {
  const entrada = useRef(null);
  const cifrasALaDerecha = useRef(null); // para que el cursor no salte al poner o quitar puntos

  useLayoutEffect(() => {
    const el = entrada.current;
    if (!el || cifrasALaDerecha.current === null || document.activeElement !== el) return;
    let pos = el.value.length;
    for (let quedan = cifrasALaDerecha.current; pos > 0 && quedan > 0; pos--) {
      if (/\d/.test(el.value[pos - 1])) quedan--;
    }
    el.setSelectionRange(pos, pos);
    cifrasALaDerecha.current = null;
  });

  const alEscribir = (e) => {
    const { value, selectionStart } = e.target;
    cifrasALaDerecha.current = value.slice(selectionStart ?? value.length).replace(/\D/g, '').length;
    cambiar(value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9));
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden="true">$</span>
      <input ref={entrada} id={id} type="text" inputMode="numeric" autoComplete="off"
        value={conPuntos(valor)} onChange={alEscribir}
        placeholder={placeholder != null ? conPuntos(String(placeholder)) : undefined}
        className={`${claseCampo} pl-7 ${className}`} {...props} />
    </div>
  );
}

export function BotonAccion({ onClick, ocupado, color, icono: Icono, children, type = 'button' }) {
  const colores = {
    verde: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ambar: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    rojo: 'bg-red-600 hover:bg-red-700 text-white',
    oscuro: 'bg-slate-800 hover:bg-slate-900 text-white',
    gris: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
    azul: 'bg-marca-azul hover:bg-marca-azul-oscuro text-white',
    azulSuave: 'bg-marca-hielo hover:bg-[#e2eef8] text-marca-azul-oscuro border border-marca-azul/15',
    contorno: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={ocupado}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colores[color]}`}
    >
      {Icono && <Icono className="w-4 h-4" />}
      {children}
    </button>
  );
}

// azul: versión en el color de la marca (la usa el inventario)
export function IndicadorEnVivo({ azul = false }) {
  const conectado = useConexionEnVivo();
  return (
    <span
      className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
        conectado ? (azul ? 'bg-marca-hielo text-marca-azul-oscuro' : 'bg-emerald-100 text-emerald-800') : 'bg-slate-200 text-slate-600'
      }`}
    >
      {conectado ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      {conectado ? 'En vivo' : 'Sin conexión en vivo'}
    </span>
  );
}

export function Aviso({ aviso }) {
  if (!aviso) return null;
  const error = aviso.tipo === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`border-l-4 p-3 rounded-r-lg flex items-start gap-2 ${
        error ? 'bg-red-50 border-red-600 text-red-800' : 'bg-emerald-50 border-emerald-600 text-emerald-900'
      }`}
    >
      {error ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
      <p>{aviso.texto}</p>
    </div>
  );
}

// Ejecuta una acción contra el backend mostrando el resultado en un aviso.
// Devuelve true si salió bien. Los avisos de éxito desaparecen solos.
export function useAccion(alTerminar) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: 'error' | 'exito', texto }

  useEffect(() => {
    if (aviso?.tipo !== 'exito') return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const ejecutar = useCallback(
    async (accion, textoExito) => {
      setOcupado(true);
      setAviso(null);
      try {
        const r = await accion();
        setAviso({ tipo: 'exito', texto: typeof textoExito === 'function' ? textoExito(r) : textoExito });
        await alTerminar?.();
        return true;
      } catch (err) {
        setAviso({ tipo: 'error', texto: err.message });
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [alTerminar]
  );

  return { ocupado, aviso, setAviso, ejecutar };
}
