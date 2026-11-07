import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, IdCard, Search, Ticket, Wallet } from 'lucide-react';
import SitioPublico from '../components/SitioPublico';
import Carrusel from '../components/Carrusel';
import { useTitulo } from '../components/Encabezado';
import { ARTICULOS } from '../lib/articulos';
import { TarjetaArticulo } from './SaludAlDia';

const ACCESOS = [
  [Search, 'Consultar fórmula', 'Disponibilidad de tus medicamentos', 'bg-marca-azul', '/paciente'],
  [Ticket, 'Turno virtual', 'Pide tu turno desde el celular', 'bg-marca-verde-oscuro', '/paciente'],
  [Wallet, 'Cuota moderadora', 'Conoce cuánto debes pagar', 'bg-marca-noche', '/informacion#cuotas'],
];

const INFORMACION = [
  ['requisitos', 'Requisitos para reclamar'],
  ['cuotas', 'Cuotas moderadoras y exenciones'],
  ['pendientes', 'Entregas pendientes'],
  ['preferencial', 'Atención preferencial'],
  ['derechos', 'Derechos y deberes del paciente'],
];

export default function Inicio() {
  useTitulo(null);

  return (
    <SitioPublico>
      <Carrusel />

      {/* Accesos rápidos en bloque de color, montados sobre el carrusel en computador */}
      <section className="max-w-6xl mx-auto px-4 mt-6 lg:-mt-10 relative z-20">
        <div className="grid sm:grid-cols-3 shadow-xl rounded-lg overflow-hidden">
          {ACCESOS.map(([Icono, titulo, texto, color, a]) => (
            <Link key={titulo} to={a} className={`${color} text-white p-6 flex items-center gap-4 hover:brightness-110 transition`}>
              <Icono className="w-10 h-10 shrink-0 opacity-90" strokeWidth={1.5} />
              <span>
                <span className="block font-bold text-lg">{titulo}</span>
                <span className="block text-sm text-white/80">{texto}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Información para pacientes */}
      <section className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div className="rounded-lg bg-gradient-to-br from-marca-azul to-marca-verde p-8 sm:p-10 text-white">
          <p className="font-titulo text-2xl font-extrabold">Para reclamar necesitas</p>
          <ul className="mt-6 space-y-4">
            {[
              [IdCard, 'Documento de identidad', 'Tuyo o de quien recoge por ti'],
              [FileText, 'Fórmula vigente', 'Puedes reclamar hasta su fecha límite'],
              [Wallet, 'Cuota moderadora', 'La ves al consultar tu fórmula'],
            ].map(([Icono, t, d]) => (
              <li key={t} className="flex items-start gap-4 bg-white/10 rounded-lg p-4">
                <Icono className="w-7 h-7 shrink-0" />
                <span><span className="block font-bold text-lg">{t}</span><span className="block text-white/85">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-marca-verde-oscuro font-bold text-sm uppercase tracking-wider">Pacientes y familiares</p>
          <h2 className="font-titulo text-3xl font-extrabold text-marca-noche mt-2 mb-6">Información para reclamar tus medicamentos</h2>
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {INFORMACION.map(([id, t]) => (
              <li key={id}>
                <Link to={`/informacion#${id}`} className="flex items-center justify-between py-3.5 font-semibold text-slate-800 hover:text-marca-azul group">
                  {t}
                  <ArrowRight className="w-5 h-5 text-marca-verde group-hover:translate-x-1 transition" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Salud al día: los tres artículos más recientes */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="font-titulo text-3xl font-extrabold text-marca-noche">Salud al día</h2>
            <Link to="/salud-al-dia" className="font-semibold text-marca-azul hover:underline">Ver todos los artículos</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {ARTICULOS.slice(0, 3).map((a) => <TarjetaArticulo key={a.slug} articulo={a} />)}
          </div>
        </div>
      </section>

      {/* Quiénes somos */}
      <section id="quienes-somos" className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-[3fr_2fr] gap-10 items-center scroll-mt-28">
        <div>
          <h2 className="font-titulo text-3xl font-extrabold text-marca-noche">Quiénes somos</h2>
          <p className="text-lg text-slate-600 mt-4">
            Mediconnect conecta las fórmulas de tu IPS con la farmacia. Sabes qué medicamentos hay antes de salir,
            apartas los tuyos con un turno virtual y conoces desde el principio el valor de tu cuota moderadora.
          </p>
        </div>
        <div className="bg-marca-hielo border-l-4 border-marca-verde rounded p-6">
          <p className="font-bold text-marca-noche text-lg">¿Tienes una fórmula vigente?</p>
          <p className="text-slate-600 mt-1">Consulta disponibilidad y pide tu turno en dos minutos.</p>
          <Link to="/paciente" className="inline-flex items-center gap-2 mt-4 bg-marca-verde hover:bg-marca-verde-oscuro text-white font-bold px-5 py-2.5 rounded">
            Consultar ahora <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </SitioPublico>
  );
}
