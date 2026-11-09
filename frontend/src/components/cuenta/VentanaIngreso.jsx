import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LogIn, UserPlus, X } from 'lucide-react';
import LoginEmpleado from '../farmacia/LoginEmpleado';
import { useCuenta } from '../../lib/cuenta';
import { claseInput } from './CamposPersonales';

// Ventana de ingreso sobre la página actual: pacientes (con cuenta) y empleados
export default function VentanaIngreso({ alCerrar }) {
  const [tipo, setTipo] = useState('paciente');
  const navegar = useNavigate();

  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && alCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alCerrar]);

  const ir = (ruta) => {
    alCerrar();
    navegar(ruta);
  };

  return (
    <div className="fixed inset-0 z-50 bg-marca-noche/60 flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div role="dialog" aria-modal="true" aria-label="Iniciar sesión" className="relative w-full max-w-md">
        <button type="button" onClick={alCerrar} aria-label="Cerrar"
          className="absolute -top-11 right-0 p-2 rounded text-white hover:bg-white/20 cursor-pointer">
          <X className="w-6 h-6" />
        </button>

        <div className="grid grid-cols-2 bg-white/15 rounded-t-xl overflow-hidden" role="tablist">
          {[['paciente', 'Soy paciente'], ['empleado', 'Soy empleado']].map(([id, texto]) => (
            <button key={id} type="button" role="tab" aria-selected={tipo === id} onClick={() => setTipo(id)}
              className={`py-3 font-bold transition cursor-pointer ${tipo === id ? 'bg-white text-marca-azul' : 'text-white hover:bg-white/10'}`}>
              {texto}
            </button>
          ))}
        </div>

        {tipo === 'paciente'
          ? <IngresoPaciente alEntrar={() => ir('/mi-cuenta')} alRegistrar={() => ir('/registro')} />
          : <div className="[&>div]:rounded-t-none"><LoginEmpleado alEntrar={() => ir('/farmacia')} /></div>}
      </div>
    </div>
  );
}

function IngresoPaciente({ alEntrar, alRegistrar }) {
  const { iniciarSesion } = useCuenta();
  const [documento, setDocumento] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await iniciarSesion(documento.trim(), clave);
      alEntrar();
    } catch (err) {
      setError(err.message);
      setClave('');
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="bg-white rounded-b-xl shadow-md p-6 space-y-5">
      <p className="text-slate-600">Consulta tus fórmulas, tu historial y pide tus medicamentos a domicilio.</p>
      {error && (
        <div role="alert" className="bg-red-50 border-l-4 border-red-600 p-3 rounded-r-lg flex items-start gap-2 text-red-800">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      <div>
        <label htmlFor="cuenta-documento" className="block text-sm font-bold text-slate-800 mb-2">Documento o correo</label>
        <input id="cuenta-documento" autoFocus autoComplete="username" required value={documento}
          onChange={(e) => setDocumento(e.target.value)} className={claseInput} />
      </div>
      <div>
        <label htmlFor="cuenta-clave" className="block text-sm font-bold text-slate-800 mb-2">Contraseña</label>
        <input id="cuenta-clave" type="password" autoComplete="current-password" required value={clave}
          onChange={(e) => setClave(e.target.value)} className={claseInput} />
      </div>
      <button type="submit" disabled={enviando}
        className="w-full flex items-center justify-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-60 text-white font-bold py-3 rounded-lg transition cursor-pointer">
        <LogIn className="w-5 h-5" /> {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <div className="border-t border-slate-200 pt-4 text-center">
        <p className="text-slate-600 text-sm">¿Aún no tienes cuenta?</p>
        <button type="button" onClick={alRegistrar}
          className="mt-2 inline-flex items-center gap-2 font-bold text-marca-azul hover:underline cursor-pointer">
          <UserPlus className="w-5 h-5" /> Crear cuenta
        </button>
      </div>
    </form>
  );
}
