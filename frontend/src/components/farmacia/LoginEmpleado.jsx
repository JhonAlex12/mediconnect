import React, { useState } from 'react';
import { AlertCircle, LogIn, Lock } from 'lucide-react';
import { useSesion } from '../../lib/sesion';

// alEntrar: se llama después de un ingreso correcto (p. ej. para ir al panel)
export default function LoginEmpleado({ alEntrar }) {
  const { iniciarSesion } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!usuario.trim() || !clave) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setEnviando(true);
    try {
      await iniciarSesion(usuario.trim(), clave);
      alEntrar?.();
    } catch (err) {
      setError(err.message);
      setClave('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
      <div className="bg-marca-azul text-white px-6 py-4 flex items-center gap-3">
        <Lock className="w-5 h-5" />
        <h2 className="text-xl font-bold">Ingreso de empleados</h2>
      </div>

      <form onSubmit={enviar} className="p-6 space-y-5">
        <p className="text-slate-600">
          Panel de la farmacia. Solo para auxiliares y administradores.
        </p>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border-l-4 border-red-600 p-3 rounded-r-lg flex items-start gap-2 text-red-800"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="usuario" className="block text-sm font-bold text-slate-800 mb-2">
            Usuario
          </label>
          <input
            id="usuario"
            type="text"
            autoComplete="username"
            autoFocus
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600"
          />
        </div>

        <div>
          <label htmlFor="clave" className="block text-sm font-bold text-slate-800 mb-2">
            Contraseña
          </label>
          <input
            id="clave"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600"
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full flex items-center justify-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-60 text-white font-bold py-3 rounded-lg transition cursor-pointer"
        >
          <LogIn className="w-5 h-5" />
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
