import React, { useCallback, useEffect, useState } from 'react';
import { useConexionEnVivo } from '../../lib/tiempoReal';
import { Aviso as AvisoBase, Boton, claseControl } from '../ui';

// Se conservan estos exports y sus props (los usan las pantallas de la farmacia
// y la del paciente); por dentro ahora usan los componentes base de ../ui.

export const claseCampo = claseControl;

// color (nombre heredado) → variante del sistema de diseño
const VARIANTE_POR_COLOR = {
  verde: 'primario',
  oscuro: 'primario',
  ambar: 'secundario',
  gris: 'secundario',
  rojo: 'peligro',
};

export function BotonAccion({ onClick, ocupado, color, icono, children, type = 'button' }) {
  return (
    <Boton
      type={type}
      onClick={onClick}
      disabled={ocupado}
      variante={VARIANTE_POR_COLOR[color] ?? 'secundario'}
      tamano="sm"
      icono={icono}
    >
      {children}
    </Boton>
  );
}

// Estado de la conexión en tiempo real: punto + texto (el color acompaña, no reemplaza al texto)
export function IndicadorEnVivo() {
  const conectado = useConexionEnVivo();
  return (
    <span className="inline-flex items-center gap-2 text-sm text-tinta-suave" role="status">
      <span
        className={`w-2 h-2 rounded-full ${conectado ? 'bg-ok-texto' : 'bg-tinta-tenue'}`}
        aria-hidden="true"
      />
      {conectado ? 'En vivo' : 'Sin conexión en vivo'}
    </span>
  );
}

// aviso: { tipo: 'error' | 'exito', texto }
export function Aviso({ aviso }) {
  if (!aviso) return null;
  return <AvisoBase tono={aviso.tipo === 'error' ? 'error' : 'ok'}>{aviso.texto}</AvisoBase>;
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
