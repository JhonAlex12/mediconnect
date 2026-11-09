import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SendHorizontal, X } from 'lucide-react';

// Mediconnect Bot: por ahora es solo la interfaz. Aún no responde preguntas;
// los temas sugeridos llevan a la página donde está la información.
const TEMAS = [
  ['¿Cómo consulto mi fórmula?', '/paciente'],
  ['¿Cuánto pago de cuota moderadora?', '/informacion#cuotas'],
  ['Quiero un domicilio', '/#domicilio'],
  ['Horario y ubicación', '/#ubicacion'],
];

const BIENVENIDA = {
  de: 'bot',
  texto: '¡Hola! Soy Mediconnect Bot. Muy pronto podré responder tus preguntas sobre fórmulas, turnos y domicilios.',
};

export default function ChatBot() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([BIENVENIDA]);
  const fin = useRef(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, abierto]);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto]);

  const elegir = (pregunta, enlace) =>
    setMensajes((m) => [
      ...m,
      { de: 'paciente', texto: pregunta },
      { de: 'bot', texto: 'Todavía estoy aprendiendo. Mientras tanto, aquí encuentras esa información:', enlace },
    ]);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {abierto && (
        <section role="dialog" aria-label="Chat con Mediconnect Bot"
          className="w-[calc(100vw-2rem)] max-w-sm h-[min(32rem,calc(100vh-7rem))] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <header className="bg-marca-noche text-white px-4 py-3 flex items-center gap-3">
            <img src="/img/bot-96.webp" alt="" className="w-11 h-11" />
            <div className="flex-1 leading-tight">
              <p className="font-titulo font-extrabold">Medi<span className="text-marca-verde">connect</span> Bot</p>
              <p className="text-xs text-blue-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Muy pronto disponible
              </p>
            </div>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar chat"
              className="p-1.5 rounded hover:bg-white/15 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto bg-marca-hielo p-4 space-y-3" aria-live="polite">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.de === 'bot' ? 'justify-start' : 'justify-end'}`}>
                <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.de === 'bot' ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm' : 'bg-marca-azul text-white rounded-br-sm'}`}>
                  {m.texto}
                  {m.enlace && (
                    <Link to={m.enlace} onClick={() => setAbierto(false)}
                      className="block mt-2 font-bold text-marca-azul underline">Ver información</Link>
                  )}
                </p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              {TEMAS.map(([pregunta, enlace]) => (
                <button key={pregunta} type="button" onClick={() => elegir(pregunta, enlace)}
                  className="text-sm bg-white border border-marca-verde text-marca-verde-oscuro hover:bg-marca-verde-claro rounded-full px-3 py-1.5 cursor-pointer">
                  {pregunta}
                </button>
              ))}
            </div>
            <div ref={fin} />
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="border-t border-slate-200 p-3 flex gap-2">
            <input disabled placeholder="Muy pronto podrás escribirme…" aria-label="Mensaje"
              className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm bg-slate-50 cursor-not-allowed" />
            <button type="submit" disabled aria-label="Enviar"
              className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center cursor-not-allowed">
              <SendHorizontal className="w-5 h-5" />
            </button>
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
