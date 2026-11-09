import React, { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, MapPin, Phone, RefreshCw, User, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso, BotonAccion, claseCampo, useAccion } from './comunes';
import { ESTADOS_DOMICILIO } from '../../paginas/MiCuenta';
import { totalDomicilio } from '../../lib/costoEnvio';

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;
const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const FILTROS = [
  ['activos', 'En curso'],
  ['entregado', 'Entregados'],
  ['cancelado', 'Cancelados'],
];

// Siguiente paso de cada estado (el backend valida lo mismo)
const SIGUIENTE = {
  recibido: ['en_preparacion', 'Empezar a preparar', 'ambar'],
  en_preparacion: ['en_camino', 'Salió a entregar', 'oscuro'],
  en_camino: ['entregado', 'Marcar entregado', 'verde'],
};

export default function DomiciliosFarmacia() {
  const [filtro, setFiltro] = useState('activos');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const d = await api(`/domicilios?estado=${filtro}`);
      setLista(d.domicilios);
      setError(null);
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, [filtro]);

  // Se actualiza solo cada 30 segundos
  useEffect(() => {
    setLista(null);
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Bike className="w-6 h-6" /> Domicilios</h1>
        <div className="flex items-center gap-2">
          {FILTROS.map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setFiltro(id)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold cursor-pointer ${
                filtro === id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              {texto}
            </button>
          ))}
          <button type="button" onClick={cargar} aria-label="Actualizar" className="p-2 rounded-lg hover:bg-slate-200 cursor-pointer">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Aviso aviso={error} />
      {lista === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl p-10">
          No hay domicilios {filtro === 'activos' ? 'en curso' : FILTROS.find(([id]) => id === filtro)[1].toLowerCase()}.
        </p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {lista.map((d) => <TarjetaDomicilio key={d.id} d={d} recargar={cargar} />)}
        </div>
      )}
    </div>
  );
}

function TarjetaDomicilio({ d, recargar }) {
  const [nota, setNota] = useState('');
  const { ocupado, aviso, ejecutar } = useAccion(recargar);
  const e = ESTADOS_DOMICILIO[d.estado];
  const siguiente = SIGUIENTE[d.estado];
  const cobro = totalDomicilio(d);

  const cambiar = (estado, texto) =>
    ejecutar(() => api(`/domicilios/${d.id}`, { metodo: 'PATCH', cuerpo: { estado, nota: nota.trim() || undefined } }), texto);

  return (
    <article className="bg-white border border-slate-300 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900 flex items-center gap-1.5"><User className="w-4 h-4" /> {d.paciente}</p>
          <p className="text-sm text-slate-500">{d.tipo_documento} {d.documento} · Fórmula {d.codigo} · {fechaHora(d.creado_en)}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${e.clase}`}>{e.texto}</span>
      </div>

      <div className="text-sm text-slate-700 space-y-1">
        <p className="flex gap-1.5"><MapPin className="w-4 h-4 mt-0.5 shrink-0" />
          {d.direccion}{d.barrio ? `, ${d.barrio}` : ''}, {d.ciudad}</p>
        <p className="flex gap-1.5"><Phone className="w-4 h-4 mt-0.5 shrink-0" />
          <a href={`tel:${d.telefono}`} className="underline">{d.telefono}</a>
          {d.recibe && <span className="text-slate-500">· Recibe: {d.recibe}</span>}</p>
        {d.indicaciones && <p className="text-slate-500 italic">“{d.indicaciones}”</p>}
      </div>

      {d.medicamentos?.length > 0 && (
        <ul className="text-sm bg-slate-50 rounded-lg p-3 space-y-0.5">
          {d.medicamentos.map((m) => (
            <li key={m.nombre + m.presentacion}><strong>{m.pendiente}</strong> × {m.nombre} {m.presentacion}</li>
          ))}
        </ul>
      )}
      <div className="text-sm border border-slate-200 rounded-lg p-3">
        <p className="font-bold text-slate-800">
          {d.estado === 'entregado' ? 'Cobrado al entregar' : 'Cobrar al entregar'}: {pesos(cobro.total)}
        </p>
        <p className="text-slate-500">
          {cobro.cuota > 0 ? `Cuota moderadora ${pesos(cobro.cuota)} + ` : 'Sin cuota moderadora · '}envío {pesos(cobro.envio)}
        </p>
      </div>
      {d.nota_farmacia && <p className="text-sm text-slate-600">Nota al paciente: {d.nota_farmacia}</p>}

      {siguiente && (
        <div className="border-t border-slate-200 pt-3 space-y-2">
          <input value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={300}
            placeholder="Mensaje para el paciente (opcional), ej.: llega entre 2 y 4 p. m."
            className={`${claseCampo} text-sm`} />
          <div className="flex flex-wrap gap-2">
            <BotonAccion color={siguiente[2]} ocupado={ocupado} icono={siguiente[0] === 'entregado' ? CheckCircle2 : Bike}
              onClick={() => cambiar(siguiente[0], `Domicilio: ${ESTADOS_DOMICILIO[siguiente[0]].texto.toLowerCase()}`)}>
              {siguiente[1]}
            </BotonAccion>
            <BotonAccion color="gris" ocupado={ocupado} icono={XCircle}
              onClick={() => window.confirm('¿Cancelar este domicilio?') && cambiar('cancelado', 'Domicilio cancelado')}>
              Cancelar
            </BotonAccion>
          </div>
        </div>
      )}
      <Aviso aviso={aviso} />
    </article>
  );
}
