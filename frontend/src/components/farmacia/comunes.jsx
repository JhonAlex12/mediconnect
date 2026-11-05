import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { useConexionEnVivo } from '../../lib/tiempoReal';

export const claseCampo =
  'w-full border border-slate-400 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-600';

export function BotonAccion({ onClick, ocupado, color, icono: Icono, children, type = 'button' }) {
  const colores = {
    verde: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ambar: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    rojo: 'bg-red-600 hover:bg-red-700 text-white',
    oscuro: 'bg-slate-800 hover:bg-slate-900 text-white',
    gris: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
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

export function IndicadorEnVivo() {
  const conectado = useConexionEnVivo();
  return (
    <span
      className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
        conectado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
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
