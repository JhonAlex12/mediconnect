import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';

// Pantalla de la sala de espera: solo números de turno, nunca nombres
export default function PantallaPublica() {
  const [estado, setEstado] = useState({ llamando: null, proximos: [], en_pausa: [] });
  const [conectado, setConectado] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const [conSonido, setConSonido] = useState(false);
  const [completa, setCompleta] = useState(false);
  const [destacar, setDestacar] = useState(false);
  const contenedor = useRef(null);
  const anterior = useRef(undefined);
  const sonido = useRef(conSonido);
  sonido.current = conSonido;

  // Estado inicial por HTTP y después en vivo por Socket.IO
  useEffect(() => {
    const cargar = () =>
      fetch('/api/pantalla')
        .then((r) => r.json())
        .then((d) => d.ok && setEstado(d))
        .catch(() => {});
    cargar();
    const socket = io({ auth: { tipo: 'pantalla' } });
    socket.on('connect', () => {
      setConectado(true);
      cargar();
    });
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', () => setConectado(false));
    socket.on('turno_actual', setEstado);
    return () => socket.disconnect();
  }, []);

  // Al cambiar el turno llamado: se resalta y, si el sonido está activo, se anuncia
  useEffect(() => {
    const numero = estado.llamando;
    if (anterior.current === undefined) {
      anterior.current = numero; // primera carga: no se anuncia
      return;
    }
    if (!numero || numero === anterior.current) {
      anterior.current = numero;
      return;
    }
    anterior.current = numero;
    setDestacar(true);
    const t = setTimeout(() => setDestacar(false), 6000);
    if (sonido.current) anunciar(numero);
    return () => clearTimeout(t);
  }, [estado.llamando]);

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

  return (
    <div ref={contenedor} className="bg-slate-950 text-white rounded-2xl overflow-hidden min-h-[36rem] flex flex-col">
      <header className="flex items-center justify-between gap-4 px-8 py-4 border-b border-slate-800">
        <div>
          <p className="text-2xl font-black">Farmacia</p>
          <p className="text-slate-400 capitalize">
            {ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-4xl font-bold tabular-nums">
            {ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
          </span>
          <span className={`w-3 h-3 rounded-full ${conectado ? 'bg-emerald-400' : 'bg-red-500'}`}
            title={conectado ? 'En vivo' : 'Sin conexión'} aria-label={conectado ? 'En vivo' : 'Sin conexión'} />
          <button type="button" onClick={() => setConSonido((v) => !v)}
            aria-label={conSonido ? 'Silenciar anuncios' : 'Activar anuncios por voz'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer">
            {conSonido ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button type="button" onClick={alternarPantallaCompleta}
            aria-label={completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer">
            {completa ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[3fr_2fr]">
        <section className={`flex flex-col items-center justify-center p-10 transition-colors duration-700 ${
          destacar ? 'bg-emerald-600' : 'bg-slate-900'
        }`} aria-live="assertive">
          <p className="text-3xl font-semibold text-slate-300 uppercase tracking-widest">Turno</p>
          <p className="text-[9rem] leading-none font-black my-4 tabular-nums">{estado.llamando ?? '—'}</p>
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
    </div>
  );
}

// Anuncio por voz: "Turno V 0 0 5, acérquese a la ventanilla"
function anunciar(numero) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const deletreado = numero.replace('-', ' ').split('').join(' ');
    const frase = new SpeechSynthesisUtterance(`Turno ${deletreado}. Acérquese a la ventanilla.`);
    frase.lang = 'es-CO';
    synth.cancel();
    synth.speak(frase);
  } catch {
    // Sin voz disponible: queda el aviso visual
  }
}
