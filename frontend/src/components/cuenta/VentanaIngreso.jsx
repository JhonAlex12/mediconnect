import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, LogIn, UserPlus, X } from 'lucide-react';
import CampoClave from '../CampoClave';
import { useCuenta } from '../../lib/cuenta';
import { useSesion } from '../../lib/sesion';
import { api } from '../../lib/api';

// Ventana de ingreso sobre la página actual: pacientes (con cuenta) y empleados.
// Izquierda: la marca y una foto (solo en pantallas medianas o más); derecha: el formulario.
const claseCampo =
  'w-full rounded-lg border-0 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-marca-verde/60';
const claseEtiqueta = 'block text-sm font-semibold text-blue-100 mb-1.5';
const claseBoton =
  'w-full flex items-center justify-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-60 text-white font-bold py-3.5 rounded-lg shadow-lg transition cursor-pointer';

function Marca({ claro = false }) {
  return (
    <p className="flex items-center gap-2">
      <img src="/img/logo-simbolo.png" alt="" className="w-9 h-9 object-contain" />
      <span className="font-titulo text-2xl font-extrabold tracking-tight">
        <span className={claro ? 'text-white' : 'text-marca-azul'}>Medi</span>
        <span className={claro ? 'text-marca-verde-claro' : 'text-marca-verde'}>connect</span>
      </span>
    </p>
  );
}

function AvisoError({ texto }) {
  if (!texto) return null;
  return (
    <div role="alert" className="bg-white/95 border-l-4 border-red-600 p-3 rounded-r-lg flex items-start gap-2 text-red-800 text-sm">
      <AlertCircle className="w-5 h-5 shrink-0" />
      <p>{texto}</p>
    </div>
  );
}

export default function VentanaIngreso({ alCerrar }) {
  const [tipo, setTipo] = useState('paciente');
  const [olvido, setOlvido] = useState(false);
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
    <div className="fixed inset-0 z-50 bg-marca-noche/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div role="dialog" aria-modal="true" aria-label="Iniciar sesión"
        className="relative w-full max-w-md md:max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl bg-white my-auto">

        {/* Izquierda: la marca */}
        <div className="hidden md:flex flex-col p-10 pb-8 bg-white">
          <Marca />
          <h2 className="font-titulo text-[2rem] leading-tight font-extrabold text-marca-noche mt-8">
            Cuidamos de lo<br /> que <span className="text-marca-verde">más importa</span>
          </h2>
          <p className="text-slate-500 mt-2">Tu salud, sin complicaciones.</p>
          <img src="/img/login-familia.webp" alt="" className="mt-8 w-full flex-1 min-h-0 object-cover rounded-2xl shadow-md" />
        </div>

        {/* Derecha: el formulario */}
        <div className="relative overflow-hidden bg-gradient-to-br from-marca-azul via-marca-azul to-marca-azul-oscuro text-white p-7 sm:p-10">
          {/* Círculo decorativo verde, como en el diseño de referencia */}
          <span aria-hidden="true" className="absolute -left-20 -bottom-24 w-64 h-64 rounded-full bg-marca-verde/30 blur-2xl" />

          <button type="button" onClick={alCerrar} aria-label="Cerrar"
            className="absolute top-3 right-3 z-10 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/15 cursor-pointer">
            <X className="w-6 h-6" />
          </button>

          <div className="relative space-y-6">
            <div className="md:hidden"><Marca claro /></div>
            <div>
              <h2 className="font-titulo text-3xl font-extrabold">
                {olvido ? 'Recupera tu acceso' : '¡Bienvenido de nuevo!'}
              </h2>
              <p className="text-blue-100 mt-1">
                {olvido
                  ? 'Te enviaremos un enlace a tu correo para crear una contraseña nueva.'
                  : 'Ingresa para consultar tus fórmulas, turnos y domicilios.'}
              </p>
            </div>

            {!olvido && (
              <div className="grid grid-cols-2 bg-white/15 rounded-full p-1" role="tablist">
                {[['paciente', 'Soy paciente'], ['empleado', 'Soy empleado']].map(([id, texto]) => (
                  <button key={id} type="button" role="tab" aria-selected={tipo === id} onClick={() => setTipo(id)}
                    className={`py-2 rounded-full text-sm font-bold transition cursor-pointer ${
                      tipo === id ? 'bg-white text-marca-azul shadow' : 'text-white/90 hover:bg-white/10'}`}>
                    {texto}
                  </button>
                ))}
              </div>
            )}

            {olvido ? (
              <OlvideClave alVolver={() => setOlvido(false)} />
            ) : tipo === 'paciente' ? (
              <IngresoPaciente alEntrar={() => ir('/mi-cuenta')} alRegistrar={() => ir('/registro')} alOlvidar={() => setOlvido(true)} />
            ) : (
              <IngresoEmpleado alEntrar={() => ir('/farmacia')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IngresoPaciente({ alEntrar, alRegistrar, alOlvidar }) {
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
    <form onSubmit={enviar} className="space-y-4">
      <AvisoError texto={error} />
      <div>
        <label htmlFor="cuenta-documento" className={claseEtiqueta}>Documento o correo</label>
        <input id="cuenta-documento" autoFocus autoComplete="username" required value={documento}
          onChange={(e) => setDocumento(e.target.value)} className={claseCampo} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="cuenta-clave" className="text-sm font-semibold text-blue-100">Contraseña</label>
          <button type="button" onClick={alOlvidar} className="text-sm font-semibold text-white hover:underline cursor-pointer">
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <CampoClave id="cuenta-clave" autoComplete="current-password" required valor={clave} cambiar={setClave}
          className={claseCampo} oscuro />
      </div>
      <button type="submit" disabled={enviando} className={claseBoton}>
        <LogIn className="w-5 h-5" /> {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <p className="text-center text-blue-100 text-sm pt-2">
        ¿Aún no tienes cuenta?{' '}
        <button type="button" onClick={alRegistrar} className="inline-flex items-center gap-1 font-bold text-white hover:underline cursor-pointer">
          <UserPlus className="w-4 h-4" /> Crear cuenta
        </button>
      </p>
    </form>
  );
}

function IngresoEmpleado({ alEntrar }) {
  const { iniciarSesion } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await iniciarSesion(usuario.trim(), clave);
      alEntrar();
    } catch (err) {
      setError(err.message);
      setClave('');
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <AvisoError texto={error} />
      <div>
        <label htmlFor="empleado-usuario" className={claseEtiqueta}>Usuario</label>
        <input id="empleado-usuario" autoFocus autoComplete="username" required value={usuario}
          onChange={(e) => setUsuario(e.target.value)} className={claseCampo} />
      </div>
      <div>
        <label htmlFor="empleado-clave" className={claseEtiqueta}>Contraseña</label>
        <CampoClave id="empleado-clave" autoComplete="current-password" required valor={clave} cambiar={setClave}
          className={claseCampo} oscuro />
      </div>
      <button type="submit" disabled={enviando} className={claseBoton}>
        <LogIn className="w-5 h-5" /> {enviando ? 'Ingresando…' : 'Ingresar al panel'}
      </button>
      <p className="text-center text-blue-100 text-sm pt-2">
        ¿Olvidaste tu contraseña? Pídele al administrador que te asigne una nueva.
      </p>
    </form>
  );
}

function OlvideClave({ alVolver }) {
  const [documento, setDocumento] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await api('/cuenta/olvide-clave', { metodo: 'POST', cuerpo: { documento: documento.trim() }, token: null });
      setListo(r.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4">
      {listo ? (
        <div role="status" className="bg-white/95 rounded-lg p-4 flex items-start gap-3 text-slate-800">
          <CheckCircle2 className="w-6 h-6 text-marca-verde shrink-0" />
          <p className="text-sm">{listo}</p>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <AvisoError texto={error} />
          <div>
            <label htmlFor="olvide-documento" className={claseEtiqueta}>Documento o correo de tu cuenta</label>
            <input id="olvide-documento" autoFocus autoComplete="username" required value={documento}
              onChange={(e) => setDocumento(e.target.value)} className={claseCampo} />
          </div>
          <button type="submit" disabled={enviando} className={claseBoton}>
            {enviando ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
        </form>
      )}
      <button type="button" onClick={alVolver}
        className="flex items-center gap-1.5 mx-auto text-sm font-semibold text-white hover:underline cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Volver a iniciar sesión
      </button>
    </div>
  );
}
