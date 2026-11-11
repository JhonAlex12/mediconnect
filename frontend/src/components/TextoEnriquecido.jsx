import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Muestra el texto que escribe el administrador con un formato sencillo (sin HTML):
//   línea en blanco      → nuevo párrafo
//   ## Subtítulo         → subtítulo
//   - elemento           → lista con viñetas
//   **texto**            → negrita
//   [Texto](/ruta)       → solo en su línea: botón; dentro de un párrafo: enlace
//   ![Texto](/api/contenido/imagenes/N) → solo en su línea: imagen del sitio con su descripción
//   {telefono} {correo} {horario} {direccion} → datos de contacto
//   {tabla_cuotas}       → (solo en su línea) bloque especial que pasa la página en "especiales"

export const AYUDA_FORMATO = [
  ['Línea en blanco', 'separa párrafos'],
  ['## Subtítulo', 'subtítulo'],
  ['- Elemento', 'lista con viñetas'],
  ['**texto**', 'negrita'],
  ['[Consultar](/paciente)', 'botón (solo en su línea) o enlace'],
  ['{telefono} {correo} {horario} {direccion}', 'datos de contacto'],
];

// Solo en los artículos de "Salud al día" (el editor tiene el botón "Insertar imagen")
export const AYUDA_IMAGEN = [
  ['![Descripción](/api/contenido/imagenes/12)', 'imagen (solo en su línea; usa el botón “Insertar imagen”)'],
];

const ENLACE_SEGURO = /^(\/[\w\-/#?=&.%]*|https:\/\/[^\s<>"]+)$/;
// Solo imágenes del propio sitio: las subidas desde el panel o las de /img/
const IMAGEN_SEGURA = /^\/(img\/[\w.-]+|api\/contenido\/imagenes\/\d+)$/;

function Imagen({ ruta, texto }) {
  const subida = ruta.startsWith('/api/');
  return (
    <figure className="my-2">
      {/* Las subidas tienen versión para celular (900 px) y para computador (hasta 1600 px) */}
      <img src={ruta} alt={texto} loading="lazy" decoding="async"
        srcSet={subida ? `${ruta}?movil=1 900w, ${ruta} 1600w` : undefined}
        sizes={subida ? '(max-width: 800px) 100vw, 768px' : undefined}
        className="w-full h-auto rounded-lg border border-slate-200" />
      {texto && <figcaption aria-hidden="true" className="mt-2 text-sm text-slate-500 text-center">{texto}</figcaption>}
    </figure>
  );
}

function Enlace({ a, children, className }) {
  if (!ENLACE_SEGURO.test(a)) return <>{children}</>;
  return a.startsWith('/')
    ? <Link to={a} className={className}>{children}</Link>
    : <a href={a} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}

// **negrita** y [texto](/ruta) dentro de una línea
function enLinea(texto, clave = '') {
  const partes = [];
  const patron = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ultimo = 0;
  let m;
  while ((m = patron.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1] !== undefined) partes.push(<strong key={`${clave}b${m.index}`}>{m[1]}</strong>);
    else partes.push(<Enlace key={`${clave}a${m.index}`} a={m[3]} className="text-marca-azul font-semibold underline">{m[2]}</Enlace>);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export default function TextoEnriquecido({ texto = '', datos = {}, especiales = {}, tamano = 'text-lg' }) {
  // Reemplaza {telefono}, {correo}... (solo claves conocidas)
  const conDatos = texto.replace(/\{(\w+)\}/g, (todo, k) =>
    k in especiales ? todo : (datos[k] != null ? String(datos[k]) : todo));

  const bloques = [];
  let lista = null;
  let parrafo = [];
  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: 'p', texto: parrafo.join(' ') });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) bloques.push({ tipo: 'ul', items: lista });
    lista = null;
  };

  for (const crudo of conDatos.replace(/\r/g, '').split('\n')) {
    const linea = crudo.trim();
    if (!linea) { cerrarParrafo(); cerrarLista(); continue; }
    const especial = /^\{(\w+)\}$/.exec(linea);
    const boton = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(linea);
    const imagen = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(linea);
    if (imagen && IMAGEN_SEGURA.test(imagen[2])) { cerrarParrafo(); cerrarLista(); bloques.push({ tipo: 'imagen', texto: imagen[1].trim(), ruta: imagen[2] }); }
    else if (especial && especial[1] in especiales) { cerrarParrafo(); cerrarLista(); bloques.push({ tipo: 'especial', clave: especial[1] }); }
    else if (linea.startsWith('## ')) { cerrarParrafo(); cerrarLista(); bloques.push({ tipo: 'h', texto: linea.slice(3) }); }
    else if (/^[-•*] /.test(linea)) { cerrarParrafo(); (lista ??= []).push(linea.slice(2)); }
    else if (boton) { cerrarParrafo(); cerrarLista(); bloques.push({ tipo: 'boton', texto: boton[1], a: boton[2] }); }
    else { cerrarLista(); parrafo.push(linea); }
  }
  cerrarParrafo();
  cerrarLista();

  return (
    <div className={`space-y-4 text-slate-700 leading-relaxed ${tamano}`}>
      {bloques.map((b, i) => {
        if (b.tipo === 'h') return <h2 key={i} className="font-titulo text-xl font-bold text-marca-noche pt-2">{enLinea(b.texto, i)}</h2>;
        if (b.tipo === 'ul') {
          return (
            <ul key={i} className="space-y-1.5 list-disc pl-6 marker:text-marca-verde">
              {b.items.map((t, j) => <li key={j}>{enLinea(t, `${i}-${j}`)}</li>)}
            </ul>
          );
        }
        if (b.tipo === 'boton') {
          return (
            <p key={i}>
              <Enlace a={b.a} className="inline-flex items-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro text-white font-bold px-5 py-2.5 rounded text-base no-underline">
                {b.texto} <ArrowRight className="w-4 h-4" />
              </Enlace>
            </p>
          );
        }
        if (b.tipo === 'imagen') return <Imagen key={i} ruta={b.ruta} texto={b.texto} />;
        if (b.tipo === 'especial') return <React.Fragment key={i}>{especiales[b.clave]}</React.Fragment>;
        return <p key={i}>{enLinea(b.texto, i)}</p>;
      })}
    </div>
  );
}
