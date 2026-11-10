import React, { useState } from 'react';
import { AlertCircle, LogIn, ShieldCheck } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import CampoClave from '../CampoClave';

// Ingreso al panel de la farmacia.
// Izquierda: foto de la sede con la marca (solo en pantallas medianas o más); derecha: el formulario.
const claseCampo =
  'w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 focus:bg-white focus:outline-none focus:border-marca-azul focus:ring-4 focus:ring-marca-azul/15 transition';

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
    <div className="max-w-md md:max-w-4xl mx-auto md:mt-[6vh] grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-xl bg-white border border-slate-200">
      {/* Izquierda: la sede */}
      <div className="relative hidden md:block min-h-[30rem]">
        <img src="/img/pantalla-sede.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-t from-marca-noche/95 via-marca-azul-oscuro/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-white">
          <p className="text-sm font-bold uppercase tracking-wider text-marca-verde-claro">Uso interno</p>
          <h2 className="font-titulo text-3xl font-extrabold leading-tight mt-1">Panel de la farmacia</h2>
          <p className="text-blue-100 mt-2">
            Fila de turnos, inventario y domicilios de la sede, en un solo lugar.
          </p>
        </div>
      </div>

      {/* Derecha: el formulario */}
      <form onSubmit={enviar} className="p-7 sm:p-10 flex flex-col justify-center gap-5">
        <div>
          <h1 className="font-titulo text-2xl sm:text-3xl font-extrabold text-marca-noche">Ingreso de empleados</h1>
          <p className="text-slate-500 mt-1">Usa el usuario y la contraseña que te dio el administrador.</p>
        </div>

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
          <label htmlFor="usuario" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Usuario
          </label>
          <input
            id="usuario"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="p. ej. caja1"
            className={`${claseCampo} placeholder:text-slate-400`}
          />
        </div>

        <div>
          <label htmlFor="clave" className="block text-sm font-semibold text-slate-700 mb-1.5">
            Contraseña
          </label>
          <CampoClave
            id="clave"
            autoComplete="current-password"
            valor={clave}
            cambiar={setClave}
            className={claseCampo}
          />
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full flex items-center justify-center gap-2 bg-marca-azul hover:bg-marca-azul-oscuro disabled:opacity-60 text-white font-bold py-3.5 rounded-lg shadow-md transition cursor-pointer"
        >
          <LogIn className="w-5 h-5" />
          {enviando ? 'Ingresando…' : 'Ingresar al panel'}
        </button>

        <div className="border-t border-slate-200 pt-4 space-y-2 text-sm text-slate-500">
          <p>¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.</p>
          <p className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-marca-verde" /> Acceso solo para personal autorizado
          </p>
        </div>
      </form>
    </div>
  );
}
