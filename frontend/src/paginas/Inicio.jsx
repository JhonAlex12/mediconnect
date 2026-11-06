import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SitioPublico from '../components/SitioPublico';
import Carrusel from '../components/Carrusel';
import { useTitulo } from '../components/Encabezado';

const SERVICIOS = [
  {
    titulo: 'Consulta de disponibilidad',
    texto: 'Con el código de tu fórmula y tu documento ves si cada medicamento está disponible antes de salir de casa.',
  },
  {
    titulo: 'Turno virtual',
    texto: 'Pide tu turno desde el celular. Tus medicamentos quedan apartados mientras llegas.',
  },
  {
    titulo: 'Avisos en tiempo real',
    texto: 'Te avisamos cuando te llaman, si tu turno queda en pausa y si cambia la disponibilidad de tus medicamentos.',
  },
  {
    titulo: 'Entregas pendientes',
    texto: 'Si algo no alcanzó, queda pendiente en tu fórmula y te avisamos cuando haya.',
  },
];

const PASOS = [
  { titulo: 'Tu médico emite la fórmula', texto: 'La IPS la envía directamente a la farmacia. Recibes un código.' },
  { titulo: 'Consulta y pide tu turno', texto: 'Ingresa el código y tu documento, revisa qué hay y pide tu turno.' },
  { titulo: 'Sigue tu turno', texto: 'Ve cuántas personas hay antes que tú y avisa cuando vas en camino.' },
  { titulo: 'Reclama tus medicamentos', texto: 'Al llegar, presiona "Ya llegué" y espera el llamado en pantalla.' },
];

const PREGUNTAS = [
  {
    p: '¿Dónde encuentro el código de mi fórmula?',
    r: 'Te lo entrega tu médico o la IPS al emitir la fórmula. Tiene la forma F-2026-0001.',
  },
  {
    p: '¿Cuánto tiempo tengo para llegar después de pedir el turno?',
    r: 'Tus medicamentos quedan apartados por 2 horas. Si se te hace tarde, puedes pedir 20 minutos más una sola vez con el botón "Voy retrasado".',
  },
  {
    p: '¿Qué pasa si no me presento cuando me llaman?',
    r: 'Si no te acercas en unos 4 minutos, tu turno queda en pausa. Tienes 30 minutos para presionar "Ya llegué" y volver a la fila; después el turno vence y los medicamentos apartados se liberan.',
  },
  {
    p: '¿Puede reclamar los medicamentos otra persona?',
    r: 'Sí. En la ventanilla se registran el nombre y el documento de quien recoge.',
  },
  {
    p: '¿Tengo atención preferencial?',
    r: 'Si eres adulto mayor, estás en embarazo o tienes alguna discapacidad, indícalo al pedir el turno y tendrás prioridad en la fila.',
  },
];

export default function Inicio() {
  useTitulo(null);
  const { hash } = useLocation();

  // Los enlaces del menú (/#servicios...) bajan hasta la sección
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <SitioPublico>
      <Carrusel />

      {/* Acceso directo: una sola acción principal, sin tarjetas repetidas */}
      <section className="bg-marca-noche text-white">
        <div className="max-w-7xl mx-auto px-4 py-7 flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
          <div className="flex-1">
            <p className="font-titulo text-xl sm:text-2xl font-bold">¿Ya tienes el código de tu fórmula?</p>
            <p className="text-blue-200 mt-1">
              Es el que te dio la IPS, por ejemplo <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">F-2026-0001</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link to="/paciente"
              className="bg-marca-verde hover:bg-marca-verde-oscuro text-white font-bold text-lg px-7 py-3 rounded-full transition">
              Consultar mi fórmula
            </Link>
            <a href="/#preguntas" className="text-blue-100 underline underline-offset-4 decoration-blue-300/50 hover:text-white">
              Tengo atención preferencial
            </a>
          </div>
        </div>
      </section>

      {/* Servicios: título a la izquierda, lista con divisores a la derecha */}
      <section id="servicios" className="max-w-7xl mx-auto px-4 py-20 scroll-mt-24 grid lg:grid-cols-[2fr_3fr] gap-10 lg:gap-20">
        <div>
          <h2 className="font-titulo text-3xl sm:text-4xl font-extrabold text-marca-noche leading-tight">
            Sabes qué hay antes de salir de casa.
          </h2>
          <p className="text-lg text-slate-600 mt-4 max-w-md">
            Tu fórmula llega de la IPS a la farmacia. Desde aquí ves qué medicamentos están, apartas los tuyos
            y llegas solo cuando es tu turno.
          </p>
        </div>
        <dl className="divide-y divide-slate-200 border-y border-slate-200">
          {SERVICIOS.map(({ titulo, texto }) => (
            <div key={titulo} className="py-6 sm:grid sm:grid-cols-[14rem_1fr] sm:gap-8">
              <dt className="font-bold text-lg text-marca-noche">{titulo}</dt>
              <dd className="text-slate-600 mt-1 sm:mt-0">{texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Cómo funciona: línea de tiempo */}
      <section id="como-funciona" className="bg-marca-hielo border-y border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 py-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <h2 className="font-titulo text-3xl sm:text-4xl font-extrabold text-marca-noche leading-tight max-w-xl">
              De la consulta médica a tus manos
            </h2>
            <Link to="/paciente"
              className="self-start sm:self-auto bg-marca-azul hover:bg-marca-azul-oscuro text-white font-bold px-6 py-3 rounded-full transition">
              Empezar ahora
            </Link>
          </div>
          <ol className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            <div className="hidden lg:block absolute top-5 left-5 right-[calc(25%-0.75rem)] h-0.5 bg-marca-verde/40" aria-hidden="true" />
            {PASOS.map(({ titulo, texto }, i) => (
              <li key={titulo} className="relative">
                <span className="relative flex items-center justify-center w-10 h-10 rounded-full bg-marca-verde text-white font-titulo font-bold ring-4 ring-marca-hielo">
                  {i + 1}
                </span>
                <h3 className="font-bold text-lg text-marca-noche mt-5">{titulo}</h3>
                <p className="text-slate-600 mt-2">{texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="max-w-7xl mx-auto px-4 py-20 scroll-mt-24 grid lg:grid-cols-[2fr_3fr] gap-10 lg:gap-20">
        <div>
          <h2 className="font-titulo text-3xl sm:text-4xl font-extrabold text-marca-noche leading-tight">Preguntas frecuentes</h2>
          <p className="text-lg text-slate-600 mt-4 max-w-sm">
            ¿No encuentras tu respuesta? Pregunta en la ventanilla de la farmacia.
          </p>
        </div>
        <div className="border-t border-slate-200">
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="group border-b border-slate-200">
              <summary className="cursor-pointer list-none flex items-start justify-between gap-6 py-5 font-bold text-lg text-marca-noche hover:text-marca-azul">
                {p}
                <span className="text-2xl leading-none text-marca-verde font-normal group-open:rotate-45 transition" aria-hidden="true">+</span>
              </summary>
              <p className="pb-5 -mt-1 text-slate-600 max-w-2xl">{r}</p>
            </details>
          ))}
        </div>
      </section>
    </SitioPublico>
  );
}
