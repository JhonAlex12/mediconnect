import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import TextoEnriquecido, { AYUDA_FORMATO, AYUDA_IMAGEN } from '../../TextoEnriquecido';
import { claseCampo } from '../comunes';

// Piezas comunes de los editores de contenido del panel

export function Etiqueta({ htmlFor, children, ayuda }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-bold text-slate-800 mb-1">
      {children} {ayuda && <span className="font-normal text-slate-500">· {ayuda}</span>}
    </label>
  );
}

export function CampoTexto({ id, etiqueta, ayuda, valor, cambiar, ...props }) {
  return (
    <div>
      <Etiqueta htmlFor={id} ayuda={ayuda}>{etiqueta}</Etiqueta>
      <input id={id} value={valor ?? ''} onChange={(e) => cambiar(e.target.value)} className={claseCampo} {...props} />
    </div>
  );
}

const leerComoDataUrl = (archivo) =>
  new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const LADO_MAXIMO = 2400; // px: el servidor después la deja en 1600 (computador) y 900 (celular)
const MAX_BYTES = 10 * 1024 * 1024;

// Achica en el navegador las fotos grandes (ej.: de celular) antes de subirlas,
// para que suban rápido y no pasen del límite. Devuelve un data URL.
async function reducirImagen(archivo) {
  if (!TIPOS_IMAGEN.includes(archivo.type)) throw new Error('La imagen debe ser JPG, PNG o WebP');
  let mapa;
  try {
    mapa = await createImageBitmap(archivo); // respeta la orientación de la foto
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con otro archivo.');
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
  if (escala === 1 && archivo.size <= 3 * 1024 * 1024) {
    mapa.close();
    return leerComoDataUrl(archivo); // ya es liviana: se sube tal cual
  }
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext('2d').drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  mapa.close();
  // WebP conserva la transparencia de los PNG; si el navegador no lo soporta entrega PNG
  return lienzo.toDataURL('image/webp', 0.9);
}

// Sube un archivo de imagen y devuelve { url, url_movil, ancho, alto }. El servidor la optimiza.
async function subirArchivoImagen(archivo) {
  const datos = await reducirImagen(archivo);
  if (datos.length * 0.75 > MAX_BYTES) throw new Error('La imagen pesa más de 10 MB');
  const r = await api('/contenido/admin/imagenes', { metodo: 'POST', cuerpo: { imagen: datos } });
  return r.imagen;
}

// Sube una imagen (JPG, PNG o WebP) y devuelve { url, url_movil }. El servidor la optimiza.
export function SubirImagen({ etiqueta, imagen, alSubir, alQuitar, alto = 'h-40', ayuda }) {
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const elegir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      alSubir(await subirArchivoImagen(archivo));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div>
      <Etiqueta ayuda={ayuda}>{etiqueta}</Etiqueta>
      <div className={`${alto} rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden flex items-center justify-center`}>
        {imagen ? <img src={imagen} alt="" className="w-full h-full object-contain" />
          : <span className="text-sm text-slate-400">Sin imagen</span>}
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp" onChange={elegir} className="hidden" />
        <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo}
          className="flex items-center gap-1.5 text-sm font-semibold bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50">
          <ImagePlus className="w-4 h-4" /> {subiendo ? 'Subiendo…' : imagen ? 'Cambiar imagen' : 'Subir imagen'}
        </button>
        {imagen && alQuitar && (
          <button type="button" onClick={alQuitar} className="text-sm font-semibold text-red-700 hover:underline cursor-pointer">
            Quitar
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700 mt-1">{error}</p>}
    </div>
  );
}

// Área de texto con la ayuda del formato y vista previa de cómo se verá.
// Con "imagenes", muestra un botón para subir una imagen y ponerla dentro del texto.
export function EditorTexto({ id, etiqueta, valor, cambiar, datos, especiales, ayudaExtra = [], filas = 14, imagenes = false }) {
  const [vista, setVista] = useState(false);
  const area = useRef(null);
  const entrada = useRef(null);
  const cursor = useRef(null); // dónde estaba el cursor al pulsar "Insertar imagen"
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  const pedirImagen = () => {
    cursor.current = vista ? null : area.current?.selectionStart ?? null;
    entrada.current?.click();
  };

  const insertarImagen = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      const img = await subirArchivoImagen(archivo);
      const linea = `![Describe aquí la imagen](${img.url})`;
      // Va en su propio párrafo: en el punto donde estaba el cursor o al final
      const pos = cursor.current ?? valor.length;
      const antes = valor.slice(0, pos).replace(/\s*$/, '');
      const despues = valor.slice(pos).replace(/^\s*/, '');
      cambiar(`${antes}${antes ? '\n\n' : ''}${linea}${despues ? `\n\n${despues}` : '\n'}`);
      setVista(false);
      // Deja seleccionado el texto de ejemplo para que lo cambien de una vez
      const inicio = antes.length + (antes ? 2 : 0) + 2;
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.setSelectionRange(inicio, inicio + 'Describe aquí la imagen'.length);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
        <div className="flex items-center gap-4">
          {imagenes && (
            <>
              <input ref={entrada} type="file" accept={TIPOS_IMAGEN.join(',')} onChange={insertarImagen} className="hidden" />
              <button type="button" onClick={pedirImagen} disabled={subiendo}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-950 cursor-pointer disabled:opacity-50">
                <ImagePlus className="w-4 h-4" /> {subiendo ? 'Subiendo…' : 'Insertar imagen'}
              </button>
            </>
          )}
          <button type="button" onClick={() => setVista((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-950 cursor-pointer">
            {vista ? <><Pencil className="w-4 h-4" /> Editar</> : <><Eye className="w-4 h-4" /> Vista previa</>}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-700 mb-1">{error}</p>}
      {vista ? (
        <div className="border border-slate-300 rounded-lg p-5 bg-white min-h-40">
          <TextoEnriquecido texto={valor} datos={datos} especiales={especiales} tamano="text-base" />
        </div>
      ) : (
        <textarea ref={area} id={id} value={valor} onChange={(e) => cambiar(e.target.value)} rows={filas}
          className={`${claseCampo} font-mono text-sm leading-relaxed`} />
      )}
      <details className="mt-2 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold">Cómo dar formato al texto</summary>
        <table className="mt-2 text-left">
          <tbody>
            {[...AYUDA_FORMATO, ...(imagenes ? AYUDA_IMAGEN : []), ...ayudaExtra].map(([codigo, efecto]) => (
              <tr key={codigo}>
                <td className="pr-4 py-0.5"><code className="bg-slate-100 px-1.5 py-0.5 rounded">{codigo}</code></td>
                <td className="py-0.5">{efecto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// Botones de subir / bajar / editar / eliminar de cada fila de una lista
export function AccionesFila({ primero, ultimo, alSubir, alBajar, alEditar, alEliminar, ocupado }) {
  const clase = 'p-2 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-1 shrink-0">
      {alSubir && <button type="button" onClick={alSubir} disabled={primero || ocupado} aria-label="Subir" className={clase}><ArrowUp className="w-4 h-4" /></button>}
      {alBajar && <button type="button" onClick={alBajar} disabled={ultimo || ocupado} aria-label="Bajar" className={clase}><ArrowDown className="w-4 h-4" /></button>}
      <button type="button" onClick={alEditar} aria-label="Editar" className={clase}><Pencil className="w-4 h-4" /></button>
      <button type="button" onClick={alEliminar} disabled={ocupado} aria-label="Eliminar" className={`${clase} text-red-700 hover:bg-red-50`}><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

// Mueve un elemento de la lista y devuelve los ids en el orden nuevo
export function moverIds(lista, indice, delta) {
  const ids = lista.map((x) => x.id);
  const destino = indice + delta;
  if (destino < 0 || destino >= ids.length) return ids;
  [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
  return ids;
}
