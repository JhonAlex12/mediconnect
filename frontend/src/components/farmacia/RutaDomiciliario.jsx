import React, { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck, Banknote, Bike, CheckCircle2, Clock, Map as IconoMapa, MapPin, MessageCircle, Navigation, Package, Phone, RefreshCw, User,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useContacto } from '../../lib/contenido';
import { useSocketEnVivo } from '../../lib/tiempoReal';
import { totalDomicilio } from '../../lib/costoEnvio';
import { Aviso, BotonAccion, CampoPesos, claseCampo, useAccion } from './comunes';

// "Mis entregas": lo que ve el domiciliario en su celular. Solo los pedidos que le asignaron al
// despacharlos, con la dirección en Google Maps, qué entregar, qué cobrar y el botón para marcarlos entregados.

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;
const hora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

const direccionCompleta = (d) => [d.direccion, d.barrio, d.ciudad, 'Colombia'].filter(Boolean).join(', ');
const enlaceMapa = (d) =>
  `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: direccionCompleta(d), travelmode: 'driving' })}`;
// Todas las entregas en una sola ruta (desde donde esté el domiciliario), en el orden en que salieron.
// Google Maps admite hasta 9 paradas intermedias: se toman las primeras 10 entregas.
const MAXIMO_EN_RUTA = 10;
function enlaceRuta(pedidos) {
  const paradas = pedidos.slice(0, MAXIMO_EN_RUTA).map(direccionCompleta);
  const destino = paradas.pop();
  const p = new URLSearchParams({ api: '1', destination: destino, travelmode: 'driving' });
  if (paradas.length) p.set('waypoints', paradas.join('|'));
  return `https://www.google.com/maps/dir/?${p}`;
}
// Mapas dentro de la página (Google Maps insertado, sin clave de API): la ruta desde la farmacia y cada dirección.
// La navegación con voz y GPS es la de la app: para eso están «Cómo llegar» y «Abrir en Google Maps».
const mapaRuta = (pedidos, origen) => `https://maps.google.com/maps?${new URLSearchParams({
  ...(origen ? { saddr: origen } : {}),
  daddr: pedidos.slice(0, MAXIMO_EN_RUTA).map(direccionCompleta).join(' to:'),
  dirflg: 'd',   // en vehículo (si no, en trayectos cortos Google propone ir a pie)
  hl: 'es', output: 'embed',
})}`;
const mapaPunto = (d) => `https://maps.google.com/maps?${new URLSearchParams({ q: direccionCompleta(d), z: '16', hl: 'es', output: 'embed' })}`;

function MapaInsertado({ src, titulo, alto }) {
  return (
    <iframe src={src} title={titulo} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
      className={`w-full ${alto} rounded-xl border border-slate-300 bg-slate-100`} />
  );
}

const enlaceWhatsapp = (telefono) => `https://wa.me/57${String(telefono).replace(/\D/g, '').slice(-10)}`;

export default function RutaDomiciliario() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api('/domicilios/ruta'));
      setError(null);
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, []);

  // Al instante cuando le despachan un pedido; cada 30 segundos, por si se perdió la conexión en vivo
  useEffect(() => {
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

  const pendientes = datos?.pendientes ?? [];
  const { lat, lon } = useContacto();
  const farmacia = Number.isFinite(lat) && Number.isFinite(lon) ? `${lat},${lon}` : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Bike className="w-6 h-6" /> Mis entregas</h1>
        <button type="button" onClick={cargar} aria-label="Actualizar" className="p-2 rounded-lg hover:bg-slate-200 cursor-pointer">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
      <Aviso aviso={error} />

      {datos === null ? (
        !error && <p className="text-slate-500">Cargando…</p>
      ) : (
        <>
          {pendientes.length === 0 ? (
            datos.en_espera > 0 ? (
              <div role="status" className="bg-amber-100 border border-amber-300 text-amber-950 rounded-xl p-5 text-center space-y-1">
                <p className="text-lg font-bold">
                  {datos.entregados_hoy?.length ? 'Terminaste tu ruta. ' : ''}
                  {datos.en_espera === 1 ? 'Hay 1 pedido esperando' : `Hay ${datos.en_espera} pedidos esperando`} en la farmacia
                </p>
                <p>Vuelve por {datos.en_espera === 1 ? 'él' : 'ellos'}: cuando te los despachen, aparecen aquí.</p>
              </div>
            ) : (
              <p className="bg-white border border-slate-300 rounded-xl p-6 text-center text-slate-600">
                {datos.entregados_hoy?.length ? 'Terminaste tu ruta. ' : ''}No tienes entregas pendientes. Cuando la farmacia
                te despache un pedido, aparece aquí.
              </p>
            )
          ) : (
            <>
              <section className="space-y-2" aria-label="Ruta de entregas">
                <MapaInsertado src={mapaRuta(pendientes, farmacia)} alto="h-72 sm:h-80"
                  titulo={`Ruta de ${pendientes.length === 1 ? 'la entrega' : `las ${pendientes.length} entregas`} desde la farmacia`} />
                <a href={enlaceRuta(pendientes)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-marca-azul hover:bg-marca-azul-oscuro text-white font-bold text-lg py-3.5 rounded-xl shadow">
                  <Navigation className="w-5 h-5" /> Navegar con Google Maps
                </a>
                <p className="text-xs text-slate-500 text-center">El mapa muestra la ruta desde la farmacia; «Navegar» abre la app con voz y GPS desde donde estés.</p>
              </section>
              {pendientes.length > MAXIMO_EN_RUTA && (
                <p className="text-sm text-amber-800">
                  Google Maps muestra hasta {MAXIMO_EN_RUTA} paradas: la ruta incluye las primeras {MAXIMO_EN_RUTA}.
                  Las demás ábrelas con «Cómo llegar».
                </p>
              )}
              {pendientes.map((d, i) => <Entrega key={d.id} d={d} numero={i + 1} recargar={cargar} />)}
              {datos.en_espera > 0 && (
                <p className="text-sm text-slate-600 text-center">
                  En la farmacia {datos.en_espera === 1 ? 'espera 1 pedido más' : `esperan ${datos.en_espera} pedidos más`}.
                </p>
              )}
            </>
          )}
          <EntregadosHoy entregados={datos.entregados_hoy} efectivo={datos.efectivo_hoy} />
        </>
      )}
    </div>
  );
}

function Entrega({ d, numero, recargar }) {
  const [abierto, setAbierto] = useState(false);
  const [conMapa, setConMapa] = useState(false);
  const [cantidades, setCantidades] = useState({});
  const [medio, setMedio] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');
  const { ocupado, aviso, ejecutar } = useAccion(recargar);

  const prepago = d.forma_pago === 'transferencia';
  // Pagó en línea con el pedido ya en camino: no se cobra, pero no se cierra hasta que la farmacia confirme
  const pagoPorConfirmar = prepago && !d.pago_verificado_en;
  const cobro = totalDomicilio(d);
  const cobrar = !prepago && cobro.total > 0;
  const despacho = d.despacho ?? [];
  const cantidad = (m) => {
    const v = cantidades[m.formula_item_id];
    return v === undefined ? m.despachada : v === '' ? 0 : Number(v);
  };
  const cantidadesValidas = despacho.every((m) => Number.isInteger(cantidad(m)) && cantidad(m) >= 0 && cantidad(m) <= m.despachada);
  const algo = despacho.some((m) => cantidad(m) > 0);
  const pagoCompleto = !cobrar || (medio === 'efectivo'
    ? Number(recibido) >= cobro.total
    : referencia.trim().length >= 3);

  const confirmar = () => ejecutar(() => api(`/domicilios/${d.id}/entregado`, { metodo: 'POST', cuerpo: {
    items: despacho.map((m) => ({ formula_item_id: m.formula_item_id, cantidad: cantidad(m) })),
    ...(cobrar ? { pago: { medio, recibido: medio === 'efectivo' ? Number(recibido) : null, referencia } } : {}),
  } }), 'Pedido entregado');

  return (
    <article className="bg-white border border-slate-300 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900 flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-marca-azul text-white text-xs flex items-center justify-center">{numero}</span>
            {d.paciente}
          </p>
          <p className="text-sm text-slate-500">Fórmula {d.codigo}</p>
        </div>
        <a href={enlaceMapa(d)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-marca-hielo text-marca-azul-oscuro font-bold text-sm px-3 py-2 rounded-lg whitespace-nowrap">
          <MapPin className="w-4 h-4" /> Cómo llegar
        </a>
      </div>

      <div className="text-sm text-slate-700 space-y-1">
        <p className="font-semibold text-base flex items-start justify-between gap-2">
          <span>{d.direccion}{d.barrio ? `, ${d.barrio}` : ''}</span>
          <button type="button" onClick={() => setConMapa((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold text-marca-azul hover:underline whitespace-nowrap cursor-pointer">
            <IconoMapa className="w-4 h-4" /> {conMapa ? 'Ocultar mapa' : 'Ver en el mapa'}
          </button>
        </p>
        {conMapa && <MapaInsertado src={mapaPunto(d)} titulo={`Mapa: ${d.direccion}`} alto="h-56" />}
        {d.indicaciones && <p className="text-slate-600 italic">“{d.indicaciones}”</p>}
        {d.recibe && <p className="flex gap-1.5"><User className="w-4 h-4 mt-0.5 shrink-0" /> Recibe: {d.recibe} (debe mostrar el documento del paciente)</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
        <a href={`tel:${d.telefono}`} className="flex items-center justify-center gap-1.5 border border-slate-300 rounded-lg py-2 hover:bg-slate-50">
          <Phone className="w-4 h-4" /> Llamar
        </a>
        <a href={enlaceWhatsapp(d.telefono)} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 border border-slate-300 rounded-lg py-2 hover:bg-slate-50">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
      </div>

      {despacho.length > 0 && (
        <div className="text-sm bg-slate-50 rounded-lg p-3">
          <p className="font-bold text-slate-800 flex items-center gap-1.5 mb-1"><Package className="w-4 h-4" /> Entregar</p>
          <ul className="space-y-0.5">
            {despacho.map((m) => <li key={m.formula_item_id}><strong>{m.despachada}</strong> × {m.nombre} {m.presentacion}</li>)}
          </ul>
        </div>
      )}

      {pagoPorConfirmar ? (
        <div className="text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3">
          <p className="font-bold flex items-center gap-1.5"><Clock className="w-4 h-4" /> Pagó en línea {pesos(d.pago_valor)}: no cobres nada</p>
          <p>La farmacia está confirmando que llegó la transferencia. Si al llegar sigue sin confirmar, llama a la farmacia.</p>
        </div>
      ) : prepago ? (
        <p className="text-sm bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-3 font-bold flex items-center gap-1.5">
          <BadgeCheck className="w-4 h-4" /> Ya pagó por transferencia: no cobres nada
        </p>
      ) : cobrar ? (
        <div className="text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3">
          <p className="font-bold text-base flex items-center gap-1.5"><Banknote className="w-5 h-5" /> Cobrar {pesos(cobro.total)}</p>
          <p>{cobro.cuota > 0 ? `Cuota moderadora ${pesos(cobro.cuota)} + ` : ''}envío {pesos(cobro.envio)}</p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">No hay nada que cobrar.</p>
      )}

      {!abierto ? (
        <BotonAccion color="verde" icono={CheckCircle2} onClick={() => setAbierto(true)}>Marcar entregado</BotonAccion>
      ) : (
        <fieldset disabled={ocupado} className="border-t border-slate-200 pt-3 space-y-3 text-sm">
          <legend className="sr-only">Confirmar la entrega</legend>
          <div className="space-y-1.5">
            <p className="font-bold text-slate-800">Unidades que recibió</p>
            {despacho.map((m) => (
              <label key={m.formula_item_id} className="flex items-center gap-2">
                <span className="flex-1">{m.nombre} {m.presentacion} <span className="text-slate-500">(llevas {m.despachada})</span></span>
                <input type="number" min="0" max={m.despachada} step="1" inputMode="numeric"
                  value={cantidades[m.formula_item_id] ?? m.despachada}
                  onChange={(ev) => setCantidades((v) => ({ ...v, [m.formula_item_id]: ev.target.value }))}
                  className={`${claseCampo} w-20`} />
              </label>
            ))}
            {!cantidadesValidas && <p className="text-red-700">Revisa las cantidades: no pueden superar lo que llevas.</p>}
            {cantidadesValidas && !algo && (
              <p className="text-red-700">Si no pudiste entregar nada, avísale a la farmacia: ellos cancelan el pedido.</p>
            )}
            {pagoPorConfirmar && (
              <p className="text-amber-800">Podrás confirmar la entrega cuando la farmacia confirme el pago en línea.</p>
            )}
          </div>

          {cobrar && (
            <div className="space-y-2">
              <p className="font-bold text-slate-800">¿Cómo pagó?</p>
              <div className="grid grid-cols-2 gap-2">
                {[['efectivo', 'Efectivo'], ['transferencia', 'Transferencia']].map(([v, t]) => (
                  <label key={v} className={`flex items-center justify-center gap-2 rounded-lg border py-2 font-semibold cursor-pointer ${
                    medio === v ? 'border-marca-azul bg-marca-hielo text-marca-azul-oscuro' : 'border-slate-300'}`}>
                    <input type="radio" name={`medio-${d.id}`} value={v} checked={medio === v} onChange={() => setMedio(v)} className="sr-only" />
                    {t}
                  </label>
                ))}
              </div>
              {medio === 'efectivo' ? (
                <label className="block">Efectivo recibido
                  <CampoPesos valor={recibido} cambiar={setRecibido} placeholder={cobro.total} />
                  {recibido !== '' && Number(recibido) < cobro.total && <span className="text-red-700">Debe ser al menos {pesos(cobro.total)}.</span>}
                  {Number(recibido) >= cobro.total && <span className="font-bold">Cambio: {pesos(Number(recibido) - cobro.total)}</span>}
                </label>
              ) : (
                <label className="block">Número del comprobante
                  <input value={referencia} onChange={(ev) => setReferencia(ev.target.value)} minLength={3} maxLength={40}
                    className={claseCampo} />
                </label>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <BotonAccion color="verde" icono={CheckCircle2} onClick={confirmar}
              ocupado={ocupado || !cantidadesValidas || !algo || !pagoCompleto || pagoPorConfirmar}>
              Confirmar entrega
            </BotonAccion>
            <BotonAccion color="gris" onClick={() => setAbierto(false)}>Volver</BotonAccion>
          </div>
        </fieldset>
      )}
      <Aviso aviso={aviso} />
    </article>
  );
}

// Lo que entregó hoy y el efectivo que debe llevar a la farmacia
function EntregadosHoy({ entregados, efectivo }) {
  if (!entregados?.length) return null;
  const comoPago = (e) => (e.forma_pago === 'transferencia' ? 'Pagado por transferencia'
    : e.medio === 'efectivo' ? `Efectivo ${pesos(e.cuota + e.envio)}`
      : e.medio === 'transferencia' ? `Transferencia ${pesos(e.cuota + e.envio)}`
        : e.medio ? `${e.medio} ${pesos(e.cuota + e.envio)}` : 'Sin cobro');
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-slate-900">Entregados hoy ({entregados.length})</h2>
      {efectivo > 0 && (
        <p className="bg-marca-noche text-white rounded-xl p-3 font-bold flex items-center gap-2">
          <Banknote className="w-5 h-5" /> Efectivo cobrado hoy: {pesos(efectivo)} · entrégalo en la farmacia
        </p>
      )}
      <ul className="bg-white border border-slate-300 rounded-xl divide-y divide-slate-200 text-sm">
        {entregados.map((e) => (
          <li key={e.id} className="p-3 flex items-start justify-between gap-3">
            <span>
              <strong>{e.paciente}</strong>
              <span className="block text-slate-500">{hora(e.entregado_en)} · {e.direccion}{e.barrio ? `, ${e.barrio}` : ''}</span>
            </span>
            <span className="text-right whitespace-nowrap">{comoPago(e)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
