import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Accessibility, Bell, Maximize, Minimize, Pill, Volume2, VolumeX } from 'lucide-react';
import { useTitulo } from '../Encabezado';
import { leerToken } from '../../lib/api';

// Pantalla de la sala de espera (para el televisor).
// La abre un empleado desde el panel (usa su sesión). Muestra quién está en cada una de las
// 6 cajas, anuncia cada llamado con campanada y voz, y la fila de próximos va sin nombres.

const MENSAJES = [
  'Recuerda reclamar tus medicamentos antes de la fecha límite de tu fórmula.',
  'Ten listo tu documento y el valor de tu cuota moderadora.',
  'Caja 6: atención preferencial para adultos mayores, embarazadas y personas con discapacidad.',
  'Pide tu turno virtual desde el celular y evita la fila.',
];

const ESTADO_INICIAL = { cajas: [], ultimo: null, llamados: [], proximos: [], en_pausa: [] };

export default function PantallaPublica() {
  useTitulo('Pantalla de la sala');
  const [token] = useState(leerToken);
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [conectado, setConectado] = useState(false);
  const [sinSesion, setSinSesion] = useState(!token);
  const [ahora, setAhora] = useState(() => new Date());
  const [iniciada, setIniciada] = useState(false);   // el navegador solo permite sonido tras un toque
  const [conSonido, setConSonido] = useState(true);
  const [completa, setCompleta] = useState(false);
  const [aviso, setAviso] = useState(null);          // llamado que se muestra en grande unos segundos
  const [mensaje, setMensaje] = useState(0);
  const voces = useVocesEspanol();
  const [voz, setVoz] = useState(() => leerVozGuardada());
  const contenedor = useRef(null);
  const vistos = useRef(null);                       // llamados ya anunciados (null: aún no llega el primer estado)
  const ocultar = useRef(null);
  const config = useRef({});
  const habla = useUnicaVoz();                       // otra pestaña con la pantalla ya habla: esta queda en silencio
  config.current = { sonido: iniciada && conSonido && habla, voz };

  const elegirVoz = (nombre) => {
    setVoz(nombre);
    try { localStorage.setItem(CLAVE_VOZ, nombre); } catch { /* sin almacenamiento */ }
  };

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

  // Cada llamado nuevo (en cualquier caja) se muestra en grande y se anuncia.
  // Si llegan varios casi al tiempo, van a una cola: uno no corta al otro.
  useEffect(() => {
    if (estado === ESTADO_INICIAL) return;
    const llamados = estado.llamados ?? (estado.ultimo ? [estado.ultimo] : []);
    if (vistos.current === null) {
      vistos.current = new Set(llamados.map((l) => l.id)); // primera carga: no se anuncia
      return;
    }
    llamados.filter((l) => !vistos.current.has(l.id)).forEach((l) => {
      vistos.current.add(l.id);
      const mostrar = () => {
        clearTimeout(ocultar.current);
        setAviso(l);
      };
      const esconderLuego = (ms) => {
        clearTimeout(ocultar.current);
        ocultar.current = setTimeout(() => setAviso(null), ms);
      };
      if (config.current.sonido) {
        encolarAnuncio(l, config.current.voz, mostrar, () => esconderLuego(3000));
      } else {
        mostrar();
        esconderLuego(9000);
      }
    });
  }, [estado]);

  useEffect(() => () => clearTimeout(ocultar.current), []);

  // Reloj y mensajes de la franja inferior
  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 10000);
    const rotar = setInterval(() => setMensaje((m) => (m + 1) % MENSAJES.length), 12000);
    return () => { clearInterval(reloj); clearInterval(rotar); };
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
      <div className="bg-marca-noche text-white min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-3xl font-bold">Pantalla de la sala de espera</p>
        <p className="text-blue-100 text-lg max-w-lg">
          Esta pantalla la abre un empleado desde el panel de la farmacia, con su sesión iniciada.
          Si la sesión venció, vuelve a abrirla desde el panel.
        </p>
        <a href="/farmacia" className="bg-marca-verde hover:bg-marca-verde-oscuro font-bold px-6 py-3 rounded-lg">Ir al panel de la farmacia</a>
      </div>
    );
  }

  const [hh, mm] = ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).split(':');
  const ampm = ahora.getHours() < 12 ? 'AM' : 'PM';

  return (
    <div ref={contenedor} className="relative h-screen w-screen overflow-hidden bg-white text-marca-noche select-none">
      <Fondo />

      <div className="relative h-full grid grid-cols-[58fr_42fr] grid-rows-[1fr_auto]">
        {/* ---------- Izquierda: logo y tabla de cajas ---------- */}
        <div className="pl-[5vw] pr-[2vw] pt-[5vh] flex flex-col min-h-0">
          <div className="flex items-center gap-[1vw]">
            <img src="/img/logo-simbolo.png" alt="" className="h-[9vh] w-auto drop-shadow" />
            <p className="font-titulo font-extrabold text-[5.5vh] leading-none text-white drop-shadow">
              Medi<span className="text-marca-verde-claro">connect</span>
            </p>
          </div>

          <div className="mt-[3vh] rounded-[1.5vh] bg-white p-[0.6vh] shadow-2xl">
            <table className="w-full border-separate border-spacing-[0.5vh] text-left">
              <thead>
                <tr className="text-white font-titulo font-bold text-[3vh] tracking-wide">
                  <th className="bg-marca-noche px-[1.5vw] py-[1.4vh] rounded-tl-[1vh] w-[52%]">PACIENTE</th>
                  <th className="bg-marca-noche px-[1vw] py-[1.4vh] text-center">TURNO</th>
                  <th className="bg-marca-noche px-[1vw] py-[1.4vh] text-center rounded-tr-[1vh]">CAJA</th>
                </tr>
              </thead>
              <tbody>
                {estado.cajas.map((c) => {
                  const resaltar = aviso && aviso.caja === c.caja;
                  return (
                    <tr key={c.caja} className={resaltar ? 'animate-pulse' : undefined}>
                      <td className={`px-[1.5vw] h-[7.4vh] text-[3.8vh] font-semibold truncate ${
                        resaltar ? 'bg-marca-verde text-white' : 'bg-marca-noche text-white'}`}>
                        {c.nombre ?? <span className="text-white/40">—</span>}
                      </td>
                      <td className={`text-center font-titulo font-extrabold text-[5vh] tabular-nums ${
                        resaltar ? 'bg-marca-verde-claro' : 'bg-slate-100'}`}>
                        {c.numero ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="text-center bg-slate-200/80">
                        <span className="font-titulo font-extrabold text-[5vh] leading-none">{c.caja}</span>
                        {c.preferencial && (
                          <span className="flex items-center justify-center gap-1 text-[1.7vh] font-bold text-marca-verde-oscuro">
                            <Accessibility className="w-[2vh] h-[2vh]" /> Preferencial
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Próximos (sin nombres) y llamados que no se presentaron */}
            <div className="px-[1.2vw] py-[1vh] text-[2.5vh] font-semibold flex flex-wrap gap-x-[2vw] gap-y-[0.3vh]">
              <p>
                <span className="text-slate-500">Próximos: </span>
                <span className="tabular-nums">{estado.proximos.length ? estado.proximos.join('  ·  ') : 'nadie en espera'}</span>
              </p>
              {estado.en_pausa.length > 0 && (
                <p className="text-amber-700">
                  <span>No se presentaron: </span>
                  <span className="tabular-nums">{estado.en_pausa.join('  ·  ')}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ---------- Derecha: sede y bienvenida ---------- */}
        <div className="pr-[4vw] pl-[1vw] pt-[5vh] flex flex-col items-center min-h-0">
          <h1 className="font-titulo font-extrabold text-[6.5vh] leading-[1.05] text-center">
            Sede Principal<br /><span className="text-marca-verde-oscuro">Mediconnect</span>
          </h1>
          <img src="/img/pantalla-sede.webp" alt="Sede de Mediconnect"
            className="mt-[3vh] w-full max-h-[45vh] object-cover rounded-[4vh] shadow-xl" />
          <p className="mt-[3vh] font-titulo font-black text-[6vh] leading-none">BIENVENIDOS</p>
          <p className="text-[3.2vh] mt-[0.8vh]">Estamos para cuidarte</p>
        </div>

        {/* ---------- Franja inferior: mensajes y hora ---------- */}
        <div className="col-span-2 relative h-[15vh] flex items-center">
          <div className="ml-[3vw] mr-[18vw] flex-1 h-[10vh] rounded-r-full rounded-l-[2vh] bg-marca-verde flex items-center gap-[2vw] px-[2vw] text-white shadow-lg">
            <Pill className="w-[6vh] h-[6vh] shrink-0" strokeWidth={1.5} />
            <span className="w-px h-[6vh] bg-white/50" aria-hidden="true" />
            <p key={mensaje} className="text-[3.3vh] font-semibold leading-tight animate-[aparecer_0.8s_ease]">{MENSAJES[mensaje]}</p>
          </div>
          <div className="absolute right-0 bottom-0 w-[17vw] h-[19vh] rounded-tl-[12vh] bg-gradient-to-br from-marca-azul to-marca-verde-oscuro text-white flex flex-col items-center justify-center">
            <p className="font-titulo font-extrabold text-[8vh] leading-none tabular-nums">{hh}:{mm.slice(0, 2)}</p>
            <p className="font-titulo font-bold text-[3.5vh] leading-none mt-[0.5vh]">{ampm}</p>
          </div>
        </div>
      </div>

      {/* Controles discretos (arriba a la derecha) */}
      <div className="absolute top-[1.5vh] right-[1.5vw] z-20 flex items-center gap-2 opacity-30 hover:opacity-100 transition">
        <span className={`w-3 h-3 rounded-full ${conectado ? 'bg-emerald-500' : 'bg-red-500'}`}
          title={conectado ? 'En vivo' : 'Sin conexión'} aria-label={conectado ? 'En vivo' : 'Sin conexión'} />
        {voces.length > 0 && (
          <select value={voz} onChange={(e) => elegirVoz(e.target.value)} aria-label="Voz de los anuncios"
            className="bg-white border border-slate-300 text-sm rounded-lg px-2 py-1.5 max-w-56 cursor-pointer">
            <option value="">Voz automática</option>
            {voces.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
          </select>
        )}
        <Control onClick={() => setConSonido((v) => !v)} etiqueta={conSonido ? 'Silenciar anuncios' : 'Activar anuncios'}>
          {conSonido ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Control>
        <Control onClick={() => encolarAnuncio(estado.ultimo ?? { numero: 'V-001', nombre: 'María Rojas', caja: 1 }, voz)} etiqueta="Probar el anuncio">
          <Bell className="w-5 h-5" />
        </Control>
        <Control onClick={alternarPantallaCompleta} etiqueta={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}>
          {completa ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </Control>
      </div>

      {/* Aviso grande del llamado */}
      {aviso && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-marca-noche/60 backdrop-blur-sm" aria-live="assertive">
          <div className="bg-white rounded-[4vh] shadow-2xl px-[6vw] py-[5vh] text-center border-[1vh] border-marca-verde animate-[aparecer_0.5s_ease]">
            <p className="font-titulo font-bold text-[4vh] text-slate-500 tracking-widest">TURNO</p>
            <p className="font-titulo font-black text-[16vh] leading-none tabular-nums">{aviso.numero}</p>
            {aviso.nombre && <p className="text-[6vh] font-bold mt-[1vh]">{aviso.nombre}</p>}
            <p className="mt-[2vh] inline-block bg-marca-verde text-white font-titulo font-extrabold text-[6vh] px-[3vw] py-[1vh] rounded-[2vh]">
              Caja {aviso.caja}
            </p>
          </div>
        </div>
      )}

      {/* Primer toque: el navegador no deja reproducir sonido sin una interacción */}
      {!iniciada && (
        <button type="button" onClick={iniciar}
          className="absolute inset-0 z-40 bg-marca-noche/85 text-white flex flex-col items-center justify-center gap-4 cursor-pointer">
          <Volume2 className="w-20 h-20 text-marca-verde" />
          <span className="text-4xl font-black">Toca para iniciar la pantalla</span>
          <span className="text-xl text-blue-100">Se activan el sonido y la pantalla completa</span>
        </button>
      )}

      <style>{'@keyframes aparecer { from { opacity: 0; transform: translateY(1.5vh) scale(0.98); } to { opacity: 1; transform: none; } }'}</style>
    </div>
  );
}

function Control({ onClick, etiqueta, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={etiqueta} title={etiqueta}
      className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer">
      {children}
    </button>
  );
}

// Fondo con formas curvas de la marca (azul → verde agua), como la imagen de referencia
function Fondo() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fondo-azul" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2257c5" />
          <stop offset="0.55" stopColor="#163f99" />
          <stop offset="1" stopColor="#14ada2" />
        </linearGradient>
        <linearGradient id="fondo-verde" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#14ada2" />
          <stop offset="1" stopColor="#2257c5" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="#f1f8fb" />
      {/* Mancha principal a la izquierda */}
      <path fill="url(#fondo-azul)"
        d="M0 0 H560 C640 40 600 150 520 190 C430 235 460 330 560 380 C690 445 760 560 700 690 C660 780 560 800 470 760 C380 720 330 760 260 820 C190 880 80 880 0 860 Z" />
      {/* Ola inferior */}
      <path fill="url(#fondo-verde)" opacity="0.9"
        d="M0 760 C220 700 420 790 650 760 C900 725 1100 690 1300 740 C1450 778 1540 760 1600 730 V900 H0 Z" />
      {/* Detalles */}
      <circle cx="90" cy="250" r="22" fill="#14ada2" />
      <ellipse cx="110" cy="420" rx="40" ry="62" fill="#14ada2" opacity="0.85" />
      <path fill="#e0f5f3" opacity="0.6" d="M1600 0 V160 C1500 120 1440 40 1460 0 Z" />
    </svg>
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

// "F-013" → "efe 13": la letra con su nombre y el número entero (la voz dice "trece", no "cero uno tres")
const LETRAS = { F: 'efe', V: 've', P: 'pe', R: 'erre' };
function turnoHablado(numero) {
  const [letra, cifras] = String(numero).split('-');
  if (!cifras) return numero;
  return `${LETRAS[letra] ?? letra} ${Number.parseInt(cifras, 10)}`;
}

// Si en el mismo navegador hay dos pestañas con la pantalla (p. ej. dos auxiliares la abrieron),
// solo una anuncia con voz; si esa se cierra, la otra toma el turno sola.
function useUnicaVoz() {
  const [habla, setHabla] = useState(!navigator.locks); // sin soporte: todas hablan, como antes
  useEffect(() => {
    if (!navigator.locks) return undefined;
    const control = new AbortController();
    navigator.locks
      .request('mediconect-voz-pantalla', { signal: control.signal }, () => {
        setHabla(true);
        return new Promise((liberar) => control.signal.addEventListener('abort', liberar));
      })
      .catch(() => {});
    return () => control.abort();
  }, []);
  return habla;
}

// ---------- Cola de anuncios ----------
// Cada llamado espera a que termine el anterior (campanada + las dos frases).
const cola = [];
let anunciando = false;

function encolarAnuncio(llamado, nombreVoz, alEmpezar, alTerminar) {
  cola.push({ llamado, nombreVoz, alEmpezar, alTerminar });
  if (!anunciando) siguienteAnuncio();
}

function siguienteAnuncio() {
  const item = cola.shift();
  if (!item) {
    anunciando = false;
    return;
  }
  anunciando = true;
  item.alEmpezar?.();
  anunciar(item.llamado, item.nombreVoz, () => {
    item.alTerminar?.();
    setTimeout(siguienteAnuncio, 700); // pausa breve entre un llamado y otro
  });
}

// Campanada y luego: "Turno V 0 0 5. Carlos Gómez. Caja 6." (se repite turno y caja).
// alTerminar se llama una sola vez cuando acaba la voz (o por tiempo, si el navegador no avisa).
function anunciar({ numero, nombre, caja }, nombreVoz, alTerminar = () => {}) {
  let terminado = false;
  const terminar = () => {
    if (terminado) return;
    terminado = true;
    clearTimeout(seguro);
    alTerminar();
  };
  const dicho = turnoHablado(numero);
  const frases = [`Turno ${dicho}.${nombre ? ` ${nombre}.` : ''} Caja ${caja}.`, `Turno ${dicho}, caja ${caja}.`];
  // Por si el navegador nunca avisa el final: tiempo máximo según el largo del texto
  const seguro = setTimeout(terminar, 4000 + frases.join(' ').length * 120);

  const espera = campanada();
  setTimeout(() => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return terminar();
      synth.cancel(); // solo limpia restos atascados: el anuncio anterior ya terminó
      frases.forEach((t, i) => {
        const frase = new SpeechSynthesisUtterance(t);
        frase.lang = 'es-CO';
        const voz = buscarVoz(nombreVoz);
        if (voz) {
          frase.voice = voz;
          frase.lang = voz.lang;
        }
        frase.rate = 0.9;
        if (i === frases.length - 1) {
          frase.onend = terminar;
          frase.onerror = terminar;
        }
        synth.speak(frase);
      });
    } catch {
      // Sin voz disponible: queda la campanada y el aviso visual
      terminar();
    }
  }, espera);
}
