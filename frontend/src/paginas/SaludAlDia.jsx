import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, HeartPulse, Pill } from 'lucide-react';
import SitioPublico, { TituloPagina } from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { ARTICULOS, buscarArticulo, fechaArticulo } from '../lib/articulos';
import NoEncontrada from './NoEncontrada';

// Imagen de cada artículo: un degradado de la marca con un ícono según el tema
const VISUAL = {
  'Tu fórmula': { icono: BookOpen, fondo: 'from-marca-noche to-marca-azul' },
  'Cuidado en casa': { icono: HeartPulse, fondo: 'from-marca-verde to-teal-300' },
};
const visualDe = (a) => VISUAL[a.tema] ?? { icono: Pill, fondo: 'from-marca-azul to-marca-verde' };

export function TarjetaArticulo({ articulo }) {
  const { icono: Icono, fondo } = visualDe(articulo);
  return (
    <article className="bg-white rounded-lg overflow-hidden border border-slate-200 hover:shadow-lg transition flex flex-col">
      <Link to={`/salud-al-dia/${articulo.slug}`} className={`h-40 bg-gradient-to-br ${fondo} flex items-center justify-center`} tabIndex={-1} aria-hidden="true">
        <Icono className="w-16 h-16 text-white/80" strokeWidth={1.25} />
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <p className="text-sm text-slate-500">{fechaArticulo(articulo.fecha)} · {articulo.tema}</p>
        <h3 className="font-bold text-lg text-marca-noche mt-1 leading-snug">
          <Link to={`/salud-al-dia/${articulo.slug}`} className="hover:text-marca-azul">{articulo.titulo}</Link>
        </h3>
        <p className="text-slate-600 text-sm mt-2 flex-1">{articulo.resumen}</p>
        <Link to={`/salud-al-dia/${articulo.slug}`} className="inline-block mt-3 text-sm font-semibold text-marca-azul hover:underline"
          aria-label={`Leer más: ${articulo.titulo}`}>
          Leer más
        </Link>
      </div>
    </article>
  );
}

// /salud-al-dia y /salud-al-dia/:slug
export default function SaludAlDia() {
  const { slug } = useParams();
  return slug ? <Articulo slug={slug} /> : <Listado />;
}

function Listado() {
  useTitulo('Salud al día');
  return (
    <SitioPublico>
      <TituloPagina titulo="Salud al día" descripcion="Consejos para entender tu fórmula y cuidar tu tratamiento en casa." />
      <section className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        {ARTICULOS.map((a) => <TarjetaArticulo key={a.slug} articulo={a} />)}
      </section>
    </SitioPublico>
  );
}

function Articulo({ slug }) {
  const articulo = buscarArticulo(slug);
  useTitulo(articulo?.titulo ?? 'Artículo no encontrado');
  if (!articulo) return <NoEncontrada />;

  const otros = ARTICULOS.filter((a) => a.slug !== slug).slice(0, 2);
  const { icono: Icono, fondo } = visualDe(articulo);

  return (
    <SitioPublico>
      <TituloPagina titulo={articulo.titulo} miga={{ a: '/salud-al-dia', texto: 'Salud al día' }} />
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_20rem] gap-12">
        <article className="max-w-3xl">
          <div className={`h-48 sm:h-64 rounded-lg bg-gradient-to-br ${fondo} flex items-center justify-center`} aria-hidden="true">
            <Icono className="w-20 h-20 text-white/80" strokeWidth={1.25} />
          </div>
          <p className="text-slate-500 mt-6">{fechaArticulo(articulo.fecha)} · {articulo.tema}</p>
          <div className="mt-4 space-y-6 text-lg text-slate-700 leading-relaxed">
            {articulo.secciones.map((s, i) => (
              <section key={i}>
                {s.titulo && <h2 className="font-titulo text-xl font-bold text-marca-noche mb-2">{s.titulo}</h2>}
                {s.parrafos.map((p) => <p key={p} className="mt-2">{p}</p>)}
              </section>
            ))}
          </div>
          <p className="mt-10 text-sm text-slate-500 border-t border-slate-200 pt-4">
            Este contenido es informativo y no reemplaza la indicación de tu médico o del químico farmacéutico.
          </p>
          <Link to="/salud-al-dia" className="inline-flex items-center gap-2 mt-6 font-semibold text-marca-azul hover:underline">
            <ArrowLeft className="w-4 h-4" /> Todos los artículos
          </Link>
        </article>

        <aside className="space-y-4">
          <h2 className="font-bold text-marca-noche">Otros artículos</h2>
          {otros.map((a) => <TarjetaArticulo key={a.slug} articulo={a} />)}
        </aside>
      </div>
    </SitioPublico>
  );
}
