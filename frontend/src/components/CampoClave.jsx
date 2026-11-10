import React, { useState } from 'react';
import { ArrowBigUp, Eye, EyeOff } from 'lucide-react';

// Campo de contraseña con botón para verla y aviso de mayúsculas activadas.
// "oscuro": para fondos de color (el aviso se ve en claro).
export default function CampoClave({ id, valor, cambiar, className = '', oscuro = false, ...props }) {
  const [visible, setVisible] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);

  // getModifierState dice si Bloq Mayús está activo al escribir o al hacer clic
  const revisar = (e) => {
    if (typeof e.getModifierState === 'function') setMayusculas(e.getModifierState('CapsLock'));
  };

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          onChange={(e) => cambiar(e.target.value)}
          onKeyDown={revisar}
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
      {mayusculas && (
        <p role="status" className={`mt-1.5 text-sm font-semibold flex items-center gap-1.5 ${oscuro ? 'text-amber-200' : 'text-amber-700'}`}>
          <ArrowBigUp className="w-4 h-4" /> Las mayúsculas están activadas
        </p>
      )}
    </div>
  );
}
