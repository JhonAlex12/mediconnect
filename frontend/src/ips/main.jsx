import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { ShieldCheck, LogOut } from 'lucide-react';
import FormulaMedica from './FormulaMedica';
import IngresoIps, { LogoIps } from './IngresoIps';
import { api } from '../lib/api.js';
import { leerTokenIps, guardarTokenIps } from './sesionIps';
import '../index.css';

// Quién puede emitir fórmulas de prueba (el backend también lo exige)
const PUEDEN_ENTRAR = ['medico', 'administrador'];

const iniciales = (nombre = '') =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'MD';

// Sistema de la IPS (simulado). Es una aplicación aparte de Mediconnect:
// el médico emite la fórmula aquí y la información viaja a la farmacia.
// Entra el médico (rol "medico") o un administrador; la sesión es la misma de las cuentas de Mediconnect.
function SistemaIps() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState('');

  // Al abrir: si ya hay una sesión guardada en este navegador, se comprueba
  useEffect(() => {
    const token = leerTokenIps();
    if (!token) {
      setCargando(false);
      return;
    }
    api('/auth/yo', { token })
      .then((d) => {
        if (PUEDEN_ENTRAR.includes(d.usuario?.rol)) setUsuario(d.usuario);
        else setAviso('Su cuenta no tiene acceso al sistema de la IPS. Ingrese con la cuenta del médico.');
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const ingresar = async (nombreUsuario, clave) => {
    const d = await api('/auth/login', { metodo: 'POST', cuerpo: { usuario: nombreUsuario, clave }, token: null });
    if (!PUEDEN_ENTRAR.includes(d.usuario?.rol)) {
      throw new Error('Esta cuenta no tiene acceso al sistema de la IPS. Ingrese con la cuenta del médico.');
    }
    guardarTokenIps(d.token);
    setAviso('');
    setUsuario(d.usuario);
  };

  const salir = () => {
    guardarTokenIps(null);
    setUsuario(null);
  };

  // El servidor rechazó la sesión (venció o se cerró en otra pestaña)
  const sesionVencida = useCallback(() => {
    guardarTokenIps(null);
    setAviso('Su sesión terminó. Ingrese de nuevo.');
    setUsuario(null);
  }, []);

  // Abre Mediconnect, en otra pestaña, con la fórmula lista para consultar
  const verEnMediconnect = (codigo, documento) =>
    window.open(`/paciente?${new URLSearchParams({ codigo, documento })}`, '_blank', 'noopener');

  if (cargando) return <div className="min-h-screen bg-slate-100" />;
  if (!usuario) return <IngresoIps onIngresar={ingresar} avisoInicial={aviso} />;

  const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-ips text-white relative overflow-hidden">
        {/* Franja roja de la marca, como en la pantalla de ingreso */}
        <span aria-hidden="true" className="absolute -right-10 top-0 h-full w-72 bg-gradient-to-r from-transparent via-ips-rojo/25 to-ips-rojo/60 skew-x-[-28deg]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <LogoIps claro className="text-[2.3rem] pt-1.5" />
            <div className="hidden sm:block leading-tight border-l border-white/30 pl-4">
              <p className="font-titulo font-bold">Consulta externa</p>
              <p className="text-xs text-white/75">Prescripción médica · entorno de prueba</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden lg:inline text-white/80 first-letter:uppercase">{hoy}</span>
            <span className="hidden sm:flex items-center gap-1.5 font-semibold bg-white/15 px-2.5 py-1 rounded-full">
              <ShieldCheck className="w-4 h-4" />
              Conectado con Mediconnect
            </span>
            <span className="flex items-center gap-2 bg-white text-ips-noche font-semibold pl-1.5 pr-3 py-1 rounded-full" title={`Sesión de ${usuario.usuario}`}>
              <span className="w-6 h-6 rounded-full bg-ips text-white text-xs font-bold flex items-center justify-center">
                {iniciales(usuario.nombre)}
              </span>
              {usuario.rol === 'medico' ? `Dr(a). ${usuario.nombre}` : usuario.nombre}
            </span>
            <button type="button" onClick={salir}
              className="flex items-center gap-1.5 text-white/90 hover:text-white hover:bg-white/15 px-2.5 py-1.5 rounded-md cursor-pointer">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="font-titulo text-2xl font-bold text-ips-noche">Nueva fórmula médica</h1>
          <p className="text-sm text-slate-500">Diligencie los datos del paciente y los medicamentos. Al enviarla, la fórmula queda disponible en la farmacia.</p>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <FormulaMedica onIrAPaciente={verEnMediconnect} onSesionVencida={sesionVencida} medico={usuario} />
      </main>

      <footer className="text-center text-xs text-slate-500 py-4">
        Entorno de prueba: reemplaza al sistema real de la IPS, que envía las fórmulas con su clave de acceso.
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SistemaIps />
  </React.StrictMode>
);
