import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { useTitulo } from '../Encabezado';

// Pantalla de la sala de espera: solo números de turno, nunca nombres
export default function PantallaPublica() {
  useTitulo('Pantalla de la sala');
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

  // Botones de control: discretos, pero con foco visible y etiqueta
  const claseControl =
    'inline-flex items-center gap-2 h-11 px-4 rounded-md border border-white/40 text-white text-base font-bold ' +
    'hover:bg-white/10 cursor-pointer focus-visible:outline-white';

  return (
    <div ref={contenedor} className="bg-[#0b1414] text-white min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-6 px-8 py-5 border-b border-white/20">
        <div>
          <p className="text-3xl font-bold">Farmacia</p>
          <p className="text-xl text-white/80 first-letter:uppercase">
            {ahora.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-5xl font-bold cifras">
            {ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
          </span>
          <span className="inline-flex items-center gap-2 text-base text-white/80" role="status">
            <span className={`w-3 h-3 rounded-full ${conectado ? 'bg-[#4ade80]' : 'bg-[#f87171]'}`} aria-hidden="true" />
            {conectado ? 'En vivo' : 'Sin conexión'}
          </span>
          <button type="button" onClick={() => setConSonido((v) => !v)} aria-pressed={conSonido} className={claseControl}>
            {conSonido ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
            {conSonido ? 'Voz activada' : 'Voz apagada'}
          </button>
          <button type="button" onClick={alternarPantallaCompleta} className={claseControl}>
            {completa ? <Minimize size={20} aria-hidden="true" /> : <Maximize size={20} aria-hidden="true" />}
            {completa ? 'Salir' : 'Pantalla completa'}
          </button>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[3fr_2fr]">
        {/* Turno que se está llamando: al cambiar, se invierten los colores unos segundos */}
        <section
          aria-live="assertive"
          aria-label="Turno llamado"
          className={`flex flex-col items-center justify-center px-8 py-12 border-b lg:border-b-0 lg:border-r border-white/20 transition-colors duration-500 ${
            destacar ? 'bg-white text-[#0b1414]' : ''
          }`}
        >
          <p className="text-[clamp(2rem,3vw,3rem)] font-bold uppercase tracking-widest">Turno</p>
          <p className="text-[clamp(8rem,18vw,18rem)] leading-none font-bold cifras my-6">
            {estado.llamando ?? '—'}
          </p>
          <p className="text-[clamp(1.75rem,2.6vw,2.75rem)] font-bold">
            {estado.llamando ? 'Acérquese a la ventanilla' : 'Espere su turno'}
          </p>
        </section>

        <section className="px-8 py-10 space-y-10" aria-label="Próximos turnos">
          <div>
            <h2 className="text-2xl font-bold uppercase tracking-wide text-white/80 mb-4">Próximos</h2>
            {estado.proximos.length === 0 ? (
              <p className="text-3xl text-white/70">No hay turnos en espera</p>
            ) : (
              <ol className="divide-y divide-white/20 border-y border-white/20">
                {estado.proximos.map((n, i) => (
                  <li key={n} className="flex items-baseline justify-between py-4">
                    <span className={`font-bold cifras ${i === 0 ? 'text-7xl' : 'text-5xl text-white/85'}`}>{n}</span>
                    {i === 0 && <span className="text-2xl font-bold">Sigue</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {estado.en_pausa.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wide text-white/80">No se presentaron</h2>
              <p className="text-xl text-white/80 mt-1 mb-4">Si es su turno, acérquese a la ventanilla.</p>
              <ul className="flex flex-wrap gap-3">
                {estado.en_pausa.map((n) => (
                  <li key={n} className="text-4xl font-bold cifras border-2 border-white/60 px-4 py-2 rounded-md">
                    {n}
                  </li>
                ))}
              </ul>
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
