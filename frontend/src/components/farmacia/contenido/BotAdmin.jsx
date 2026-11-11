import React, { useCallback, useEffect, useState } from 'react';
import { EyeOff, MessageCirclePlus, Plus, Save, Star, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useContenido } from '../../../lib/contenido';
import { TablaCuotas } from '../../../paginas/Informacion';
import { Aviso, BotonAccion, claseCampo, useAccion } from '../comunes';
import { AccionesFila, CampoTexto, EditorTexto, Etiqueta } from './comunes';

const VACIA = { pregunta: '', variantes: '', respuesta: '', enlace: '', sugerida: false, activa: true };

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

// Preguntas que responde Mediconnect Bot y lo que los pacientes preguntaron sin obtener respuesta
export default function BotAdmin() {
  const [preguntas, setPreguntas] = useState(null);
  const [sinRespuesta, setSinRespuesta] = useState(null);
  const [editando, setEditando] = useState(null); // null | { ...pregunta } | { ...VACIA, desde: 'texto' }
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api('/bot/admin/preguntas'), api('/bot/admin/sin-respuesta')]);
      setPreguntas(p.preguntas);
      setSinRespuesta(s.preguntas);
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const { ocupado, aviso, ejecutar } = useAccion(cargar);

  const ordenar = (i, delta) => {
    const ids = preguntas.map((p) => p.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    ejecutar(() => api('/bot/admin/preguntas/orden', { metodo: 'PUT', cuerpo: { ids } }), 'Orden guardado');
  };

  const descartar = (texto) => ejecutar(
    () => api('/bot/admin/sin-respuesta/descartar', { metodo: 'POST', cuerpo: { texto } }), 'Pregunta descartada');

  if (editando) {
    return (
      <FormularioPregunta inicial={editando}
        alTerminar={async () => {
          // Si la respuesta nació de una pregunta sin responder, esa pregunta sale de la lista
          if (editando.desde) await api('/bot/admin/sin-respuesta/descartar', { metodo: 'POST', cuerpo: { texto: editando.desde } }).catch(() => {});
          setEditando(null);
          await cargar();
        }}
        alCancelar={() => setEditando(null)} />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-600 max-w-2xl">
            Lo que responde <strong>Mediconnect Bot</strong> en el chat del sitio. Además de estas preguntas, el bot busca en
            “Información al paciente” y en “Salud al día”. Las marcadas con <Star className="w-4 h-4 inline text-amber-500 fill-amber-400" /> aparecen
            como botones al abrir el chat.
          </p>
          <BotonAccion color="verde" icono={Plus} onClick={() => setEditando(VACIA)}>Nueva pregunta</BotonAccion>
        </div>
        <Aviso aviso={error ?? aviso} />
        {preguntas === null ? <p className="text-slate-500">Cargando…</p> : (
          <ul className="bg-white rounded-xl border border-slate-300 divide-y divide-slate-200">
            {preguntas.length === 0 && <li className="p-5 text-slate-500">Aún no hay preguntas.</li>}
            {preguntas.map((p, i) => (
              <li key={p.id} className="p-3 pl-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                    {p.sugerida && <Star className="w-4 h-4 shrink-0 text-amber-500 fill-amber-400" aria-label="Sugerida" />}
                    <span className="truncate">{p.pregunta}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    {p.veces_usada === 1 ? 'Respondida 1 vez' : `Respondida ${p.veces_usada} veces`}
                    {p.variantes && ` · ${p.variantes.split('\n').length} formas de preguntarlo`}
                    {!p.activa && <span className="ml-2 inline-flex items-center gap-1 font-bold text-amber-700"><EyeOff className="w-3.5 h-3.5" /> Desactivada</span>}
                  </p>
                </div>
                <AccionesFila primero={i === 0} ultimo={i === preguntas.length - 1} ocupado={ocupado}
                  alSubir={() => ordenar(i, -1)} alBajar={() => ordenar(i, 1)} alEditar={() => setEditando(p)}
                  alEliminar={() => window.confirm(`¿Eliminar la pregunta "${p.pregunta}"?`)
                    && ejecutar(() => api(`/bot/admin/preguntas/${p.id}`, { metodo: 'DELETE' }), 'Pregunta eliminada')} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900">Preguntas que el bot no supo responder</h3>
        <p className="text-slate-600 max-w-2xl text-sm">
          Si algo se repite, créale una respuesta. Los números largos y los correos se guardan ocultos, y la lista se borra sola a los 60 días.
        </p>
        {sinRespuesta === null ? <p className="text-slate-500">Cargando…</p> : sinRespuesta.length === 0 ? (
          <p className="bg-white rounded-xl border border-slate-300 p-5 text-slate-500">Por ahora no hay preguntas sin respuesta.</p>
        ) : (
          <ul className="bg-white rounded-xl border border-slate-300 divide-y divide-slate-200">
            {sinRespuesta.map((s) => (
              <li key={s.texto} className="p-3 pl-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex-1 min-w-48">
                  <p className="text-slate-900">“{s.texto}”</p>
                  <p className="text-sm text-slate-500">
                    {s.veces === 1 ? '1 vez' : `${s.veces} veces`} · última: {fechaCorta(s.ultima)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditando({ ...VACIA, pregunta: s.texto.slice(0, 160), variantes: s.texto, desde: s.texto })}
                    className="flex items-center gap-1.5 text-sm font-semibold bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg cursor-pointer">
                    <MessageCirclePlus className="w-4 h-4" /> Crear respuesta
                  </button>
                  <button type="button" onClick={() => descartar(s.texto)} disabled={ocupado} aria-label="Descartar"
                    className="p-2 rounded-lg hover:bg-red-50 text-red-700 cursor-pointer disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FormularioPregunta({ inicial, alTerminar, alCancelar }) {
  const { contacto } = useContenido();
  const [p, setP] = useState({ ...VACIA, ...inicial, enlace: inicial.enlace ?? '' });
  const [tarifa, setTarifa] = useState(null);
  const [envio, setEnvio] = useState(null);
  const { ocupado, aviso, ejecutar } = useAccion();
  const nueva = !inicial.id;

  useEffect(() => {
    api('/tarifas/vigentes', { token: null }).then((r) => setTarifa(r.tarifa)).catch(() => {});
    api('/tarifas/domicilio', { token: null }).then((r) => setEnvio(r.costo_envio)).catch(() => {});
  }, []);

  const cambiar = (k) => (v) => setP((x) => ({ ...x, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    const cuerpo = { pregunta: p.pregunta, variantes: p.variantes, respuesta: p.respuesta, enlace: p.enlace, sugerida: p.sugerida, activa: p.activa };
    const ok = await ejecutar(
      () => api(nueva ? '/bot/admin/preguntas' : `/bot/admin/preguntas/${inicial.id}`, { metodo: nueva ? 'POST' : 'PUT', cuerpo }),
      'Pregunta guardada'
    );
    if (ok) await alTerminar();
  };

  const datos = { ...contacto, costo_envio: envio === null ? '' : `$${envio.toLocaleString('es-CO')}` };

  return (
    <form onSubmit={guardar} className="bg-white rounded-xl border border-slate-300 p-5 space-y-5">
      <h3 className="text-lg font-bold text-slate-900">{nueva ? 'Nueva pregunta del bot' : 'Editar pregunta del bot'}</h3>
      <CampoTexto id="bot-pregunta" etiqueta="Pregunta" ayuda="como la vería el paciente, ej.: ¿Hacen domicilios?"
        valor={p.pregunta} cambiar={cambiar('pregunta')} maxLength={160} required />
      <div>
        <Etiqueta htmlFor="bot-variantes" ayuda="una por línea; ayudan a que el bot la reconozca">Otras formas de preguntarlo</Etiqueta>
        <textarea id="bot-variantes" value={p.variantes} onChange={(e) => cambiar('variantes')(e.target.value)} rows={5}
          placeholder={'me llevan los medicamentos a la casa\ncuánto cuesta el envío'} className={claseCampo} />
      </div>
      <EditorTexto id="bot-respuesta" etiqueta="Respuesta" valor={p.respuesta} cambiar={cambiar('respuesta')} filas={8}
        datos={datos} especiales={{ tabla_cuotas: <TablaCuotas tarifa={tarifa} /> }}
        ayudaExtra={[
          ['{costo_envio}', 'costo actual del domicilio'],
          ['{tabla_cuotas}', 'valores vigentes de la cuota moderadora (sola en su línea)'],
        ]} />
      <CampoTexto id="bot-enlace" etiqueta="Enlace “Ver más”" ayuda="opcional: /informacion#cuotas, /paciente…"
        valor={p.enlace} cambiar={cambiar('enlace')} maxLength={200} />
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
          <input type="checkbox" checked={p.sugerida} onChange={(e) => cambiar('sugerida')(e.target.checked)} className="w-5 h-5" />
          Mostrar como botón al abrir el chat
        </label>
        <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
          <input type="checkbox" checked={p.activa} onChange={(e) => cambiar('activa')(e.target.checked)} className="w-5 h-5" />
          Activa (si la desmarcas, el bot no la usa)
        </label>
      </div>
      <Aviso aviso={aviso} />
      <div className="flex gap-3">
        <BotonAccion type="submit" color="verde" icono={Save} ocupado={ocupado}>Guardar</BotonAccion>
        <BotonAccion color="gris" onClick={alCancelar}>Cancelar</BotonAccion>
      </div>
    </form>
  );
}
