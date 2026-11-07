import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Bell, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { useTitulo } from '../Encabezado';
import { leerToken } from '../../lib/api';

// Pantalla de la sala de espera.
// La abre un empleado desde el panel (usa su sesión): muestra el nombre corto de quien
// están llamando ("María R."), lo anuncia con una campanada y por voz.
// La lista de próximos turnos va sin nombres.
export default function PantallaPublica() {
  useTitulo('Pantalla de la sala');
  const [token] = useState(leerToken);
  const [estado, setEstado] = useState({ llamando: null, llamando_nombre: null, proximos: [], en_pausa: [] });
  const [conectado, setConectado] = useState(false);
  const [sinSesion, setSinSesion] = useState(!token);
  const [ahora, setAhora] = useState(() => new Date());
  const [iniciada, setIniciada] = useState(false);   // el navegador solo permite sonido tras un toque
  const [conSonido, setConSonido] = useState(true);
  const [completa, setCompleta] = useState(false);
  const [destacar, setDestacar] = useState(false);
  const voces = useVocesEspanol();
  const [voz, setVoz] = useState(() => leerVozGuardada());
  const vozActual = useRef(voz);
  vozActual.current = voz;
  const elegirVoz = (nombre) => {
    setVoz(nombre);
    try { localStorage.setItem(CLAVE_VOZ, nombre); } catch { /* sin almacenamiento */ }
  };
  const contenedor = useRef(null);
  const anterior = useRef(undefined);
  const sonido = useRef(false);
  sonido.current = iniciada && conSonido;

  // Estado inicial por HTTP y después en vivo por Socket.IO (ambos con la sesión del empleado)
  useEffect(() => {
    if (!token) return undefined;
    const cargar = () =>
      fetch('/api/pantalla', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => {
          if (r.status === 401) setSinSesion(true);
          return r.json();
        })
        .then((d) => d.ok && setEstado(d))
        .catch(() => {});
    cargar();
    const socket = io({ auth: { tipo: 'pantalla', token } });
    socket.on('connect', () => {
      setConectado(true);
      cargar();
    });
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', (e) => {
      setConectado(false);
      if (e.message === 'No autorizado') setSinSesion(true);
    });
    socket.on('turno_actual', setEstado);
    return () => socket.disconnect();
  }, [token]);

  // Al cambiar el turno llamado: se resalta y, si el sonido está activo, se anuncia
  useEffect(() => {
    const numero = estado.llamando;
    if (anterior.current === undefined) {
      anterior.current = numero; // primera carga: no se anuncia
      return undefined;
    }
    if (!numero || numero === anterior.current) {
      anterior.current = numero;
      return undefined;
    }
    anterior.current = numero;
    setDestacar(true);
    const t = setTimeout(() => setDestacar(false), 8000);
    if (sonido.current) anunciar(numero, estado.llamando_nombre, vozActual.current);
    return () => clearTimeout(t);
  }, [estado.llamando, estado.llamando_nombre]);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const alCambiar = () => setCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else contenedor.current?.requestFullscreen?.();
  };

  // Primer toque: habilita el audio del navegador y pasa a pantalla completa
  const iniciar = useCallback(() => {
    desbloquearAudio();
    setIniciada(true);
    contenedor.current?.requestFullscreen?.().catch(() => {});
  }, []);

  if (sinSesion) {
    return (
      <div className="bg-slate-950 text-white min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-3xl font-bold">Pantalla de la sala de espera</p>
        <p className="text-slate-300 text-lg max-w-lg">
          Esta pantalla la abre un empleado desde el panel de la farmacia, con su sesión iniciada.
          Si la sesión venció, vuelve a abrirla desde el panel.
        </p>
        <a href="/farmacia" className="bg-emerald-600 hover:bg-emerald-500 font-bold px-6 py-3 rounded-lg">Ir al panel de la farmacia</a>
      </div>
    );
  }

  return (
    <div ref={contenedor} className="bg-slate-950 text-white min-h-screen flex flex-col relative">
      <header className="flex items-center justify-between gap-4 px-8 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <img src="/img/logo-simbolo.png" alt="" className="w-12 h-12 object-contain" />
          <div>
            <p className="text-2xl font-black">Mediconnect · Farmacia</p>
            <p className="text-slate-400 capitalize">
              {ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-4xl font-bold tabular-nums">
            {ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
          </span>
          <span className={`w-3 h-3 rounded-full ${conectado ? 'bg-emerald-400' : 'bg-red-500'}`}
            title={conectado ? 'En vivo' : 'Sin conexión'} aria-label={conectado ? 'En vivo' : 'Sin conexión'} />
          <button type="button" onClick={() => setConSonido((v) => !v)}
            aria-label={conSonido ? 'Silenciar anuncios' : 'Activar anuncios'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer">
            {conSonido ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          {voces.length > 0 && (
            <select value={voz} onChange={(e) => elegirVoz(e.target.value)} aria-label="Voz de los anuncios"
              className="bg-slate-800 text-white text-sm rounded-lg px-2 py-2 max-w-56 cursor-pointer">
              <option value="">Voz automática</option>
              {voces.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
          )}
          <button type="button" onClick={() => anunciar(estado.llamando ?? 'V-001', estado.llamando ? estado.llamando_nombre : 'María Rojas', voz)}
            aria-label="Probar el anuncio" title="Probar el anuncio"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer">
            <Bell className="w-5 h-5" />
          </button>
          <button type="button" onClick={alternarPantallaCompleta}
            aria-label={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer">
            {completa ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[3fr_2fr]">
        <section className={`flex flex-col items-center justify-center p-10 text-center transition-colors duration-700 ${
          destacar ? 'bg-emerald-600' : 'bg-slate-900'
        }`} aria-live="assertive">
          <p className="text-3xl font-semibold text-slate-300 uppercase tracking-widest">Turno</p>
          <p className="text-[9rem] leading-none font-black my-4 tabular-nums">{estado.llamando ?? '—'}</p>
          {estado.llamando_nombre && (
            <p className="text-6xl font-bold mb-4">{estado.llamando_nombre}</p>
          )}
          <p className="text-3xl font-semibold">{estado.llamando ? 'Acérquese a la ventanilla' : 'Espere su turno'}</p>
        </section>

        <section className="p-8 space-y-8">
          <div>
            <h2 className="text-xl font-bold text-slate-400 uppercase tracking-wide mb-4">Próximos</h2>
            {estado.proximos.length === 0 ? (
              <p className="text-2xl text-slate-500">No hay turnos en espera</p>
            ) : (
              <ol className="space-y-3">
                {estado.proximos.map((n, i) => (
                  <li key={n} className={`flex items-center justify-between rounded-xl px-6 py-3 ${
                    i === 0 ? 'bg-slate-800 text-4xl' : 'bg-slate-900 text-3xl text-slate-300'
                  } font-black tabular-nums`}>
                    {n}
                    {i === 0 && <span className="text-base font-semibold text-emerald-400">Sigue</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {estado.en_pausa.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-amber-400 uppercase tracking-wide mb-2">
                Llamados que no se presentaron
              </h2>
              <p className="text-slate-400 mb-3">Si es su turno, acérquese a la ventanilla.</p>
              <div className="flex flex-wrap gap-3">
                {estado.en_pausa.map((n) => (
                  <span key={n} className="text-2xl font-black bg-amber-500/15 text-amber-300 px-4 py-2 rounded-lg tabular-nums">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Primer toque: el navegador no deja reproducir sonido sin una interacción */}
      {!iniciada && (
        <button type="button" onClick={iniciar}
          className="absolute inset-0 z-10 bg-slate-950/85 flex flex-col items-center justify-center gap-4 cursor-pointer">
          <Volume2 className="w-20 h-20 text-emerald-400" />
          <span className="text-4xl font-black">Toca para iniciar la pantalla</span>
          <span className="text-xl text-slate-300">Se activan el sonido y la pantalla completa</span>
        </button>
      )}
    </div>
  );
}

// ============================================================
// SONIDO: campanada de dos tonos (sin archivos) + anuncio por voz
// ============================================================
let contextoAudio = null;

function desbloquearAudio() {
  try {
    contextoAudio ??= new (window.AudioContext || window.webkitAudioContext)();
    contextoAudio.resume?.();
    // Algunos navegadores solo cargan las voces después de una interacción
    window.speechSynthesis?.getVoices();
  } catch {
    // Sin audio: queda el aviso visual
  }
}

// "Din-don": dos notas suaves que se apagan solas. Devuelve cuánto dura (ms).
function campanada() {
  try {
    const ctx = contextoAudio;
    if (!ctx) return 0;
    const inicio = ctx.currentTime + 0.05;
    [[880, 0], [660, 0.45]].forEach(([frecuencia, retraso]) => {
      const osc = ctx.createOscillator();
      const volumen = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      volumen.gain.setValueAtTime(0.0001, inicio + retraso);
      volumen.gain.exponentialRampToValueAtTime(0.4, inicio + retraso + 0.02);
      volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + retraso + 1.2);
      osc.connect(volumen).connect(ctx.destination);
      osc.start(inicio + retraso);
      osc.stop(inicio + retraso + 1.3);
    });
    return 1500;
  } catch {
    return 0;
  }
}

// ---------- Voces ----------
// Dependen del equipo y del navegador: Edge trae voces "naturales" de Colombia,
// Chrome las de Google; Firefox en Linux suele tener solo una voz robótica.
const CLAVE_VOZ = 'mediconect_voz_pantalla';

function leerVozGuardada() {
  try { return localStorage.getItem(CLAVE_VOZ) ?? ''; } catch { return ''; }
}

const esEspanol = (v) => v.lang?.toLowerCase().startsWith('es');

// Las voces cargan de forma asíncrona: se vuelven a leer cuando el navegador avisa
function useVocesEspanol() {
  const [voces, setVoces] = useState([]);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;
    const leer = () => {
      const todas = synth.getVoices();
      const es = todas.filter(esEspanol);
      // Primero las de Colombia y las "naturales" (suenan mejor)
      const puntaje = (v) => (v.lang === 'es-CO' ? 2 : 0) + (/natural|online|google/i.test(v.name) ? 1 : 0);
      setVoces((es.length ? es : todas).slice().sort((a, b) => puntaje(b) - puntaje(a)));
    };
    leer();
    synth.addEventListener?.('voiceschanged', leer);
    return () => synth.removeEventListener?.('voiceschanged', leer);
  }, []);
  return voces;
}

// La elegida; si no hay, la mejor en español disponible
function buscarVoz(nombre) {
  const todas = window.speechSynthesis?.getVoices() ?? [];
  return todas.find((v) => v.name === nombre)
    ?? todas.find((v) => v.lang === 'es-CO' && /natural|online/i.test(v.name))
    ?? todas.find((v) => v.lang === 'es-CO')
    ?? todas.find((v) => esEspanol(v) && /natural|online|google/i.test(v.name))
    ?? todas.find(esEspanol);
}

// Campanada y luego: "Turno V 0 1 4. María Rojas. Acérquese a la ventanilla." (se repite el turno)
function anunciar(numero, nombre, nombreVoz) {
  const espera = campanada();
  setTimeout(() => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      const deletreado = numero.replace('-', ' ').split('').join(' ');
      const texto = `Turno ${deletreado}.${nombre ? ` ${nombre.replace(/\.$/, '')}.` : ''} Acérquese a la ventanilla.`;
      synth.cancel();
      [texto, `Turno ${deletreado}.`].forEach((t) => {
        const frase = new SpeechSynthesisUtterance(t);
        frase.lang = 'es-CO';
        const voz = buscarVoz(nombreVoz);
        if (voz) {
          frase.voice = voz;
          frase.lang = voz.lang;
        }
        frase.rate = 0.9;
        synth.speak(frase);
      });
    } catch {
      // Sin voz disponible: queda la campanada y el aviso visual
    }
  }, espera);
}
