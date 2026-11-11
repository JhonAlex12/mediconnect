import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, EyeOff, Plus, Save } from 'lucide-react';
import { api } from '../../../lib/api';
import { fechaArticulo } from '../../../lib/articulos';
import { Aviso, BotonAccion, claseCampo, useAccion } from '../comunes';
import { AccionesFila, CampoTexto, EditorTexto, Etiqueta, SubirImagen } from './comunes';

const hoy = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en la hora local

// "Cómo guardar tus medicamentos" → "como-guardar-tus-medicamentos"
const aSlug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

export default function ArticulosAdmin() {
  const [articulos, setArticulos] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | id
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setArticulos((await api('/contenido/admin/articulos')).articulos);
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const { ocupado, aviso, ejecutar } = useAccion(cargar);

  if (editando) {
    return (
      <FormularioArticulo id={editando === 'nuevo' ? null : editando}
        temas={[...new Set((articulos ?? []).map((a) => a.tema))]}
        alTerminar={async () => { setEditando(null); await cargar(); }} alCancelar={() => setEditando(null)} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-600 max-w-2xl">
          Artículos de la sección “Salud al día”. Los tres más recientes también aparecen en la página principal.
        </p>
        <BotonAccion color="verde" icono={Plus} onClick={() => setEditando('nuevo')}>Nuevo artículo</BotonAccion>
      </div>
      <Aviso aviso={error ?? aviso} />
      {articulos === null ? <p className="text-slate-500">Cargando…</p> : (
        <ul className="bg-white rounded-xl border border-slate-300 divide-y divide-slate-200">
          {articulos.length === 0 && <li className="p-5 text-slate-500">Aún no hay artículos.</li>}
          {articulos.map((a) => (
            <li key={a.id} className="p-3 pl-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{a.titulo}</p>
                <p className="text-sm text-slate-500">
                  {fechaArticulo(a.fecha)} · {a.tema}
                  {!a.publicado && <span className="ml-2 inline-flex items-center gap-1 font-bold text-amber-700"><EyeOff className="w-3.5 h-3.5" /> Borrador</span>}
                </p>
              </div>
              {a.publicado && (
                <a href={`/salud-al-dia/${a.slug}`} target="_blank" rel="noopener noreferrer" aria-label="Ver en el sitio"
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"><ExternalLink className="w-4 h-4" /></a>
              )}
              <AccionesFila ocupado={ocupado} alEditar={() => setEditando(a.id)}
                alEliminar={() => window.confirm(`¿Eliminar el artículo "${a.titulo}"? No se puede deshacer.`)
                  && ejecutar(() => api(`/contenido/admin/articulos/${a.id}`, { metodo: 'DELETE' }), 'Artículo eliminado')} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormularioArticulo({ id, temas, alTerminar, alCancelar }) {
  const [a, setA] = useState(id ? null : {
    titulo: '', slug: '', tema: '', resumen: '', contenido: '', imagen: '', fecha: hoy(), publicado: true,
  });
  const [slugManual, setSlugManual] = useState(Boolean(id));
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();

  useEffect(() => {
    if (!id) return;
    api(`/contenido/admin/articulos/${id}`)
      .then((d) => setA({ ...d.articulo, imagen: d.articulo.imagen ?? '' }))
      .catch((err) => setAviso({ tipo: 'error', texto: err.message }));
  }, [id, setAviso]);

  if (!a) return <div className="space-y-3"><Aviso aviso={aviso} /><p className="text-slate-500">Cargando…</p></div>;

  const cambiar = (k) => (v) => setA((x) => ({
    ...x, [k]: v, ...(k === 'titulo' && !slugManual ? { slug: aSlug(v) } : {}),
  }));

  const guardar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api(id ? `/contenido/admin/articulos/${id}` : '/contenido/admin/articulos', { metodo: id ? 'PUT' : 'POST', cuerpo: a }),
      'Artículo guardado'
    );
    if (ok) await alTerminar();
  };

  return (
    <form onSubmit={guardar} className="bg-white rounded-xl border border-slate-300 p-5 space-y-5">
      <h3 className="text-lg font-bold text-slate-900">{id ? 'Editar artículo' : 'Nuevo artículo'}</h3>
      <div className="grid lg:grid-cols-[1fr_20rem] gap-5">
        <div className="space-y-4">
          <CampoTexto id="ar-titulo" etiqueta="Título" valor={a.titulo} cambiar={cambiar('titulo')} maxLength={160} required />
          <div>
            <Etiqueta htmlFor="ar-slug" ayuda="dirección de la página: /salud-al-dia/…">Dirección</Etiqueta>
            <input id="ar-slug" value={a.slug} maxLength={120} required className={claseCampo}
              onChange={(e) => { setSlugManual(true); setA((x) => ({ ...x, slug: aSlug(e.target.value) })); }} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Etiqueta htmlFor="ar-tema" ayuda="ej.: Tu fórmula, Cuidado en casa">Tema</Etiqueta>
              <input id="ar-tema" list="ar-temas" value={a.tema} onChange={(e) => cambiar('tema')(e.target.value)} maxLength={60} required className={claseCampo} />
              <datalist id="ar-temas">{temas.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <CampoTexto id="ar-fecha" etiqueta="Fecha" type="date" valor={a.fecha} cambiar={cambiar('fecha')} required />
          </div>
          <div>
            <Etiqueta htmlFor="ar-resumen" ayuda="se ve en la tarjeta del artículo">Resumen</Etiqueta>
            <textarea id="ar-resumen" value={a.resumen} onChange={(e) => cambiar('resumen')(e.target.value)} rows={2} maxLength={300} required className={claseCampo} />
          </div>
        </div>
        <SubirImagen etiqueta="Imagen de portada" ayuda="opcional" imagen={a.imagen} alto="h-44"
          alSubir={(img) => setA((x) => ({ ...x, imagen: img.url }))} alQuitar={() => setA((x) => ({ ...x, imagen: '' }))} />
      </div>
      <EditorTexto id="ar-contenido" etiqueta="Contenido" valor={a.contenido} cambiar={cambiar('contenido')} filas={18} imagenes />
      <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
        <input type="checkbox" checked={a.publicado} onChange={(e) => cambiar('publicado')(e.target.checked)} className="w-5 h-5" />
        Publicado (si lo desmarcas queda como borrador y no se ve en el sitio)
      </label>
      <Aviso aviso={aviso} />
      <div className="flex gap-3">
        <BotonAccion type="submit" color="verde" icono={Save} ocupado={ocupado}>Guardar</BotonAccion>
        <BotonAccion color="gris" onClick={alCancelar}>Cancelar</BotonAccion>
      </div>
    </form>
  );
}
