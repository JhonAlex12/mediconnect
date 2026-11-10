import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import SitioPublico, { useAbrirIngreso } from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import CampoClave from '../components/CampoClave';
import { Aviso } from '../components/farmacia/comunes';
import { claseInput } from '../components/cuenta/CamposPersonales';
import { api } from '../lib/api';

// Se abre desde el enlace del correo: /restablecer-clave?token=...
export default function RestablecerClave() {
  useTitulo('Crear contraseña nueva');
  const [params] = useSearchParams();
  const abrirIngreso = useAbrirIngreso();
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [aviso, setAviso] = useState(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (clave !== clave2) {
      setAviso({ tipo: 'error', texto: 'Las contraseñas no coinciden' });
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      await api('/cuenta/restablecer-clave', { metodo: 'POST', cuerpo: { token: params.get('token') ?? '', clave }, token: null });
      setListo(true);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SitioPublico>
      <div className="bg-marca-hielo py-16 px-4">
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          {listo ? (
            <div className="text-center">
              <CheckCircle2 className="w-14 h-14 text-marca-verde mx-auto" />
              <h1 className="font-titulo text-2xl font-extrabold text-marca-noche mt-4">¡Contraseña actualizada!</h1>
              <p className="text-slate-600 mt-2">Ya puedes iniciar sesión con tu contraseña nueva.</p>
              <button type="button" onClick={abrirIngreso}
                className="mt-6 bg-marca-azul hover:bg-marca-azul-oscuro text-white font-bold px-6 py-3 rounded-lg cursor-pointer">
                Iniciar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-5">
              <div className="text-center">
                <KeyRound className="w-12 h-12 text-marca-azul mx-auto" />
                <h1 className="font-titulo text-2xl font-extrabold text-marca-noche mt-3">Crea tu contraseña nueva</h1>
                <p className="text-slate-600 text-sm mt-1">Mínimo 8 caracteres, con letras y números.</p>
              </div>
              <Aviso aviso={aviso} />
              <div>
                <label htmlFor="nueva-clave" className="block text-sm font-bold text-slate-800 mb-1.5">Contraseña nueva</label>
                <CampoClave id="nueva-clave" valor={clave} cambiar={setClave} autoComplete="new-password" minLength={8} required autoFocus className={claseInput} />
              </div>
              <div>
                <label htmlFor="nueva-clave2" className="block text-sm font-bold text-slate-800 mb-1.5">Repítela</label>
                <CampoClave id="nueva-clave2" valor={clave2} cambiar={setClave2} autoComplete="new-password" required className={claseInput} />
              </div>
              <button type="submit" disabled={enviando}
                className="w-full bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-60 text-white font-bold py-3 rounded-lg cursor-pointer">
                {enviando ? 'Guardando…' : 'Guardar contraseña'}
              </button>
              <p className="text-center text-sm"><Link to="/" className="text-marca-azul font-semibold hover:underline">Volver al inicio</Link></p>
            </form>
          )}
        </div>
      </div>
    </SitioPublico>
  );
}
