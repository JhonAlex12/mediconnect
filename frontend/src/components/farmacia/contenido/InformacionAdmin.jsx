import React, { useCallback, useEffect, useState } from 'react';
import { EyeOff, Plus, Save } from 'lucide-react';
import { api } from '../../../lib/api';
import { useContenido } from '../../../lib/contenido';
import { TablaCuotas } from '../../../paginas/Informacion';
import { Aviso, BotonAccion, useAccion } from '../comunes';
import { AccionesFila, CampoTexto, EditorTexto } from './comunes';

const VACIA = { titulo: '', ancla: '', contenido: '', visible: true };
const aAncla = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function InformacionAdmin() {
  const { recargar: recargarSitio } = useContenido();
  const [secciones, setSecciones] = useState(null);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setSecciones((await api('/contenido/admin/secciones')).secciones);
      await recargarSitio();
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, [recargarSitio]);
  useEffect(() => { cargar(); }, [cargar]);
  const { ocupado, aviso, ejecutar } = useAccion(cargar);

  const ordenar = (i, delta) => {
    const ids = secciones.map((s) => s.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    ejecutar(() => api('/contenido/admin/secciones/orden', { metodo: 'PUT', cuerpo: { ids } }), 'Orden guardado');
  };

  if (editando) {
    return (
      <FormularioSeccion inicial={editando === 'nueva' ? VACIA : editando}
        alTerminar={async () => { setEditando(null); await cargar(); }} alCancelar={() => setEditando(null)} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-slate-600 max-w-2xl">
          Secciones de la página “Información al paciente”, en el orden en que se muestran.
        </p>
        <BotonAccion color="verde" icono={Plus} onClick={() => setEditando('nueva')}>Nueva sección</BotonAccion>
      </div>
      <Aviso aviso={error ?? aviso} />
      {secciones === null ? <p className="text-slate-500">Cargando…</p> : (
        <ul className="bg-white rounded-xl border border-slate-300 divide-y divide-slate-200">
          {secciones.map((s, i) => (
            <li key={s.id} className="p-3 pl-5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{s.titulo}</p>
                <p className="text-sm text-slate-500">
                  /informacion#{s.ancla}
                  {!s.visible && <span className="ml-2 inline-flex items-center gap-1 font-bold text-amber-700"><EyeOff className="w-3.5 h-3.5" /> Oculta</span>}
                </p>
              </div>
              <AccionesFila primero={i === 0} ultimo={i === secciones.length - 1} ocupado={ocupado}
                alSubir={() => ordenar(i, -1)} alBajar={() => ordenar(i, 1)} alEditar={() => setEditando(s)}
                alEliminar={() => window.confirm(`¿Eliminar la sección "${s.titulo}"?`)
                  && ejecutar(() => api(`/contenido/admin/secciones/${s.id}`, { metodo: 'DELETE' }), 'Sección eliminada')} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormularioSeccion({ inicial, alTerminar, alCancelar }) {
  const { contacto } = useContenido();
  const [s, setS] = useState({ ...VACIA, ...inicial });
  const [tarifa, setTarifa] = useState(null);
  const { ocupado, aviso, ejecutar } = useAccion();
  const nueva = !inicial.id;

  useEffect(() => {
    api('/tarifas/vigentes', { token: null }).then((r) => setTarifa(r.tarifa)).catch(() => {});
  }, []);

  const cambiar = (k) => (v) => setS((x) => ({ ...x, [k]: v, ...(k === 'titulo' && nueva ? { ancla: aAncla(v) } : {}) }));

  const guardar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api(nueva ? '/contenido/admin/secciones' : `/contenido/admin/secciones/${inicial.id}`, { metodo: nueva ? 'POST' : 'PUT', cuerpo: s }),
      'Sección guardada'
    );
    if (ok) await alTerminar();
  };

  return (
    <form onSubmit={guardar} className="bg-white rounded-xl border border-slate-300 p-5 space-y-5">
      <h3 className="text-lg font-bold text-slate-900">{nueva ? 'Nueva sección' : `Editar: ${inicial.titulo}`}</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <CampoTexto id="se-titulo" etiqueta="Título" valor={s.titulo} cambiar={cambiar('titulo')} maxLength={120} required />
        <CampoTexto id="se-ancla" etiqueta="Ancla" ayuda="para enlazar: /informacion#ancla" valor={s.ancla}
          cambiar={(v) => setS((x) => ({ ...x, ancla: aAncla(v) }))} maxLength={40} required />
      </div>
      <EditorTexto id="se-contenido" etiqueta="Contenido" valor={s.contenido} cambiar={cambiar('contenido')}
        datos={contacto} especiales={{ tabla_cuotas: <TablaCuotas tarifa={tarifa} /> }}
        ayudaExtra={[['{tabla_cuotas}', 'tabla con los valores vigentes de la cuota moderadora (sola en su línea)']]} />
      <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
        <input type="checkbox" checked={s.visible} onChange={(e) => cambiar('visible')(e.target.checked)} className="w-5 h-5" />
        Mostrar en el sitio
      </label>
      <Aviso aviso={aviso} />
      <div className="flex gap-3">
        <BotonAccion type="submit" color="verde" icono={Save} ocupado={ocupado}>Guardar</BotonAccion>
        <BotonAccion color="gris" onClick={alCancelar}>Cancelar</BotonAccion>
      </div>
    </form>
  );
}
