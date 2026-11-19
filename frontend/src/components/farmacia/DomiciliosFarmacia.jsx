import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRightLeft, BadgeCheck, Banknote, Bike, CheckCircle2, Clock, MapPin, Phone, RefreshCw, User, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useSocketEnVivo } from '../../lib/tiempoReal';
import { Aviso, BotonAccion, CampoPesos, claseCampo, useAccion } from './comunes';
import { ESTADOS_DOMICILIO } from '../../paginas/MiCuenta';
import { totalDomicilio, useDatosDomicilio } from '../../lib/costoEnvio';

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;
// "hace 25 min", "hace 1 h 10 min"
export function hace(iso) {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`;
}

// Estado de un domiciliario, calculado por el servidor según sus entregas (nadie lo marca)
export function estadoDomiciliario(u) {
  if (u.en_camino > 0) {
    return `En ruta con ${u.en_camino} ${u.en_camino === 1 ? 'entrega' : 'entregas'} · salió ${hace(u.en_ruta_desde)}`;
  }
  if (u.ultima_entrega_en && Date.now() - new Date(u.ultima_entrega_en).getTime() < 60 * 60000) {
    return `Disponible · entregó lo último ${hace(u.ultima_entrega_en)} (puede venir de regreso)`;
  }
  return 'Disponible';
}

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
  const [domiciliarios, setDomiciliarios] = useState([]);   // quién puede llevar los pedidos
  const [error, setError] = useState(null);
  const datosDomicilio = useDatosDomicilio();

  const cargar = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([api(`/domicilios?estado=${filtro}`), api('/domicilios/domiciliarios')]);
      setLista(d.domicilios);
      setDomiciliarios(r.domiciliarios);
      setError(null);
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, [filtro]);

  // Se actualiza al instante cuando un pedido cambia (lo pide o cancela el paciente, o lo mueve
  // otro equipo de la farmacia); cada 30 segundos, por si se perdió la conexión en vivo
  useEffect(() => {
    setLista(null);
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);
  const socket = useSocketEnVivo();
  useEffect(() => {
    if (!socket) return undefined;
    socket.on('domicilios_actualizados', cargar);
    return () => socket.off('domicilios_actualizados', cargar);
  }, [socket, cargar]);

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
      {datosDomicilio && !datosDomicilio.transferencia && (
        <p className="flex items-start gap-2 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3">
          <Banknote className="w-4 h-4 mt-0.5 shrink-0" />
          Los pacientes no pueden pagar por transferencia: falta la cuenta donde la farmacia recibe los pagos.
          El administrador la registra en Tarifas.
        </p>
      )}
      {filtro === 'activos' && <EstadoDomiciliarios domiciliarios={domiciliarios} lista={lista} />}
      {lista === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl p-10">
          No hay domicilios {filtro === 'activos' ? 'en curso' : FILTROS.find(([id]) => id === filtro)[1].toLowerCase()}.
        </p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {lista.map((d) => <TarjetaDomicilio key={d.id} d={d} domiciliarios={domiciliarios} recargar={cargar} />)}
        </div>
      )}
    </div>
  );
}

function TarjetaDomicilio({ d, domiciliarios, recargar }) {
  const [nota, setNota] = useState('');
  // Quién lo lleva: se elige al despachar (si hay un solo domiciliario, queda elegido)
  const [domiciliario, setDomiciliario] = useState('');
  const domiciliarioElegido = domiciliario || (domiciliarios.length === 1 ? String(domiciliarios[0].id) : '');
  const faltaDomiciliario = domiciliarios.length > 0 && !domiciliarioElegido;
  const [otroDomiciliario, setOtroDomiciliario] = useState('');   // para pasar un pedido en camino a otro
  const otros = domiciliarios.filter((u) => u.id !== d.domiciliario_id);
  const pasarAOtro = async () => {
    const ok = await ejecutar(() => api(`/domicilios/${d.id}/domiciliario`, { metodo: 'POST',
      cuerpo: { domiciliario_id: Number(otroDomiciliario) } }), 'Domiciliario cambiado');
    if (ok) setOtroDomiciliario('');
  };
  const [cantidades, setCantidades] = useState({});
  const [medio, setMedio] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');
  const { ocupado, aviso, ejecutar } = useAccion(recargar);
  const e = ESTADOS_DOMICILIO[d.estado];
  const siguiente = SIGUIENTE[d.estado];
  const cobro = d.cobro ?? totalDomicilio(d);
  // Pagado por transferencia al pedirlo: se confirma en el banco antes de despachar y al entregar no se cobra
  const prepago = d.forma_pago === 'transferencia';
  const pagoPorConfirmar = prepago && !d.pago_verificado_en;

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
      ...(estado === 'en_camino' ? {
        items: enviados.filter((it) => it.cantidad > 0),
        ...(domiciliarioElegido ? { domiciliario_id: Number(domiciliarioElegido) } : {}),
      } : {}),
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
      {prepago ? (
        <PagoPorTransferencia d={d} cobro={cobro} ocupado={ocupado}
          confirmar={() => ejecutar(() => api(`/domicilios/${d.id}/pago-verificado`, { metodo: 'POST' }), 'Pago confirmado: ya se puede despachar')} />
      ) : (
        <div className="text-sm border border-slate-200 rounded-lg p-3">
          <p className="font-bold text-slate-800">
            {d.estado === 'entregado' ? (d.cobro ? 'Cobrado al entregar' : 'Sin recibo registrado · valor estimado') : 'Contraentrega · cobrar al entregar'}: {pesos(cobro.total)}
          </p>
          <p className="text-slate-500">
            {cobro.cuota > 0 ? `Cuota moderadora ${pesos(cobro.cuota)} + ` : 'Sin cuota moderadora · '}envío {pesos(cobro.envio)}
          </p>
        </div>
      )}
      {d.estado === 'en_camino' && cobro.total > 0 && !prepago && (
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
      {d.domiciliario && ['en_camino', 'entregado'].includes(d.estado) && (
        <p className="text-sm text-slate-700 flex items-center gap-1.5"><Bike className="w-4 h-4" /> Lo lleva: <strong>{d.domiciliario}</strong></p>
      )}
      {d.estado === 'en_camino' && otros.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <select value={otroDomiciliario} onChange={(ev) => setOtroDomiciliario(ev.target.value)} disabled={ocupado}
            aria-label="Pasar el pedido a otro domiciliario" className={claseCampo}>
            <option value="">{d.domiciliario ? 'Pasarlo a otro domiciliario…' : 'Asignarle un domiciliario…'}</option>
            {otros.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} — {u.en_camino ? `en ruta con ${u.en_camino}` : 'disponible'}</option>
            ))}
          </select>
          <BotonAccion color="contorno" icono={ArrowRightLeft} ocupado={ocupado || !otroDomiciliario} onClick={pasarAOtro}>
            {d.domiciliario ? 'Pasar' : 'Asignar'}
          </BotonAccion>
        </div>
      )}
      {despachando && domiciliarios.length > 0 && (
        <label className="block text-sm font-bold text-slate-800">¿Quién lo lleva?
          <select value={domiciliarioElegido} onChange={(ev) => setDomiciliario(ev.target.value)} disabled={ocupado}
            className={`${claseCampo} font-normal`}>
            <option value="">Elige el domiciliario</option>
            {domiciliarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre} — {u.en_camino ? `en ruta con ${u.en_camino}` : 'disponible'}</option>
            ))}
          </select>
        </label>
      )}
      {d.nota_farmacia && <p className="text-sm text-slate-600">Nota al paciente: {d.nota_farmacia}</p>}

      {siguiente && (
        <div className="border-t border-slate-200 pt-3 space-y-2">
          <input value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={300}
            placeholder="Mensaje para el paciente (opcional), ej.: llega entre 2 y 4 p. m."
            className={`${claseCampo} text-sm`} />
          <div className="flex flex-wrap gap-2">
            <BotonAccion color={siguiente[2]} icono={siguiente[0] === 'entregado' ? CheckCircle2 : Bike}
              ocupado={ocupado || ((despachando || entregando) && (!cantidadesValidas || !algo)) || (despachando && (pagoPorConfirmar || faltaDomiciliario)) || (entregando && pagoPorConfirmar)}
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

// El paciente pagó por transferencia al pedir el domicilio
function PagoPorTransferencia({ d, cobro, ocupado, confirmar }) {
  const comprobante = <>comprobante <strong>{d.pago_referencia}</strong></>;
  // Si mientras tanto la cuota se pagó en ventanilla, el paciente pagó de más
  const saldoAFavor = d.estado !== 'cancelado' ? d.pago_valor - cobro.total : 0;
  if (d.estado === 'cancelado') {
    return (
      <div className="text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3">
        <p className="font-bold">{d.pago_verificado_en
          ? `Devolver ${pesos(d.pago_valor)} al paciente`
          : `Si la transferencia llegó, devolver ${pesos(d.pago_valor)} al paciente`}</p>
        <p>Pagó por transferencia · {comprobante}</p>
      </div>
    );
  }
  if (!d.pago_verificado_en) {
    return (
      <div className="text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 space-y-2">
        <p className="font-bold flex items-center gap-1.5"><Banknote className="w-4 h-4" /> Pagó por transferencia {pesos(d.pago_valor)} · por confirmar</p>
        <p>{comprobante}. Revisa en el banco o la billetera que el dinero llegó: el pedido no se puede
          {d.estado === 'en_camino' ? ' marcar entregado' : ' despachar'} hasta confirmarlo.
          {d.estado === 'en_camino' ? ' El domiciliario ya no le cobra.' : ' Si no llegó, cancélalo con un mensaje para el paciente.'}</p>
        <BotonAccion color="verde" icono={BadgeCheck} ocupado={ocupado} onClick={confirmar}>Confirmar que llegó el pago</BotonAccion>
      </div>
    );
  }
  return (
    <div className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-3">
      <p className="font-bold flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" /> Pagado por transferencia: {pesos(d.pago_valor)}</p>
      <p>{comprobante} · el domiciliario no cobra nada al entregar.</p>
      {saldoAFavor > 0 && <p className="font-bold text-amber-900 mt-1">Saldo a favor del paciente: {pesos(saldoAFavor)} (la cuota se pagó por otro lado): devolvérselo.</p>}
    </div>
  );
}

// Arriba del panel: dónde está cada domiciliario y, si todos están en ruta, cuántos pedidos esperan
function EstadoDomiciliarios({ domiciliarios, lista }) {
  if (!domiciliarios.length) return null;
  const todosEnRuta = domiciliarios.every((u) => u.en_camino > 0);
  const porSalir = (lista ?? []).filter((d) => d.estado === 'en_preparacion').length;
  return (
    <section aria-label="Domiciliarios" className="grid sm:grid-cols-2 gap-2">
      {domiciliarios.map((u) => (
        <div key={u.id} className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
          u.en_camino ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-emerald-50 border-emerald-300 text-emerald-950'}`}>
          {u.en_camino ? <Bike className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <div>
            <p className="font-bold">{u.nombre}</p>
            <p>{estadoDomiciliario(u)}</p>
          </div>
        </div>
      ))}
      {todosEnRuta && porSalir > 0 && (
        <p className="sm:col-span-2 text-sm bg-amber-100 text-amber-950 rounded-lg p-3 flex items-start gap-2">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          {domiciliarios.length === 1 ? 'El domiciliario está en ruta' : `Los ${domiciliarios.length} domiciliarios están en ruta`}:
          {' '}{porSalir} {porSalir === 1 ? 'pedido espera' : 'pedidos esperan'} para salir. Los pacientes ven que su pedido
          sale cuando regrese un domiciliario, y el que termine primero ve que hay pedidos esperando.
        </p>
      )}
    </section>
  );
}
