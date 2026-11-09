import React, { useCallback, useEffect, useState } from 'react';
import { EyeOff, Plus, Save } from 'lucide-react';
import { api } from '../../../lib/api';
import { useContenido } from '../../../lib/contenido';
import { Aviso, BotonAccion, claseCampo, useAccion } from '../comunes';
import { AccionesFila, CampoTexto, Etiqueta, SubirImagen, moverIds } from './comunes';

const VACIO = { nombre: '', texto_alt: '', imagen: '', imagen_movil: '', enlace: '', fondo: '', activo: true };

// Fondos sugeridos para los lados de la foto en pantallas anchas
const FONDOS = [
  ['', 'Ninguno (como el banner principal)'],
  ['#ffffff', 'Blanco'],
  ['#f1f8fb', 'Hielo (azul muy claro)'],
  ['#e0f5f3', 'Verde claro'],
  ['linear-gradient(to right, #fbfdfd 0%, #eef7f9 45%, #a9d3db 100%)', 'Degradado azul claro'],
  ['linear-gradient(to right, #f2ebe1 0%, #ece3d8 45%, #b9ada1 100%)', 'Degradado beige'],
];

export default function CarruselAdmin() {
  const { recargar: recargarSitio } = useContenido();
  const [slides, setSlides] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | slide
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setSlides((await api('/contenido/admin/slides')).slides);
      await recargarSitio();
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, [recargarSitio]);
  useEffect(() => { cargar(); }, [cargar]);

  const { ocupado, aviso, ejecutar } = useAccion(cargar);

  if (editando) {
    return (
      <FormularioSlide inicial={editando === 'nuevo' ? VACIO : editando}
        alTerminar={async () => { setEditando(null); await cargar(); }} alCancelar={() => setEditando(null)} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-600 max-w-2xl">
          Imágenes que rotan en la parte superior de la página principal. Usa imágenes horizontales (por ejemplo 1600 × 900 px).
        </p>
        <BotonAccion color="verde" icono={Plus} onClick={() => setEditando('nuevo')}>Nuevo slide</BotonAccion>
      </div>
      <Aviso aviso={error ?? aviso} />
      {slides === null ? <p className="text-slate-500">Cargando…</p> : (
        <ul className="bg-white rounded-xl border border-slate-300 divide-y divide-slate-200">
          {slides.length === 0 && <li className="p-5 text-slate-500">No hay slides. El carrusel no se mostrará.</li>}
          {slides.map((s, i) => (
            <li key={s.id} className="p-3 flex items-center gap-4">
              <span className="text-sm font-bold text-slate-400 w-5 text-center">{i + 1}</span>
              <img src={s.imagen_movil || s.imagen} alt="" className="w-32 h-20 object-cover rounded-md border border-slate-200 bg-slate-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{s.nombre}</p>
                <p className="text-sm text-slate-500 truncate">{s.enlace ? `Lleva a ${s.enlace}` : 'Sin enlace'}</p>
                {!s.activo && <p className="text-xs font-bold text-amber-700 flex items-center gap-1 mt-0.5"><EyeOff className="w-3.5 h-3.5" /> Oculto</p>}
              </div>
              <AccionesFila primero={i === 0} ultimo={i === slides.length - 1} ocupado={ocupado}
                alSubir={() => ejecutar(() => api('/contenido/admin/slides/orden', { metodo: 'PUT', cuerpo: { ids: moverIds(slides, i, -1) } }), 'Orden guardado')}
                alBajar={() => ejecutar(() => api('/contenido/admin/slides/orden', { metodo: 'PUT', cuerpo: { ids: moverIds(slides, i, 1) } }), 'Orden guardado')}
                alEditar={() => setEditando(s)}
                alEliminar={() => window.confirm(`¿Eliminar el slide "${s.nombre}"?`)
                  && ejecutar(() => api(`/contenido/admin/slides/${s.id}`, { metodo: 'DELETE' }), 'Slide eliminado')} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormularioSlide({ inicial, alTerminar, alCancelar }) {
  const [s, setS] = useState({ ...VACIO, ...Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, v ?? ''])) });
  const { ocupado, aviso, ejecutar } = useAccion();
  const cambiar = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const nuevo = !inicial.id;
  const fondoPropio = !FONDOS.some(([v]) => v === s.fondo);

  const guardar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api(nuevo ? '/contenido/admin/slides' : `/contenido/admin/slides/${inicial.id}`, { metodo: nuevo ? 'POST' : 'PUT', cuerpo: s }),
      'Slide guardado'
    );
    if (ok) await alTerminar();
  };

  return (
    <form onSubmit={guardar} className="bg-white rounded-xl border border-slate-300 p-5 space-y-5">
      <h3 className="text-lg font-bold text-slate-900">{nuevo ? 'Nuevo slide' : `Editar: ${inicial.nombre}`}</h3>
      <div className="grid lg:grid-cols-2 gap-5">
        <SubirImagen etiqueta="Imagen" ayuda="se adapta sola para celular" alto="h-48" imagen={s.imagen}
          alSubir={(img) => setS((x) => ({ ...x, imagen: img.url, imagen_movil: img.url_movil }))} />
        <div className="space-y-4">
          <CampoTexto id="sl-nombre" etiqueta="Nombre" ayuda="corto, para identificarlo" valor={s.nombre} cambiar={cambiar('nombre')} maxLength={80} required />
          <div>
            <Etiqueta htmlFor="sl-alt" ayuda="lo que dice o muestra la imagen (para personas con discapacidad visual)">Descripción</Etiqueta>
            <textarea id="sl-alt" value={s.texto_alt} onChange={(e) => cambiar('texto_alt')(e.target.value)} rows={3} maxLength={300} required className={claseCampo} />
          </div>
          <CampoTexto id="sl-enlace" etiqueta="Enlace" ayuda="opcional: /informacion, /#domicilio o https://…" valor={s.enlace} cambiar={cambiar('enlace')} maxLength={200} />
          <div>
            <Etiqueta htmlFor="sl-fondo" ayuda="se ve a los lados en pantallas anchas">Fondo</Etiqueta>
            <select id="sl-fondo" value={fondoPropio ? '__propio' : s.fondo}
              onChange={(e) => cambiar('fondo')(e.target.value === '__propio' ? '#ffffff' : e.target.value)} className={claseCampo}>
              {FONDOS.map(([v, t]) => <option key={t} value={v}>{t}</option>)}
              <option value="__propio">Otro color…</option>
            </select>
            {fondoPropio && (
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(s.fondo) ? s.fondo : '#ffffff'} onChange={(e) => cambiar('fondo')(e.target.value)}
                aria-label="Color de fondo" className="mt-2 h-10 w-20 rounded border border-slate-300 cursor-pointer" />
            )}
          </div>
          <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
            <input type="checkbox" checked={s.activo} onChange={(e) => cambiar('activo')(e.target.checked)} className="w-5 h-5" />
            Mostrar en el sitio
          </label>
        </div>
      </div>
      <Aviso aviso={aviso} />
      <div className="flex gap-3">
        <BotonAccion type="submit" color="verde" icono={Save} ocupado={ocupado || !s.imagen}>Guardar</BotonAccion>
        <BotonAccion color="gris" onClick={alCancelar}>Cancelar</BotonAccion>
      </div>
    </form>
  );
}
