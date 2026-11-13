import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowBigUp, Eye, EyeOff } from 'lucide-react';

// Campo de contraseña con botón para verla y aviso de mayúsculas activadas.
// "oscuro": para fondos de color (el aviso se ve en claro).
// "sinEspacios": no deja escribir ni pegar espacios y avisa que no están permitidos.
export default function CampoClave({ id, valor, cambiar, className = '', oscuro = false, sinEspacios = false, ...props }) {
  const [visible, setVisible] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [avisoEspacio, setAvisoEspacio] = useState(false);
  const temporizador = useRef(null);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const mostrarAvisoEspacio = () => {
    setAvisoEspacio(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAvisoEspacio(false), 4000);
  };

  // getModifierState dice si Bloq Mayús está activo al escribir o al hacer clic
  const revisar = (e) => {
    if (typeof e.getModifierState === 'function') setMayusculas(e.getModifierState('CapsLock'));
  };

  const alTeclear = (e) => {
    revisar(e);
    if (sinEspacios && e.key === ' ') {
      e.preventDefault();
      mostrarAvisoEspacio();
    }
  };

  // También cubre lo pegado o dictado: se quitan los espacios y se avisa
  const alCambiar = (e) => {
    const texto = e.target.value;
    if (sinEspacios && /\s/.test(texto)) {
      mostrarAvisoEspacio();
      cambiar(texto.replace(/\s/g, ''));
      return;
    }
    cambiar(texto);
  };

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          onChange={alCambiar}
          onKeyDown={alTeclear}
          onKeyUp={revisar}
          onClick={revisar}
          onBlur={() => setMayusculas(false)}
          className={`${className} pr-12`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {avisoEspacio && (
        <p role="alert" className={`mt-1.5 text-sm font-semibold flex items-center gap-1.5 ${oscuro ? 'text-red-200' : 'text-red-700'}`}>
          <AlertCircle className="w-4 h-4" /> El espacio no está permitido en la contraseña
        </p>
      )}
      {mayusculas && (
        <p role="status" className={`mt-1.5 text-sm font-semibold flex items-center gap-1.5 ${oscuro ? 'text-amber-200' : 'text-amber-700'}`}>
          <ArrowBigUp className="w-4 h-4" /> Las mayúsculas están activadas
        </p>
      )}
    </div>
  );
}
