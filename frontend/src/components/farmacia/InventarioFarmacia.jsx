import React, { useCallback, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, FlaskConical, Package, PackagePlus,
  PencilLine, Scale, Search, X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSesion } from '../../lib/sesion';
import { useEventoEnVivo } from '../../lib/tiempoReal';
import { Aviso, BotonAccion, IndicadorEnVivo, claseCampo, useAccion } from './comunes';

const ESTADOS = {
  // Un solo color (azul de la marca): más fuerte cuanto más urgente
  normal: { texto: 'Normal', clase: 'bg-slate-100 text-slate-600' },
  stock_bajo: { texto: 'Stock bajo', clase: 'bg-marca-hielo text-marca-azul-oscuro ring-1 ring-marca-azul/25' },
  agotado: { texto: 'Agotado', clase: 'bg-marca-azul text-white' },
};

const TIPOS_MOVIMIENTO = {
  entrada: { texto: 'Entrada', icono: ArrowDownToLine, ayuda: 'Unidades que llegan (se suman al stock).' },
  salida: { texto: 'Salida', icono: ArrowUpFromLine, ayuda: 'Unidades que salen por vencimiento, daño, etc.' },
  ajuste: { texto: 'Ajuste', icono: Scale, ayuda: 'Conteo físico: el stock queda exactamente en esta cantidad.' },
};

// Texto del aviso tras un movimiento, con los pacientes avisados si los hubo
const textoMovimiento = (r) => {
  const { nombre, stock_anterior, stock_actual } = r.medicamento;
  const avisados = r.turnosAvisados?.length ?? 0;
  return `${nombre}: stock ${stock_anterior} → ${stock_actual}` +
    (avisados > 0 ? `. Se avisó a ${avisados} paciente${avisados > 1 ? 's' : ''} con turno.` : '');
};

export default function InventarioFarmacia() {
  const [datos, setDatos] = useState({ medicamentos: [], alertas: [], modo_demo: false });
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | alertas | agotado | stock_bajo
  const [seleccionado, setSeleccionado] = useState(null); // id del medicamento con el formulario abierto
  const [creando, setCreando] = useState(false);
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'administrador';

  const cargar = useCallback(async () => {
    try {
      setDatos(await api('/inventario'));
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }, []);

  const { ocupado, aviso, setAviso, ejecutar } = useAccion(cargar);

  // Tiempo real: dispensaciones y movimientos de otros empleados actualizan la tabla
  useEventoEnVivo('inventario_actualizado', cargar);

  const texto = busqueda.trim().toLowerCase();
  const visibles = datos.medicamentos.filter(
    (m) =>
      (filtro === 'todos' || (filtro === 'alertas' ? m.estado !== 'normal' : m.estado === filtro)) &&
      (!texto || `${m.nombre} ${m.presentacion}`.toLowerCase().includes(texto))
  );
  const medicamentoAbierto = datos.medicamentos.find((m) => m.id === seleccionado);

  const demo = (m, accion, texto) =>
    ejecutar(() => api(`/inventario/${m.id}/demo/${accion}`, { metodo: 'POST' }), (r) => `${texto} · ${textoMovimiento(r)}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <IndicadorEnVivo azul />
          <BotonAccion color="azul" icono={PackagePlus} onClick={() => setCreando((v) => !v)}>
            Nuevo medicamento
          </BotonAccion>
        </div>
      </div>

      <Aviso aviso={aviso} />

      {/* Alertas de stock (RF-17): desplegable, cerrado por defecto para no ocupar la pantalla */}
      {datos.alertas.length > 0 && (
        <details className="group bg-marca-hielo border border-marca-azul/20 rounded-xl">
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-5 py-4 flex items-center gap-2 rounded-xl hover:bg-marca-azul/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-marca-azul/20">
            <AlertTriangle className="w-5 h-5 text-marca-azul shrink-0" />
            <span className="font-bold text-marca-noche">
              {datos.alertas.length} {datos.alertas.length === 1 ? 'alerta' : 'alertas'} de stock
            </span>
            <span className="ml-auto flex items-center gap-1 text-sm font-semibold text-marca-azul">
              <span className="group-open:hidden">Ver</span>
              <span className="hidden group-open:inline">Ocultar</span>
              <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <ul className="list-disc pl-11 pr-5 pb-4 text-slate-700 marker:text-marca-azul space-y-0.5">
            {datos.alertas.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      {creando && (
        <NuevoMedicamento
          ocupado={ocupado}
          ejecutar={ejecutar}
          alCerrar={() => setCreando(false)}
        />
      )}

      {medicamentoAbierto && (
        <RegistrarMovimiento
          key={medicamentoAbierto.id}
          medicamento={medicamentoAbierto}
          ocupado={ocupado}
          ejecutar={ejecutar}
          alCerrar={() => setSeleccionado(null)}
        />
      )}

      <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar medicamento"
              aria-label="Buscar medicamento"
              className={`${claseCampo} pl-9`}
            />
          </div>
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Filtrar por estado del stock">
            {[
              ['todos', 'Todos', datos.medicamentos.length],
              ['alertas', 'Con alertas', datos.medicamentos.filter((m) => m.estado !== 'normal').length],
              ['agotado', 'Agotados', datos.medicamentos.filter((m) => m.estado === 'agotado').length],
              ['stock_bajo', 'Stock bajo', datos.medicamentos.filter((m) => m.estado === 'stock_bajo').length],
            ].map(([valor, texto, cuantos]) => (
              <button key={valor} type="button" onClick={() => setFiltro(valor)} aria-pressed={filtro === valor}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${
                  filtro === valor ? 'bg-white shadow text-marca-azul' : 'text-slate-600 hover:text-slate-900'
                }`}>
                {texto} <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  filtro === valor ? 'bg-marca-azul text-white' : 'bg-slate-200 text-slate-600'}`}>{cuantos}</span>
              </button>
            ))}
          </div>
        </div>

        {cargando ? (
          <p className="p-6 text-slate-500">Cargando el inventario…</p>
        ) : visibles.length === 0 ? (
          <p className="p-6 text-slate-500">
            {datos.medicamentos.length === 0 ? 'No hay medicamentos registrados.'
              : !texto && filtro === 'agotado' ? 'No hay medicamentos agotados.'
              : !texto && filtro === 'stock_bajo' ? 'No hay medicamentos con stock bajo.'
              : !texto && filtro === 'alertas' ? 'No hay alertas de stock.'
              : 'Ningún medicamento coincide.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-5 py-2 font-semibold">Medicamento</th>
                  <th className="px-3 py-2 font-semibold text-right">Stock</th>
                  <th className="px-3 py-2 font-semibold text-right" title="Apartado para turnos activos">Reservado</th>
                  <th className="px-3 py-2 font-semibold text-right">Disponible</th>
                  <th className="px-3 py-2 font-semibold text-right"
                    title="Punto de reposición: por debajo de esta cantidad el medicamento sale como «Stock bajo»">Mínimo</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-5 py-2 font-semibold sr-only">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibles.map((m) => {
                  const estado = ESTADOS[m.estado] ?? ESTADOS.normal;
                  return (
                    <tr key={m.id} className={seleccionado === m.id ? 'bg-slate-50' : undefined}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{m.nombre}</p>
                        <p className="text-sm text-slate-500">{m.presentacion}</p>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums">{m.stock_actual}</td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">{m.reservado}</td>
                      <td className="px-3 py-3 text-right text-slate-900 tabular-nums">{m.disponible}</td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                        {esAdmin ? <EditarMinimo m={m} ocupado={ocupado} ejecutar={ejecutar} /> : m.stock_minimo}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${estado.clase}`}>
                          {estado.texto}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <BotonAccion color="azulSuave" icono={Package} ocupado={ocupado}
                            onClick={() => setSeleccionado(seleccionado === m.id ? null : m.id)}>
                            Movimiento
                          </BotonAccion>
                          {datos.modo_demo && (
                            <MenuDemo m={m} ocupado={ocupado} demo={demo} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// Stock mínimo editable (solo administrador): el número con un lápiz; al tocarlo, un campo
// pequeño. Enter guarda, Esc cancela.
function EditarMinimo({ m, ocupado, ejecutar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');

  const n = Number(valor);
  const valido = valor !== '' && Number.isInteger(n) && n >= 0;

  const abrir = () => {
    setValor(String(m.stock_minimo));
    setEditando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!valido) return;
    if (n === m.stock_minimo) {
      setEditando(false);
      return;
    }
    const ok = await ejecutar(
      () => api(`/inventario/${m.id}/minimo`, { metodo: 'PATCH', cuerpo: { stock_minimo: n } }),
      (r) => `${r.medicamento.nombre}: mínimo ${r.medicamento.minimo_anterior} → ${r.medicamento.stock_minimo}`
    );
    if (ok) setEditando(false);
  };

  if (!editando) {
    return (
      <button type="button" onClick={abrir} disabled={ocupado}
        title="Cambiar el stock mínimo" aria-label={`Cambiar el stock mínimo de ${m.nombre} (ahora ${m.stock_minimo})`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 -mr-1.5 rounded hover:bg-marca-hielo hover:text-marca-azul transition cursor-pointer disabled:cursor-not-allowed">
        {m.stock_minimo}
        <PencilLine className="w-3.5 h-3.5 opacity-60" />
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="inline-flex items-center gap-1 justify-end">
      <input type="number" min={0} step={1} required autoFocus value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setEditando(false)}
        aria-label={`Stock mínimo de ${m.nombre}`}
        className="w-20 px-2 py-1 rounded-md border border-slate-300 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-marca-azul" />
      <button type="submit" disabled={ocupado || !valido} aria-label="Guardar el mínimo"
        className="p-1 rounded text-marca-azul hover:bg-marca-hielo cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
        <Check className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => setEditando(false)} aria-label="Cancelar"
        className="p-1 rounded text-slate-500 hover:bg-slate-100 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </form>
  );
}

// Botones de demostración (RF-18): solo aparecen si el backend corre con MODO_DEMO=true
function MenuDemo({ m, ocupado, demo }) {
  return (
    <div className="flex gap-1 items-center border border-dashed border-slate-300 rounded-lg px-1.5 py-1" title="Solo para demostraciones">
      <FlaskConical className="w-4 h-4 text-slate-400" aria-label="Demostración" />
      {[
        ['reducir', 'Reducir', 'Stock reducido a la mitad', m.stock_actual < 2],
        ['vaciar', 'Vaciar', 'Medicamento agotado', m.stock_actual === 0],
        ['reponer', 'Reponer', 'Stock repuesto', false],
      ].map(([accion, texto, exito, deshabilitado]) => (
        <button
          key={accion}
          type="button"
          disabled={ocupado || deshabilitado}
          onClick={() => demo(m, accion, exito)}
          className="text-xs font-semibold text-slate-600 hover:text-marca-azul hover:bg-marca-hielo px-2 py-1 rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

// Entrada, salida o ajuste de un medicamento (RF-16)
function RegistrarMovimiento({ medicamento: m, ocupado, ejecutar, alCerrar }) {
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');

  const n = Number(cantidad);
  const valida = cantidad !== '' && Number.isInteger(n) && n >= (tipo === 'ajuste' ? 0 : 1);
  const resultante = !valida ? null : tipo === 'entrada' ? m.stock_actual + n : tipo === 'salida' ? m.stock_actual - n : n;

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api(`/inventario/${m.id}/movimiento`, {
        metodo: 'POST',
        cuerpo: { tipo, cantidad: n, motivo: motivo.trim() || undefined },
      }),
      textoMovimiento
    );
    if (ok) alCerrar();
  };

  return (
    <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800">
          Movimiento: {m.nombre} <span className="font-normal text-slate-500">{m.presentacion}</span>
        </h3>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="p-1 rounded hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      <form onSubmit={enviar} className="p-5 grid gap-4 md:grid-cols-[auto_10rem_1fr_auto] md:items-end">
        <div>
          <span className="block text-sm font-bold text-slate-800 mb-1">Tipo</span>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Tipo de movimiento">
            {Object.entries(TIPOS_MOVIMIENTO).map(([valor, { texto, icono: Icono }]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setTipo(valor)}
                aria-pressed={tipo === valor}
                className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${
                  tipo === valor ? 'bg-white shadow text-marca-azul' : 'text-slate-600'
                }`}
              >
                <Icono className="w-4 h-4" />
                {texto}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="mov-cantidad" className="block text-sm font-bold text-slate-800 mb-1">
            {tipo === 'ajuste' ? 'Stock contado' : 'Cantidad'}
          </label>
          <input id="mov-cantidad" type="number" min={tipo === 'ajuste' ? 0 : 1} step={1} required
            value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="mov-motivo" className="block text-sm font-bold text-slate-800 mb-1">
            Motivo {tipo === 'entrada' && <span className="font-normal text-slate-500">(opcional)</span>}
          </label>
          <input id="mov-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            required={tipo !== 'entrada'} minLength={tipo !== 'entrada' ? 3 : undefined}
            placeholder={tipo === 'entrada' ? 'Pedido del proveedor' : tipo === 'salida' ? 'Vencido, dañado…' : 'Conteo físico'}
            className={claseCampo} />
        </div>
        <BotonAccion type="submit" color="azul" ocupado={ocupado || !valida}>
          Registrar
        </BotonAccion>
        <p className={`text-sm md:col-span-4 ${resultante !== null && resultante < 0 ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
          {TIPOS_MOVIMIENTO[tipo].ayuda} Stock actual: <strong>{m.stock_actual}</strong>
          {resultante !== null && (
            resultante < 0
              ? ` · No alcanza: solo hay ${m.stock_actual}.`
              : <> · Quedará en <strong>{resultante}</strong>.</>
          )}
        </p>
      </form>
    </section>
  );
}

function NuevoMedicamento({ ocupado, ejecutar, alCerrar }) {
  const [nombre, setNombre] = useState('');
  const [presentacion, setPresentacion] = useState('');
  const [minimo, setMinimo] = useState('0');
  const [inicial, setInicial] = useState('0');

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api('/inventario', {
        metodo: 'POST',
        cuerpo: {
          nombre,
          presentacion,
          stock_minimo: Number(minimo),
          stock_inicial: Number(inicial),
        },
      }),
      (r) => `${r.medicamento.nombre} ${r.medicamento.presentacion} agregado al inventario`
    );
    if (ok) alCerrar();
  };

  return (
    <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-slate-600" />
          Nuevo medicamento
        </h3>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="p-1 rounded hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      <form onSubmit={enviar} className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_8rem_auto] lg:items-end">
        <div>
          <label htmlFor="nm-nombre" className="block text-sm font-bold text-slate-800 mb-1">Nombre</label>
          <input id="nm-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2}
            placeholder="Losartán" className={claseCampo} />
        </div>
        <div>
          <label htmlFor="nm-presentacion" className="block text-sm font-bold text-slate-800 mb-1">Presentación</label>
          <input id="nm-presentacion" value={presentacion} onChange={(e) => setPresentacion(e.target.value)} required minLength={2}
            placeholder="Tableta 50 mg" className={claseCampo} />
        </div>
        <div>
          <label htmlFor="nm-minimo" className="block text-sm font-bold text-slate-800 mb-1"
            title="Punto de reposición: por debajo de esta cantidad sale como «Stock bajo»">Stock mínimo</label>
          <input id="nm-minimo" type="number" min={0} step={1} required value={minimo}
            onChange={(e) => setMinimo(e.target.value)} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="nm-inicial" className="block text-sm font-bold text-slate-800 mb-1">Stock inicial</label>
          <input id="nm-inicial" type="number" min={0} step={1} required value={inicial}
            onChange={(e) => setInicial(e.target.value)} className={claseCampo} />
        </div>
        <BotonAccion type="submit" color="azul" ocupado={ocupado}>
          Agregar
        </BotonAccion>
      </form>
    </section>
  );
}
