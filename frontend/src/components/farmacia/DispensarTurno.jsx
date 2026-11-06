import React, { useCallback, useState } from 'react';
import { ClipboardCheck, UserCheck, Wallet, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useEventoEnVivo } from '../../lib/tiempoReal';
import { BotonAccion, claseCampo } from './comunes';

// "2026-11-30" → "30 de noviembre de 2026" (sin pasar por zonas horarias)
const fechaLarga = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

const MEDIOS = [
  ['efectivo', 'Efectivo'],
  ['transferencia', 'Transferencia'],
  ['datafono', 'Tarjeta (datáfono)'],
];

// Entrega de los medicamentos de un turno en ventanilla (CU-07)
export default function DispensarTurno({ turno, ocupado, ejecutar, alCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cantidades, setCantidades] = useState({}); // formula_item_id → texto del campo
  const [conDelegado, setConDelegado] = useState(false);
  const [delegado, setDelegado] = useState({ nombre: '', documento: '' });
  // Cobro de la cuota moderadora: no se entrega sin pago
  const [medio, setMedio] = useState('efectivo');
  const [recibido, setRecibido] = useState('');
  const [referencia, setReferencia] = useState('');

  const cargar = useCallback(async () => {
    try {
      const d = await api(`/dispensacion/${turno.id}`);
      setDatos(d);
      setError(null);
      // Por defecto se propone entregar todo lo posible; si el stock cambió,
      // se respeta lo que el empleado escribió pero sin pasar del nuevo máximo
      setCantidades((previas) => {
        const nuevas = {};
        for (const m of d.medicamentos) {
          const previa = previas[m.formula_item_id];
          nuevas[m.formula_item_id] =
            previa === undefined ? String(m.maximo_entregable) : String(Math.min(Number(previa) || 0, m.maximo_entregable));
        }
        return nuevas;
      });
    } catch (err) {
      setError(err.message);
    }
  }, [turno.id]);

  // Si otro empleado mueve el inventario, los máximos se recalculan
  useEventoEnVivo('inventario_actualizado', cargar);

  if (error) {
    return (
      <Marco turno={turno} alCerrar={alCerrar}>
        <p className="text-red-700">{error}</p>
      </Marco>
    );
  }
  if (!datos) {
    return (
      <Marco turno={turno} alCerrar={alCerrar}>
        <p className="text-slate-500">Cargando la fórmula…</p>
      </Marco>
    );
  }

  const items = datos.medicamentos
    .map((m) => ({ formula_item_id: m.formula_item_id, cantidad: Number(cantidades[m.formula_item_id]) }))
    .filter((it) => Number.isInteger(it.cantidad) && it.cantidad > 0);
  const invalidas = datos.medicamentos.some((m) => {
    const n = Number(cantidades[m.formula_item_id]);
    return cantidades[m.formula_item_id] !== '' && (!Number.isInteger(n) || n < 0 || n > m.maximo_entregable);
  });
  const delegadoValido =
    !conDelegado || (delegado.nombre.trim().length >= 3 && /^\d{5,20}$/.test(delegado.documento.trim()));
  const nadaEntregable = datos.medicamentos.every((m) => m.maximo_entregable === 0);
  const totalPendiente = datos.medicamentos.reduce((s, m) => s + m.pendiente, 0);
  const totalEntrega = items.reduce((s, it) => s + it.cantidad, 0);
  const parcial = totalEntrega < totalPendiente;

  const cobro = datos.cobro;
  const debeCobrar = cobro?.pendiente_pago;
  const recibidoNum = Number(recibido);
  const cambio = medio === 'efectivo' && Number.isInteger(recibidoNum) && recibidoNum >= (cobro?.valor ?? 0)
    ? recibidoNum - cobro.valor
    : null;
  const pagoValido = !debeCobrar
    || (medio === 'efectivo' ? cambio !== null && recibido !== '' : referencia.trim().length >= 3);

  const enviar = async (e) => {
    e.preventDefault();
    const cuerpo = {
      items,
      delegado: conDelegado ? { nombre: delegado.nombre.trim(), documento: delegado.documento.trim() } : undefined,
      pago: debeCobrar
        ? medio === 'efectivo'
          ? { medio, recibido: recibidoNum }
          : { medio, referencia: referencia.trim() }
        : undefined,
    };
    const textoPago = (r) =>
      r.pago ? ` · Cobrado ${pesos(r.pago.valor)}${r.pago.cambio ? `, cambio ${pesos(r.pago.cambio)}` : ''}` : '';
    const ok = await ejecutar(
      () => api(`/dispensacion/${turno.id}`, { metodo: 'POST', cuerpo }),
      (r) =>
        (r.pendientes.length === 0
          ? `Turno ${r.turno}: entrega completa`
          : `Turno ${r.turno}: entrega parcial. Pendiente: ${r.pendientes.map((p) => `${p.nombre} (${p.cantidad})`).join(', ')}`)
        + textoPago(r)
    );
    if (ok) alCerrar();
  };

  const t = datos.turno;

  return (
    <Marco turno={turno} alCerrar={alCerrar}>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          ['Paciente', t.paciente ?? 'Sin nombre'],
          ['Documento', t.documento ?? '—'],
          ['Fórmula', t.formula],
          ['Reclamar hasta', fechaLarga(t.fecha_limite)],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-slate-500">{etiqueta}</dt>
            <dd className="font-semibold text-slate-900">{valor}</dd>
          </div>
        ))}
      </dl>

      {!datos.puede_dispensar && (
        <p className="text-red-700 font-semibold">Este turno ya no se puede dispensar (estado: {t.estado}).</p>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-semibold">Medicamento</th>
                <th className="px-3 py-2 font-semibold text-right">Formulado</th>
                <th className="px-3 py-2 font-semibold text-right">Ya entregado</th>
                <th className="px-3 py-2 font-semibold text-right">Pendiente</th>
                <th className="px-3 py-2 font-semibold text-right" title="Lo pendiente, sin tocar lo apartado para otros turnos">
                  Se puede entregar
                </th>
                <th className="px-4 py-2 font-semibold w-32">Entregar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {datos.medicamentos.map((m) => {
                const id = `disp-${m.formula_item_id}`;
                const sinStock = m.pendiente > 0 && m.maximo_entregable === 0;
                const completo = m.pendiente === 0;
                return (
                  <tr key={m.formula_item_id} className={completo ? 'text-slate-400' : undefined}>
                    <td className="px-4 py-2">
                      <label htmlFor={id} className="font-semibold text-slate-900">{m.nombre}</label>
                      <p className="text-slate-500">{m.presentacion}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.cantidad_formulada}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.cantidad_entregada}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{m.pendiente}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${sinStock ? 'text-red-700 font-bold' : ''}`}>
                      {sinStock ? 'Sin stock' : m.maximo_entregable}
                    </td>
                    <td className="px-4 py-2">
                      {completo ? (
                        <span className="text-xs font-semibold">Entregado</span>
                      ) : (
                        <input
                          id={id}
                          type="number"
                          min={0}
                          max={m.maximo_entregable}
                          step={1}
                          disabled={m.maximo_entregable === 0}
                          value={cantidades[m.formula_item_id] ?? ''}
                          onChange={(e) => setCantidades((c) => ({ ...c, [m.formula_item_id]: e.target.value }))}
                          className={`${claseCampo} py-1 disabled:bg-slate-100`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recoge otra persona (RN-16) */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer w-fit">
            <input type="checkbox" checked={conDelegado} onChange={(e) => setConDelegado(e.target.checked)} />
            <UserCheck className="w-4 h-4" />
            Recoge otra persona
          </label>
          {conDelegado && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="del-nombre" className="block text-sm font-bold text-slate-800 mb-1">Nombre de quien recoge</label>
                <input id="del-nombre" value={delegado.nombre} required minLength={3}
                  onChange={(e) => setDelegado((d) => ({ ...d, nombre: e.target.value }))} className={claseCampo} />
              </div>
              <div>
                <label htmlFor="del-documento" className="block text-sm font-bold text-slate-800 mb-1">Documento</label>
                <input id="del-documento" value={delegado.documento} required inputMode="numeric" pattern="\d{5,20}"
                  title="Solo números, entre 5 y 20 dígitos"
                  onChange={(e) => setDelegado((d) => ({ ...d, documento: e.target.value }))} className={claseCampo} />
              </div>
            </div>
          )}
        </div>

        {/* Cuota moderadora: se cobra una sola vez por fórmula, antes de entregar */}
        {cobro && !nadaEntregable && (
          debeCobrar ? (
            <fieldset className="border-2 border-marca-azul/40 bg-blue-50/60 rounded-lg p-4 space-y-3">
              <legend className="px-1 flex items-center gap-2 font-bold text-marca-noche">
                <Wallet className="w-5 h-5 text-marca-azul" />
                Cobrar cuota moderadora: {pesos(cobro.valor)}
              </legend>
              <p className="text-sm text-slate-600">
                {cobro.motivo}{cobro.eps ? ` · ${cobro.eps}` : ''}. Sin el pago no se puede entregar.
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Medio de pago">
                {MEDIOS.map(([valor, texto]) => (
                  <label key={valor}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-semibold cursor-pointer ${
                      medio === valor ? 'bg-marca-azul text-white border-marca-azul' : 'bg-white border-slate-300 text-slate-700'
                    }`}>
                    <input type="radio" name="medio-pago" value={valor} checked={medio === valor}
                      onChange={() => setMedio(valor)} className="sr-only" />
                    {texto}
                  </label>
                ))}
              </div>
              {medio === 'efectivo' ? (
                <div className="grid sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label htmlFor="pago-recibido" className="block text-sm font-bold text-slate-800 mb-1">Efectivo recibido</label>
                    <input id="pago-recibido" type="number" min={cobro.valor} step={50} inputMode="numeric"
                      value={recibido} onChange={(e) => setRecibido(e.target.value)}
                      placeholder={String(cobro.valor)} className={claseCampo} />
                  </div>
                  <p className={`text-sm pb-2 ${cambio === null && recibido !== '' ? 'text-red-700 font-semibold' : 'text-slate-700'}`}>
                    {recibido === ''
                      ? 'Escribe cuánto entregó el paciente.'
                      : cambio === null
                        ? `Falta dinero: mínimo ${pesos(cobro.valor)}.`
                        : <>Cambio a devolver: <strong className="text-lg text-slate-900">{pesos(cambio)}</strong></>}
                  </p>
                </div>
              ) : (
                <div className="sm:w-1/2">
                  <label htmlFor="pago-referencia" className="block text-sm font-bold text-slate-800 mb-1">
                    {medio === 'transferencia' ? 'Número de la transferencia' : 'Número del voucher'}
                  </label>
                  <input id="pago-referencia" value={referencia} maxLength={40}
                    onChange={(e) => setReferencia(e.target.value)} className={claseCampo} />
                </div>
              )}
            </fieldset>
          ) : (
            <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">
              {cobro.valor > 0 ? `Cuota moderadora ya pagada (${pesos(cobro.valor)}). No se cobra de nuevo.` : `Sin cobro: ${cobro.motivo}.`}
            </p>
          )
        )}

        {nadaEntregable ? (
          <p className="text-amber-900 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm">
            No hay nada que entregar ahora. Si el paciente se va sin medicamentos, cierra este panel y márcalo como atendido.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-600">
              {items.length === 0
                ? 'Indica al menos un medicamento a entregar.'
                : parcial
                  ? `Entrega parcial: ${totalEntrega} de ${totalPendiente} unidades. Lo demás queda pendiente hasta el ${fechaLarga(t.fecha_limite)}.`
                  : `Entrega completa: ${totalEntrega} unidades.`}
            </p>
            <BotonAccion
              type="submit"
              color="verde"
              icono={ClipboardCheck}
              ocupado={ocupado || !datos.puede_dispensar || items.length === 0 || invalidas || !delegadoValido || !pagoValido}
            >
              {debeCobrar ? 'Cobrar, entregar y cerrar turno' : 'Entregar y cerrar turno'}
            </BotonAccion>
          </div>
        )}
      </form>
    </Marco>
  );
}

function Marco({ turno, alCerrar, children }) {
  return (
    <div className="border-t border-slate-200 pt-4 mt-2 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-bold text-slate-800">Dispensar turno {turno.numero}</h4>
        <button type="button" onClick={alCerrar} aria-label="Cerrar dispensación"
          className="p-1 rounded hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      {children}
    </div>
  );
}
