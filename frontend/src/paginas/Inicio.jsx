import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Accessibility, Bell, CalendarCheck, CheckCircle2, ChevronRight, ClipboardList, Clock, PackageCheck,
  Search, Smartphone, Ticket,
} from 'lucide-react';
import SitioPublico from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';

const SERVICIOS = [
  {
    icono: Search,
    titulo: 'Consulta de disponibilidad',
    texto: 'Con el código de tu fórmula y tu documento ves si cada medicamento está disponible antes de salir de casa.',
  },
  {
    icono: Ticket,
    titulo: 'Turno virtual',
    texto: 'Pide tu turno desde el celular. Tus medicamentos quedan apartados mientras llegas.',
  },
  {
    icono: Bell,
    titulo: 'Avisos en tiempo real',
    texto: 'Te avisamos cuando te llaman, si tu turno queda en pausa y si cambia la disponibilidad de tus medicamentos.',
  },
  {
    icono: PackageCheck,
    titulo: 'Entregas pendientes',
    texto: 'Si algo no alcanzó, queda pendiente en tu fórmula y te avisamos cuando haya.',
  },
];

const PASOS = [
  { icono: ClipboardList, titulo: 'Tu médico emite la fórmula', texto: 'La IPS la envía directamente a la farmacia. Recibes un código.' },
  { icono: Smartphone, titulo: 'Consulta y pide tu turno', texto: 'Ingresa el código y tu documento, revisa qué hay y pide tu turno.' },
  { icono: Clock, titulo: 'Sigue tu turno', texto: 'Ve cuántas personas hay antes que tú y avisa cuando vas en camino.' },
  { icono: CheckCircle2, titulo: 'Reclama tus medicamentos', texto: 'Al llegar, presiona "Ya llegué" y espera el llamado en pantalla.' },
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
      {/* Banner principal */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-14 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <span className="inline-block bg-emerald-500/20 text-emerald-300 text-sm font-semibold px-3 py-1 rounded-full">
              Farmacia conectada a tu IPS
            </span>
            <h1 className="text-4xl sm:text-5xl font-black leading-tight">
              Reclama tus medicamentos <span className="text-emerald-400">sin hacer fila</span>
            </h1>
            <p className="text-lg text-blue-100 max-w-xl">
              Consulta qué hay disponible, pide tu turno desde el celular y llega justo cuando te van a atender.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/paciente"
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg px-6 py-3 rounded-full shadow-lg transition">
                Pide tu turno
                <ChevronRight className="w-5 h-5" />
              </Link>
              <a href="#como-funciona"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-lg px-6 py-3 rounded-full transition">
                Cómo funciona
              </a>
            </div>
          </div>

          {/* Ilustración: así se ve tu turno */}
          <div className="hidden lg:flex justify-center" aria-hidden="true">
            <div className="relative">
              <div className="absolute -inset-6 bg-emerald-400/20 rounded-[3rem] blur-2xl" />
              <div className="relative w-72 bg-white text-slate-900 rounded-[2rem] shadow-2xl p-5 space-y-4 border-8 border-blue-950/40">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tu turno</p>
                <div className="bg-blue-950 text-white rounded-2xl p-5 text-center">
                  <p className="text-5xl font-black">V-014</p>
                  <p className="text-sm text-blue-200 mt-1">Estás en la fila</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-slate-100 rounded-xl p-2.5">
                    <p className="text-slate-500 text-xs">Tu posición</p>
                    <p className="font-bold">3º · ~10 min</p>
                  </div>
                  <div className="bg-slate-100 rounded-xl p-2.5">
                    <p className="text-slate-500 text-xs">Atendiendo</p>
                    <p className="font-bold">V-011</p>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm flex gap-2">
                  <Bell className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  Losartán ya está disponible.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Accesos rápidos */}
      <section className="max-w-7xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icono: Search, titulo: 'Consultar mi fórmula', a: '/paciente' },
            { icono: CalendarCheck, titulo: 'Pedir turno virtual', a: '/paciente' },
            { icono: Accessibility, titulo: 'Atención preferencial', a: '/#preguntas' },
          ].map(({ icono: Icono, titulo, a }) => (
            <Link key={titulo} to={a}
              className="group bg-white rounded-2xl shadow-lg border border-slate-200 p-5 flex items-center gap-4 hover:border-emerald-500 transition">
              <span className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition">
                <Icono className="w-6 h-6" />
              </span>
              <span className="font-bold text-blue-950">{titulo}</span>
              <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
            </Link>
          ))}
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" className="max-w-7xl mx-auto px-4 py-16 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-emerald-600 font-bold uppercase tracking-wide text-sm">Servicios</p>
          <h2 className="text-3xl font-black text-blue-950 mt-1">Todo lo de tu fórmula, en un solo lugar</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SERVICIOS.map(({ icono: Icono, titulo, texto }) => (
            <article key={titulo} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <span className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                <Icono className="w-6 h-6" />
              </span>
              <h3 className="font-bold text-lg text-blue-950">{titulo}</h3>
              <p className="text-slate-600 mt-2">{texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="bg-blue-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-emerald-600 font-bold uppercase tracking-wide text-sm">Cómo funciona</p>
            <h2 className="text-3xl font-black text-blue-950 mt-1">De la consulta médica a tus manos en 4 pasos</h2>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
              <li key={titulo} className="bg-white rounded-2xl p-6 shadow-sm relative">
                <span className="absolute top-5 right-5 text-4xl font-black text-blue-100">{i + 1}</span>
                <Icono className="w-8 h-8 text-blue-900 mb-4" />
                <h3 className="font-bold text-lg text-blue-950">{titulo}</h3>
                <p className="text-slate-600 mt-2">{texto}</p>
              </li>
            ))}
          </ol>
          <div className="text-center mt-10">
            <Link to="/paciente"
              className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-lg px-6 py-3 rounded-full transition">
              Empezar ahora
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="max-w-3xl mx-auto px-4 py-16 scroll-mt-24">
        <div className="text-center mb-8">
          <p className="text-emerald-600 font-bold uppercase tracking-wide text-sm">Preguntas frecuentes</p>
          <h2 className="text-3xl font-black text-blue-950 mt-1">¿Tienes dudas?</h2>
        </div>
        <div className="space-y-3">
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="group bg-white border border-slate-200 rounded-xl open:shadow-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 py-4 font-bold text-blue-950">
                {p}
                <ChevronRight className="w-5 h-5 text-slate-400 transition group-open:rotate-90" />
              </summary>
              <p className="px-5 pb-4 text-slate-600">{r}</p>
            </details>
          ))}
        </div>
      </section>
    </SitioPublico>
  );
}
