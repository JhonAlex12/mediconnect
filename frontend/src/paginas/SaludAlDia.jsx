import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, HeartPulse, Pill } from 'lucide-react';
import SitioPublico, { TituloPagina } from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { fechaArticulo, useArticulo, useArticulos } from '../lib/articulos';
import TextoEnriquecido from '../components/TextoEnriquecido';
import Revelar from '../components/Revelar';
import NoEncontrada from './NoEncontrada';

// Imagen de cada artículo: un degradado de la marca con un ícono según el tema
const VISUAL = {
  'Tu fórmula': { icono: BookOpen, fondo: 'from-marca-noche to-marca-azul' },
  'Cuidado en casa': { icono: HeartPulse, fondo: 'from-marca-verde to-teal-300' },
};
const visualDe = (a) => VISUAL[a.tema] ?? { icono: Pill, fondo: 'from-marca-azul to-marca-verde' };

// Imagen del artículo si el administrador subió una; si no, el degradado con el ícono del tema
function Portada({ articulo, className, tamanoIcono }) {
  const { icono: Icono, fondo } = visualDe(articulo);
  if (articulo.imagen) {
    return <img src={articulo.imagen} alt="" loading="lazy" className={`${className} w-full object-cover`} />;
  }
  return (
    <div className={`${className} bg-gradient-to-br ${fondo} flex items-center justify-center`}>
      <Icono className={`${tamanoIcono} text-white/80`} strokeWidth={1.25} />
    </div>
  );
}

export function TarjetaArticulo({ articulo }) {
  return (
    <article className="bg-white rounded-lg overflow-hidden border border-slate-200 hover:shadow-lg transition flex flex-col">
      <Link to={`/salud-al-dia/${articulo.slug}`} tabIndex={-1} aria-hidden="true">
        <Portada articulo={articulo} className="h-40" tamanoIcono="w-16 h-16" />
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
  const articulos = useArticulos();
  return (
    <SitioPublico>
      <TituloPagina titulo="Salud al día" descripcion="Consejos para entender tu fórmula y cuidar tu tratamiento en casa." />
      <section className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        {articulos === null && <p className="text-slate-500">Cargando artículos…</p>}
        {articulos?.length === 0 && <p className="text-slate-500">Aún no hay artículos publicados.</p>}
        {articulos?.map((a, i) => (
          <Revelar key={a.slug} retraso={(i % 3) * 150} className="grid"><TarjetaArticulo articulo={a} /></Revelar>
        ))}
      </section>
    </SitioPublico>
  );
}

function Articulo({ slug }) {
  const { estado, articulo } = useArticulo(slug);
  const todos = useArticulos();
  useTitulo(articulo?.titulo ?? (estado === 'cargando' ? 'Salud al día' : 'Artículo no encontrado'));
  if (estado === 'no-existe') return <NoEncontrada />;
  if (estado === 'cargando') {
    return <SitioPublico><p className="text-center text-slate-500 py-24">Cargando…</p></SitioPublico>;
  }

  const otros = (todos ?? []).filter((a) => a.slug !== slug).slice(0, 2);

  return (
    <SitioPublico>
      <TituloPagina titulo={articulo.titulo} miga={{ a: '/salud-al-dia', texto: 'Salud al día' }} />
      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_20rem] gap-12">
        <article className="max-w-3xl">
          <div aria-hidden="true"><Portada articulo={articulo} className="h-48 sm:h-64 rounded-lg" tamanoIcono="w-20 h-20" /></div>
          <p className="text-slate-500 mt-6">{fechaArticulo(articulo.fecha)} · {articulo.tema}</p>
          <div className="mt-4"><TextoEnriquecido texto={articulo.contenido} /></div>
          <p className="mt-10 text-sm text-slate-500 border-t border-slate-200 pt-4">
            Este contenido es informativo y no reemplaza la indicación de tu médico o del químico farmacéutico.
          </p>
          <Link to="/salud-al-dia" className="inline-flex items-center gap-2 mt-6 font-semibold text-marca-azul hover:underline">
            <ArrowLeft className="w-4 h-4" /> Todos los artículos
          </Link>
        </article>

        <aside className="space-y-4">
          {otros.length > 0 && <h2 className="font-bold text-marca-noche">Otros artículos</h2>}
          {otros.map((a) => <TarjetaArticulo key={a.slug} articulo={a} />)}
        </aside>
      </div>
    </SitioPublico>
  );
}
