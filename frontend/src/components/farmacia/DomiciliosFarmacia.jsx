import React, { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, MapPin, Phone, RefreshCw, User, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso, BotonAccion, CampoPesos, claseCampo, useAccion } from './comunes';
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
  en_preparacion: ['en_camino', 'Despachar', 'oscuro'],
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
  const [cantidades, setCantidades] = useState({});
  const [medio, setMedio] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');
  const { ocupado, aviso, ejecutar } = useAccion(recargar);
  const e = ESTADOS_DOMICILIO[d.estado];
  const siguiente = SIGUIENTE[d.estado];
  const cobro = d.cobro ?? totalDomicilio(d);

  // Al despachar se elige cuánto sale (por defecto, lo pendiente que haya disponible);
  // al entregar, cuánto recibió el paciente (por defecto, todo lo despachado)
  const despachando = d.estado === 'en_preparacion';
  const entregando = d.estado === 'en_camino';
  const filas = despachando ? (d.medicamentos ?? []).map((m) => ({ ...m, maximo: Math.min(m.pendiente, m.disponible) }))
    : (d.despacho ?? []).map((m) => ({ ...m, maximo: m.despachada }));
  const cantidad = (m) => {
    const v = cantidades[m.formula_item_id];
    return v === undefined ? m.maximo : v === '' ? 0 : Number(v);
  };
  const enviados = filas.map((m) => ({ formula_item_id: m.formula_item_id, cantidad: cantidad(m) }));
  const cantidadesValidas = filas.every((m) => Number.isInteger(cantidad(m)) && cantidad(m) >= 0 && cantidad(m) <= m.maximo);
  const algo = enviados.some((it) => it.cantidad > 0);
  const devueltas = entregando ? filas.reduce((s, m) => s + m.maximo - cantidad(m), 0) : 0;

  const cambiar = (estado, texto) =>
    ejecutar(() => api(`/domicilios/${d.id}`, { metodo: 'PATCH', cuerpo: {
      estado, nota: nota.trim() || undefined,
      ...(estado === 'en_camino' ? { items: enviados.filter((it) => it.cantidad > 0) } : {}),
      ...(estado === 'entregado' ? {
        items: enviados,
        pago: { medio, recibido: recibido === '' ? null : Number(recibido), referencia },
      } : {}),
    } }), texto);

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

      {(despachando || entregando) && filas.length > 0 ? (
        <div className="text-sm bg-slate-50 rounded-lg p-3 space-y-1.5">
          <p className="font-bold text-slate-800">
            {despachando ? 'Unidades que salen (se descuentan del inventario al despachar)' : 'Unidades que recibió el paciente'}
          </p>
          <ul className="space-y-1.5">
            {filas.map((m) => (
              <li key={m.formula_item_id} className="flex flex-wrap items-center gap-2">
                <span>
                  {m.nombre} {m.presentacion}
                  <span className="block text-xs text-slate-500">
                    {despachando
                      ? `Pendientes ${m.pendiente} · disponibles ${m.disponible}`
                      : `Despachadas ${m.despachada}`}
                  </span>
                </span>
                <input type="number" min="0" max={m.maximo} step="1" disabled={ocupado}
                  aria-label={`${despachando ? 'Unidades a despachar' : 'Unidades entregadas'} de ${m.nombre} ${m.presentacion}`}
                  value={cantidades[m.formula_item_id] ?? m.maximo}
                  onChange={(ev) => setCantidades((prev) => ({ ...prev, [m.formula_item_id]: ev.target.value }))}
                  className={`${claseCampo} w-24 ml-auto`} />
              </li>
            ))}
          </ul>
          {!cantidadesValidas && <p className="text-red-700">Revisa las cantidades: no pueden superar el máximo indicado.</p>}
          {despachando && cantidadesValidas && !algo && <p className="text-red-700">No hay unidades disponibles para despachar.</p>}
          {entregando && devueltas > 0 && cantidadesValidas && (
            <p className="text-amber-800">{devueltas} {devueltas === 1 ? 'unidad vuelve' : 'unidades vuelven'} al inventario.</p>
          )}
        </div>
      ) : d.despacho?.length > 0 ? (
        <ul className="text-sm bg-slate-50 rounded-lg p-3 space-y-0.5">
          {d.despacho.map((m) => {
            const devuelto = m.despachada - (m.entregada ?? m.despachada);
            return (
              <li key={m.formula_item_id}>
                <strong>{d.estado === 'cancelado' ? m.despachada : m.entregada ?? m.despachada}</strong> × {m.nombre} {m.presentacion}
                {d.estado === 'cancelado' ? ' · devueltas al inventario' : devuelto > 0 ? ` · ${devuelto} devueltas al inventario` : ''}
              </li>
            );
          })}
        </ul>
      ) : d.medicamentos?.length > 0 && (
        <ul className="text-sm bg-slate-50 rounded-lg p-3 space-y-0.5">
          {d.medicamentos.map((m) => (
            <li key={m.formula_item_id}>
              <strong>{m.pendiente}</strong> × {m.nombre} {m.presentacion}
              {m.disponible < m.pendiente && <span className="text-amber-800"> · solo {m.disponible} disponibles</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="text-sm border border-slate-200 rounded-lg p-3">
        <p className="font-bold text-slate-800">
          {d.estado === 'entregado' ? (d.cobro ? 'Cobrado al entregar' : 'Sin recibo registrado · valor estimado') : 'Cobrar al entregar'}: {pesos(cobro.total)}
        </p>
        <p className="text-slate-500">
          {cobro.cuota > 0 ? `Cuota moderadora ${pesos(cobro.cuota)} + ` : 'Sin cuota moderadora · '}envío {pesos(cobro.envio)}
        </p>
      </div>
      {d.estado === 'en_camino' && cobro.total > 0 && (
        <fieldset disabled={ocupado} className="space-y-2 border border-slate-200 rounded-lg p-3 text-sm">
          <legend className="font-bold">Pago recibido al entregar</legend>
          <label className="block">Medio de pago
            <select value={medio} onChange={(ev) => setMedio(ev.target.value)} className={claseCampo}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="datafono">Tarjeta (datáfono)</option>
            </select>
          </label>
          {medio === 'efectivo' ? (
            <label className="block">Efectivo recibido
              <CampoPesos valor={recibido} cambiar={setRecibido} placeholder={cobro.total} />
            </label>
          ) : (
            <label className="block">Referencia de transferencia o voucher
              <input value={referencia} minLength={3} maxLength={40}
                onChange={(ev) => setReferencia(ev.target.value)} className={claseCampo} />
            </label>
          )}
          {medio === 'efectivo' && Number(recibido) >= cobro.total && <p>Cambio: {pesos(Number(recibido) - cobro.total)}</p>}
        </fieldset>
      )}
      {d.nota_farmacia && <p className="text-sm text-slate-600">Nota al paciente: {d.nota_farmacia}</p>}

      {siguiente && (
        <div className="border-t border-slate-200 pt-3 space-y-2">
          <input value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={300}
            placeholder="Mensaje para el paciente (opcional), ej.: llega entre 2 y 4 p. m."
            className={`${claseCampo} text-sm`} />
          <div className="flex flex-wrap gap-2">
            <BotonAccion color={siguiente[2]} icono={siguiente[0] === 'entregado' ? CheckCircle2 : Bike}
              ocupado={ocupado || ((despachando || entregando) && (!cantidadesValidas || !algo))}
              onClick={() => cambiar(siguiente[0], `Domicilio: ${ESTADOS_DOMICILIO[siguiente[0]].texto.toLowerCase()}`)}>
              {siguiente[1]}
            </BotonAccion>
            <BotonAccion color="gris" ocupado={ocupado} icono={XCircle}
              onClick={() => window.confirm(entregando
                ? '¿Cancelar este domicilio? Los medicamentos despachados volverán al inventario.'
                : '¿Cancelar este domicilio?') && cambiar('cancelado', 'Domicilio cancelado')}>
              Cancelar
            </BotonAccion>
          </div>
        </div>
      )}
      <Aviso aviso={aviso} />
    </article>
  );
}
