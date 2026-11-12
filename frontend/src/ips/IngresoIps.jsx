import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, AlertCircle, Headset, Users, CalendarCheck, FilePlus2, Info } from 'lucide-react';

// Nombre de la IPS de prueba (el sistema que emite las fórmulas). Se cambia aquí.
export const NOMBRE_IPS = 'Salud IPS';

const CLAVE_RECORDAR = 'ips_usuario_recordado';
const leerRecordado = () => {
  try {
    return localStorage.getItem(CLAVE_RECORDAR) ?? '';
  } catch {
    return '';
  }
};
const guardarRecordado = (valor) => {
  try {
    if (valor) localStorage.setItem(CLAVE_RECORDAR, valor);
    else localStorage.removeItem(CLAVE_RECORDAR);
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
};

const AZUL = '#1b63c6';
const ROJO = '#e3263c';

// Logo de la IPS de prueba: palabra grande en azul con acento rojo y "ips" debajo
export function LogoIps({ className = '', claro = false }) {
  const color = claro ? '#ffffff' : AZUL;
  return (
    <span className={`inline-flex flex-col items-start leading-[0.8] font-titulo select-none ${className}`} aria-label={NOMBRE_IPS}>
      <span className="relative font-extrabold tracking-[-0.03em]" style={{ color }}>
        salud
        <svg viewBox="0 0 40 34" className="absolute top-[-0.2em] right-[0.6em] w-[0.42em] h-[0.36em]" aria-hidden="true">
          <path d="M20 31 C8 22 3 16 3 10 a8 8 0 0 1 17-3 a8 8 0 0 1 17 3 c0 6-5 12-17 21z" fill={ROJO} />
          <path d="M11 15 l6 6 l13-13" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-extrabold text-[0.5em] tracking-[-0.02em] ml-[0.08em] mt-[0.12em]" style={{ color }}>ips</span>
    </span>
  );
}

const VENTAJAS = [
  { icono: Users, titulo: 'Atiende pacientes', texto: ['Registra la consulta y', 'los datos del paciente.'] },
  { icono: CalendarCheck, titulo: 'Formula en línea', texto: ['Emite la fórmula y llega', 'al instante a la farmacia.'] },
  { icono: FilePlus2, titulo: 'Consulta fórmulas', texto: ['Revisa las fórmulas', 'enviadas y su código.'] },
];

// Inicio de sesión del sistema de la IPS (simulado). Usa las cuentas de Mediconnect:
// entra el médico (rol "medico") o un administrador.
export default function IngresoIps({ onIngresar, avisoInicial = '' }) {
  const [usuario, setUsuario] = useState(leerRecordado);
  const [clave, setClave] = useState('');
  const [recordar, setRecordar] = useState(() => leerRecordado() !== '');
  const [verClave, setVerClave] = useState(false);
  const [verAyudaClave, setVerAyudaClave] = useState(false);
  const [error, setError] = useState(avisoInicial);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !clave) {
      setError('Escribe tu usuario y tu contraseña.');
      return;
    }
    setError('');
    setEnviando(true);
    try {
      await onIngresar(usuario.trim(), clave);
      guardarRecordado(recordar ? usuario.trim() : '');
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
      setClave('');
      setEnviando(false);
    }
  };

  // Tamaños proporcionales al ancho de la pantalla (como la imagen de referencia), con mínimos legibles
  const campo =
    'w-full bg-white border border-slate-300 rounded-[0.6rem] lg:rounded-[calc(var(--u)*0.55)] text-slate-900 placeholder:text-slate-500 ' +
    'h-12 lg:h-[max(2.9rem,calc(var(--u)*3.05))] pl-12 lg:pl-[max(3rem,calc(var(--u)*3.9))] pr-4 text-base lg:text-[max(1rem,calc(var(--u)*1.08))] ' +
    'focus:outline-none focus:border-[#1b63c6] focus:ring-4 focus:ring-[#1b63c6]/15 transition';
  const iconoCampo = 'absolute left-4 lg:left-[max(1rem,calc(var(--u)*1.25))] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 w-5 h-5 lg:w-[max(1.25rem,calc(var(--u)*1.5))] lg:h-[max(1.25rem,calc(var(--u)*1.5))]';
  const etiqueta = 'block font-semibold text-slate-900 mb-2 text-base lg:text-[max(1rem,calc(var(--u)*1.13))]';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f2f6fc] font-sans"
      // Unidad de medida de la pantalla: 1% del ancho, sin pasar de lo que permite el alto (proporción 16:9).
      // Así todo crece o se encoge junto y la tarjeta siempre cabe, en monitores anchos, cuadrados o portátiles.
      style={{ '--u': 'min(1vw, 1.777vh)' }}>
      {/* ---------- Fondo: cielo, foto de la sede, onda azul y ventajas (pantallas grandes) ---------- */}
      <div className="hidden lg:block absolute inset-0" aria-hidden="true">
        {/* Cielo de respaldo mientras carga la foto */}
        <div className="absolute inset-y-0 left-0 w-[72%] bg-gradient-to-b from-[#4f8fdf] via-[#9cc3ef] to-[#e6eff9]"
          style={{ WebkitMaskImage: 'linear-gradient(to right, #000 60%, transparent 100%)', maskImage: 'linear-gradient(to right, #000 60%, transparent 100%)' }} />

        {/* Foto de la sede de la IPS: se desvanece a la derecha (hacia la tarjeta) */}
        <img
          src="/img/ips-sede-1600.webp"
          srcSet="/img/ips-sede-1000.webp 1000w, /img/ips-sede-1600.webp 1672w"
          sizes="calc(var(--u)*66)"
          alt=""
          className="absolute left-0 top-0 w-[66%] h-[74%] object-cover object-[92%_bottom]"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, #000 86%, transparent 100%)',
            maskImage: 'linear-gradient(to right, #000 86%, transparent 100%)',
          }} />

        {/* Onda inferior azul con franja clara y franja roja que sube hacia la tarjeta */}
        <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-[78%] h-[42%]">
          <defs>
            <linearGradient id="ipsAzul" x1="0" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor="#2f78d8" />
              <stop offset="1" stopColor="#1a56b0" />
            </linearGradient>
            <linearGradient id="ipsRojo" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#f06272" stopOpacity="0.55" />
              <stop offset="1" stopColor={ROJO} stopOpacity="1" />
            </linearGradient>
            <linearGradient id="ipsClaro" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#cfe0f6" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          
          <path d="M0 50 C170 -5 340 10 500 60 C640 105 760 125 1000 60 L1000 130 C780 190 640 165 500 120 C340 70 170 55 0 110 Z" fill="url(#ipsClaro)" />
          <path d="M0 95 C170 40 340 55 500 100 C640 140 760 165 1000 105 L1000 400 L0 400 Z" fill="url(#ipsAzul)" />
          
        <path d="M610 400 C710 330 830 235 1000 110 L1000 185 C870 280 770 355 715 400 Z" fill="url(#ipsRojo)" />
        </svg>

        {/* Ventajas sobre la onda */}
        <ul className="absolute left-[3%] bottom-[7%] w-[49%] grid grid-cols-3 text-white text-center">
          {VENTAJAS.map(({ icono: Icono, titulo, texto }, i) => (
            <li key={titulo} className={`px-[calc(var(--u)*1)] flex flex-col items-center ${i > 0 ? 'border-l border-white/35' : ''}`}>
              <Icono className="w-[calc(var(--u)*2.9)] h-[calc(var(--u)*2.9)] mb-[calc(var(--u)*1)]" strokeWidth={1.3} />
              <p className="font-titulo font-bold text-[max(0.95rem,calc(var(--u)*1.28))] leading-tight">{titulo}</p>
              <p className="text-[max(0.8rem,calc(var(--u)*0.98))] text-white/90 mt-[calc(var(--u)*0.4)] leading-snug">
                {texto[0]}<br />{texto[1]}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------- Fondo en tableta y celular: la foto detrás de la tarjeta ---------- */}
      <div className="lg:hidden absolute inset-0" aria-hidden="true">
        <img src="/img/ips-sede-1000.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-[78%_center]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b63c6]/10 via-[#1b63c6]/35 to-[#1a56b0]/85" />
      </div>

      {/* ---------- Tarjeta de ingreso ---------- */}
      <main className="relative z-10 min-h-screen flex items-center justify-center lg:justify-end p-4 sm:p-8 lg:py-[3.2vh] lg:pr-[calc(var(--u)*1.9)] lg:pl-0">
        <div className="w-full max-w-xl lg:max-w-none lg:w-[max(27rem,calc(var(--u)*41.2))] lg:min-h-[calc(var(--u)*52.65)] bg-white rounded-3xl lg:rounded-[calc(var(--u)*1.6)]
          shadow-[0_24px_70px_-24px_rgba(27,99,198,0.35)] flex flex-col px-6 py-10 sm:px-12 lg:px-[calc(var(--u)*4.2)] lg:pt-[calc(var(--u)*2.6)] lg:pb-[calc(var(--u)*1.8)]">

          <div className="flex justify-center">
            <LogoIps className="text-[4.5rem] lg:text-[max(4.5rem,calc(var(--u)*6.6))]" />
          </div>

          <h1 className="font-titulo font-bold text-center text-[#14306a] mt-4 lg:mt-[calc(var(--u)*0.9)] text-[1.6rem] sm:text-[1.8rem] lg:text-[max(1.6rem,calc(var(--u)*2.42))] leading-tight lg:whitespace-nowrap">
            Bienvenido a {NOMBRE_IPS}
          </h1>
          <p className="text-slate-700 text-center text-balance max-w-[34em] mx-auto mt-2 lg:mt-[calc(var(--u)*0.7)] text-lg lg:text-[max(1rem,calc(var(--u)*1.2))] leading-snug">
            Ingresa a tu cuenta para emitir fórmulas médicas, consultar pacientes y más.
          </p>

          <form onSubmit={enviar} noValidate className="mt-8 lg:mt-[calc(var(--u)*2.2)] space-y-5 lg:space-y-[calc(var(--u)*1.5)]">
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-red-800 text-sm lg:text-[max(0.875rem,calc(var(--u)*0.95))]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="ips-usuario" className={etiqueta}>Usuario</label>
              <div className="relative">
                <User className={iconoCampo} strokeWidth={1.6} />
                <input id="ips-usuario" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
                  placeholder="Ingresa tu usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)}
                  className={campo} autoFocus={!usuario} />
              </div>
            </div>

            <div>
              <label htmlFor="ips-clave" className={etiqueta}>Contraseña</label>
              <div className="relative">
                <Lock className={iconoCampo} strokeWidth={1.6} />
                <input id="ips-clave" type={verClave ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="Ingresa tu contraseña" value={clave} onChange={(e) => setClave(e.target.value)}
                  className={`${campo} pr-14`} autoFocus={!!usuario} />
                <button type="button" onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 lg:right-[calc(var(--u)*1)] top-1/2 -translate-y-1/2 p-1.5 text-slate-700 hover:text-slate-950 cursor-pointer">
                  {verClave
                    ? <EyeOff className="w-6 h-6 lg:w-[max(1.4rem,calc(var(--u)*1.6))] lg:h-[max(1.4rem,calc(var(--u)*1.6))]" strokeWidth={1.6} />
                    : <Eye className="w-6 h-6 lg:w-[max(1.4rem,calc(var(--u)*1.6))] lg:h-[max(1.4rem,calc(var(--u)*1.6))]" strokeWidth={1.6} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap text-base lg:text-[max(1rem,calc(var(--u)*1.08))]">
              <label className="flex items-center gap-3 text-slate-800 cursor-pointer">
                <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)}
                  className="w-5 h-5 lg:w-[max(1.25rem,calc(var(--u)*1.5))] lg:h-[max(1.25rem,calc(var(--u)*1.5))] rounded border-slate-400 accent-[#1b63c6]" />
                Recordarme
              </label>
              <button type="button" onClick={() => setVerAyudaClave((v) => !v)} aria-expanded={verAyudaClave}
                className="text-[#1b63c6] underline underline-offset-2 hover:text-[#134a99] cursor-pointer">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            {verAyudaClave && (
              <p className="flex items-start gap-2 text-sm lg:text-[max(0.875rem,calc(var(--u)*0.92))] text-slate-700 bg-[#eef4fb] border border-[#cfe0f5] rounded-xl p-3">
                <Info className="w-4 h-4 text-[#1b63c6] shrink-0 mt-0.5" />
                Pídele al administrador de Mediconnect que te asigne una nueva en el panel, sección Usuarios.
              </p>
            )}

            <div className="pt-1 lg:pt-[calc(var(--u)*0.3)]">
              <button type="submit" disabled={enviando}
                className="w-full bg-[#1b63c6] hover:bg-[#154f9f] disabled:opacity-60 text-white font-semibold rounded-[0.6rem] lg:rounded-[calc(var(--u)*0.55)]
                  h-14 lg:h-[max(3.2rem,calc(var(--u)*3.35))] text-lg lg:text-[max(1.1rem,calc(var(--u)*1.38))] shadow-sm transition cursor-pointer">
                {enviando ? 'Ingresando…' : 'Iniciar sesión'}
              </button>
            </div>

            <p className="text-center text-slate-700 text-base lg:text-[max(1rem,calc(var(--u)*1.08))]">
              ¿No tienes cuenta? <span className="font-bold text-[#1b63c6]">Pídela al administrador</span>
            </p>
          </form>

          <div className="mt-auto pt-8 lg:pt-[calc(var(--u)*2)]">
            <div className="border-t border-slate-200 pt-6 lg:pt-[calc(var(--u)*1.6)] flex items-center justify-center gap-4 lg:gap-[calc(var(--u)*1.2)]">
              <Headset className="w-10 h-10 lg:w-[calc(var(--u)*2.6)] lg:h-[calc(var(--u)*2.6)] text-slate-700 shrink-0" strokeWidth={1.3} />
              <div>
                <p className="font-medium text-slate-800 text-base lg:text-[max(1rem,calc(var(--u)*1.08))]">¿Necesitas ayuda?</p>
                <p className="text-slate-600 text-sm lg:text-[max(0.85rem,calc(var(--u)*0.98))]">
                  Comunícate con el administrador de Mediconnect
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
