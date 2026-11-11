import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw, SendHorizontal, X } from 'lucide-react';
import { api } from '../lib/api';
import TextoEnriquecido from './TextoEnriquecido';

// Mediconnect Bot: responde con la información del sitio (preguntas del bot, Información al
// paciente y Salud al día). La búsqueda la hace el servidor de Mediconnect, sin servicios externos.

const BIENVENIDA = {
  de: 'bot',
  texto: '¡Hola! Soy **Mediconnect Bot**. Pregúntame sobre fórmulas, turnos, cuotas moderadoras, domicilios u horarios.',
};
// La conversación se conserva al cambiar de página (solo en esta pestaña)
const CLAVE = 'mediconect_chat_bot';
const MAX_GUARDADOS = 40;

function leerGuardados() {
  try {
    const m = JSON.parse(sessionStorage.getItem(CLAVE));
    return Array.isArray(m) && m.length ? m : [BIENVENIDA];
  } catch {
    return [BIENVENIDA];
  }
}

export default function ChatBot() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState(leerGuardados);
  const [temas, setTemas] = useState([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const fin = useRef(null);
  const entrada = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(mensajes.slice(-MAX_GUARDADOS)));
    } catch {
      // Sin almacenamiento: la conversación dura mientras la página esté abierta
    }
  }, [mensajes]);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, abierto, pensando]);

  // Temas sugeridos: se piden la primera vez que se abre el chat
  useEffect(() => {
    if (!abierto || temas.length) return;
    api('/bot/temas', { token: null }).then((r) => setTemas(r.temas)).catch(() => {});
  }, [abierto, temas.length]);

  useEffect(() => {
    if (!abierto) return;
    entrada.current?.focus();
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto]);

  // pregunta = { texto } escrito por el paciente, o { id, titulo } de un tema sugerido
  const enviar = async (pregunta) => {
    if (pensando) return;
    setMensajes((m) => [...m, { de: 'paciente', texto: pregunta.titulo ?? pregunta.texto }]);
    setPensando(true);
    try {
      const r = await api('/bot/preguntar', {
        metodo: 'POST', token: null, cuerpo: pregunta.id ? { id: pregunta.id } : { texto: pregunta.texto },
      });
      setMensajes((m) => [...m, { de: 'bot', ...r.respuesta, opciones: r.relacionadas }]);
    } catch (err) {
      setMensajes((m) => [...m, {
        de: 'bot', error: true,
        texto: err.estado === 429 ? err.message : 'No pude responder en este momento. Intenta de nuevo en un rato.',
      }]);
    } finally {
      setPensando(false);
    }
  };

  const escribir = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    enviar({ texto: t });
  };

  const reiniciar = () => setMensajes([BIENVENIDA]);
  const soloBienvenida = mensajes.length === 1;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {abierto && (
        <section role="dialog" aria-label="Chat con Mediconnect Bot"
          className="w-[calc(100vw-2rem)] max-w-sm h-[min(34rem,calc(100dvh-7rem))] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <header className="bg-marca-noche text-white px-4 py-3 flex items-center gap-3">
            <img src="/img/bot-96.webp" alt="" className="w-11 h-11" />
            <div className="flex-1 leading-tight">
              <p className="font-titulo font-extrabold">Medi<span className="text-marca-verde">connect</span> Bot</p>
              <p className="text-xs text-blue-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-marca-verde" /> En línea · respuestas de la farmacia
              </p>
            </div>
            {!soloBienvenida && (
              <button type="button" onClick={reiniciar} aria-label="Empezar de nuevo" title="Empezar de nuevo"
                className="p-1.5 rounded hover:bg-white/15 cursor-pointer">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar chat"
              className="p-1.5 rounded hover:bg-white/15 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto bg-marca-hielo p-4 space-y-3" aria-live="polite">
            {mensajes.map((m, i) => (
              <Mensaje key={i} m={m} ultimo={i === mensajes.length - 1} ocupado={pensando}
                alElegir={enviar} alSalir={() => setAbierto(false)} />
            ))}
            {soloBienvenida && temas.length > 0 && <Opciones opciones={temas} alElegir={enviar} ocupado={pensando} />}
            {pensando && (
              <div className="flex justify-start" aria-label="Escribiendo">
                <span className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
            )}
            <div ref={fin} />
          </div>

          <form onSubmit={escribir} className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
                placeholder="Escribe tu pregunta…" aria-label="Escribe tu pregunta" autoComplete="off"
                className="flex-1 min-w-0 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca-azul" />
              <button type="submit" disabled={pensando || !texto.trim()} aria-label="Enviar"
                className="w-10 h-10 shrink-0 rounded-full bg-marca-verde hover:bg-marca-verde-oscuro text-white flex items-center justify-center cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                <SendHorizontal className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 px-2">No escribas tu número de documento ni datos de salud.</p>
          </form>
        </section>
      )}

      <button type="button" onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? 'Cerrar chat' : 'Abrir chat con Mediconnect Bot'} aria-expanded={abierto}
        className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-white shadow-xl ring-1 ring-slate-200 hover:scale-105 transition cursor-pointer flex items-center justify-center">
        <img src="/img/bot-192.webp" alt="" className="w-[88%] h-[88%]" />
      </button>
    </div>
  );
}

function Mensaje({ m, ultimo, ocupado, alElegir, alSalir }) {
  if (m.de === 'paciente') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm bg-marca-azul text-white break-words">{m.texto}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-start">
        <div className={`max-w-[90%] rounded-2xl rounded-bl-sm px-4 py-2.5 border ${
          m.error ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <TextoEnriquecido texto={m.texto} tamano="text-sm" compacto />
          {m.enlace && (
            <Link to={m.enlace} onClick={alSalir}
              className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-marca-azul hover:underline">
              Ver más <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
      {/* Las opciones solo se pueden tocar en la última respuesta */}
      {ultimo && m.opciones?.length > 0 && <Opciones opciones={m.opciones} alElegir={alElegir} ocupado={ocupado} />}
    </div>
  );
}

function Opciones({ opciones, alElegir, ocupado }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <button key={o.id} type="button" disabled={ocupado} onClick={() => alElegir(o)}
          className="text-left text-sm bg-white border border-marca-verde text-marca-verde-oscuro hover:bg-marca-verde-claro rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-50">
          {o.titulo}
        </button>
      ))}
    </div>
  );
}
