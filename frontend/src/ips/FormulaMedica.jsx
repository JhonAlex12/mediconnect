import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Minus, Trash2, CheckCircle2, AlertCircle, Send, Copy, Check, Search,
  UserRound, BadgeDollarSign, Pill, ExternalLink, RotateCcw, Printer,
} from 'lucide-react';
import { leerToken } from '../lib/api.js';
import { FormulaImpresion, imprimirFormula } from './FormulaImpresion';

// Las rutas exigen la sesión de un administrador de la farmacia (se comparte con /farmacia)
const conSesion = (cabeceras = {}) => {
  const token = leerToken();
  return token ? { ...cabeceras, Authorization: `Bearer ${token}` } : cabeceras;
};

// Fechas locales (toISOString usa UTC: de noche en Colombia daría el día siguiente)
const fechaLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
};
const diasEntre = (desde, hasta) =>
  Math.round((new Date(`${hasta}T12:00:00`) - new Date(`${desde}T12:00:00`)) / 86400000);
const fechaLarga = (fecha) =>
  fecha ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

const RANGOS = [
  { valor: 'A', texto: 'Menos de 2 SMLMV' },
  { valor: 'B', texto: 'Entre 2 y 5 SMLMV' },
  { valor: 'C', texto: 'Más de 5 SMLMV' },
];

const EXENCIONES = [
  { valor: '', texto: 'Ninguna' },
  { valor: 'promocion_prevencion', texto: 'Promoción y prevención' },
  { valor: 'control_prenatal', texto: 'Control prenatal' },
  { valor: 'alto_costo', texto: 'Alto costo (cáncer, VIH…)' },
  { valor: 'urgencia', texto: 'Urgencia' },
];

const campo =
  'w-full bg-white border border-slate-300 rounded-md px-3 py-2.5 text-base text-slate-900 ' +
  'focus:outline-none focus:border-ips focus:ring-2 focus:ring-ips/20';
const etiqueta = 'block text-sm font-semibold text-slate-700 mb-1.5';

function Seccion({ numero, titulo, icono: Icono, children, extra }) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
        <h2 className="flex items-center gap-3 font-bold text-slate-900">
          <span className="w-7 h-7 rounded-md bg-ips-claro text-ips-oscuro text-sm flex items-center justify-center">
            {numero}
          </span>
          <Icono className="w-4 h-4 text-slate-500" />
          {titulo}
        </h2>
        {extra}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Segmentos({ opciones, valor, onChange, nombre }) {
  return (
    <div role="radiogroup" aria-label={nombre} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(o.valor)}
            className={`text-left rounded-md border px-3 py-2 transition cursor-pointer ${
              activo
                ? 'border-ips bg-ips-claro ring-1 ring-ips text-ips-noche'
                : 'border-slate-300 bg-white hover:border-slate-400 text-slate-700'
            }`}
          >
            <span className="block font-semibold">{o.titulo}</span>
            {o.detalle && <span className="block text-xs text-slate-500 mt-0.5">{o.detalle}</span>}
          </button>
        );
      })}
    </div>
  );
}

function BotonCopiar({ texto, etiqueta: titulo }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* el navegador no permite copiar (p. ej. sin HTTPS); no pasa nada */
    }
  };
  return (
    <button
      type="button"
      onClick={copiar}
      title={`Copiar ${titulo}`}
      aria-label={`Copiar ${titulo}`}
      className="p-1 rounded text-slate-400 hover:text-ips hover:bg-ips-claro cursor-pointer"
    >
      {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function EstadoStock({ stock }) {
  if (stock <= 0) return <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">Sin stock</span>;
  if (stock < 30) return <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">Stock bajo · {stock}</span>;
  return <span className="text-xs text-slate-500">Stock {stock}</span>;
}

export default function FormulaMedica({ onIrAPaciente, onSesionVencida, medico }) {
  const hoyStr = fechaLocal(new Date());

  const [catalogo, setCatalogo] = useState([]);
  const [siguienteCodigo, setSiguienteCodigo] = useState('F-2026-0004');
  const [tarifa, setTarifa] = useState(null);

  // Datos del paciente y de la fórmula
  const [documento, setDocumento] = useState('1090123456');
  const [nombre, setNombre] = useState('María Fernanda Rojas');
  const [fechaEmision, setFechaEmision] = useState(hoyStr);
  const [fechaLimite, setFechaLimite] = useState(sumarDias(hoyStr, 15));
  const [items, setItems] = useState([]);

  // Afiliación del paciente: define la cuota moderadora que paga al reclamar
  const [regimen, setRegimen] = useState('contributivo');
  const [rangoIngreso, setRangoIngreso] = useState('A');
  const [eps, setEps] = useState('Nueva EPS');
  const [exencion, setExencion] = useState('');

  // Buscador de medicamentos
  const [busqueda, setBusqueda] = useState('');
  const [cantidadNueva, setCantidadNueva] = useState(30);
  const [listaAbierta, setListaAbierta] = useState(false);
  const buscadorRef = useRef(null);

  // Mensajes de estado
  const [error, setError] = useState('');
  const [exito, setExito] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargarDatos = async () => {
    try {
      const [resMeds, resFormulas] = await Promise.all([
        fetch('/api/simulador/medicamentos', { headers: conSesion() }),
        fetch('/api/simulador/formulas', { headers: conSesion() }),
      ]);
      if ([401, 403].includes(resMeds.status)) {
        onSesionVencida?.();
        return;
      }
      const dataMeds = (await resMeds.json()).medicamentos ?? [];
      const dataFormulas = await resFormulas.json();
      if (!resMeds.ok || !resFormulas.ok) {
        setError('El simulador no está disponible: el backend debe correr con MODO_DEMO=true.');
      }

      setCatalogo(dataMeds);
      if (dataFormulas.siguiente_codigo) setSiguienteCodigo(dataFormulas.siguiente_codigo);

      // Fórmula de ejemplo: Acetaminofén 500 mg x 30 y Losartán 50 mg x 60 (si no están, los dos primeros del catálogo)
      if (items.length === 0 && dataMeds.length >= 2) {
        const buscar = (nombre, presentacion) =>
          dataMeds.find((m) => m.nombre === nombre && m.presentacion === presentacion);
        const ejemplo = [
          [buscar('Acetaminofén', '500 mg tabletas') ?? dataMeds[0], 30],
          [buscar('Losartán', '50 mg tabletas') ?? dataMeds[1], 60],
        ];
        setItems(ejemplo.map(([m, cantidad]) => (
          { medicamento_id: m.id, nombre: m.nombre, presentacion: m.presentacion, stock: m.stock_actual, cantidad }
        )));
      }
    } catch (err) {
      console.error('Error cargando datos del simulador:', err);
    }
  };

  useEffect(() => {
    cargarDatos();
    // Valores de la cuota moderadora vigentes (ruta pública), solo para mostrar el estimado
    fetch('/api/tarifas/vigentes')
      .then((r) => r.json())
      .then((d) => setTarifa(d.tarifa ?? null))
      .catch(() => {});
  }, []);

  // Cerrar la lista de resultados al hacer clic fuera del buscador
  useEffect(() => {
    const cerrar = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) setListaAbierta(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lista = q
      ? catalogo.filter((m) =>
          `${m.nombre} ${m.presentacion}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
      : catalogo;
    return lista.slice(0, 8);
  }, [busqueda, catalogo]);

  const agregarMedicamento = (med) => {
    setError('');
    const cantidad = Number(cantidadNueva);
    if (!cantidad || cantidad <= 0) {
      setError('Escriba una cantidad mayor a 0.');
      return;
    }
    setItems((actuales) =>
      actuales.some((i) => i.medicamento_id === med.id)
        ? actuales.map((i) => (i.medicamento_id === med.id ? { ...i, cantidad: Number(i.cantidad) + cantidad } : i))
        : [...actuales, { medicamento_id: med.id, nombre: med.nombre, presentacion: med.presentacion, stock: med.stock_actual, cantidad }]
    );
    setBusqueda('');
    setListaAbierta(false);
  };

  const quitarMedicamento = (medId) => setItems(items.filter((i) => i.medicamento_id !== medId));

  const cambiarCantidadItem = (medId, nuevaCantidad) =>
    setItems(items.map((i) => (i.medicamento_id === medId ? { ...i, cantidad: Math.max(0, Number(nuevaCantidad) || 0) } : i)));

  // Cuota moderadora estimada (la definitiva la calcula el servidor al guardar)
  const cuotaEstimada = useMemo(() => {
    if (regimen !== 'contributivo' || exencion) return 0;
    return tarifa?.[rangoIngreso] ?? null;
  }, [regimen, exencion, rangoIngreso, tarifa]);

  const diasVigencia = fechaEmision && fechaLimite ? diasEntre(fechaEmision, fechaLimite) : null;

  const nuevaFormula = () => {
    setExito(null);
    setError('');
    setDocumento('');
    setNombre('');
    setItems([]);
    setFechaEmision(hoyStr);
    setFechaLimite(sumarDias(hoyStr, 15));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const guardarYEnviar = async (e) => {
    e.preventDefault();
    setError('');
    setExito(null);
    setEnviando(true);

    try {
      const respuesta = await fetch('/api/simulador/formulas', {
        method: 'POST',
        headers: conSesion({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          documento,
          nombre,
          fecha_emision: fechaEmision,
          fecha_limite: fechaLimite,
          regimen,
          rango_ingreso: regimen === 'contributivo' ? rangoIngreso : null,
          eps: eps.trim() || null,
          exencion: exencion || null,
          medicamentos: items.map((i) => ({ medicamento_id: i.medicamento_id, cantidad: i.cantidad })),
        }),
      });

      const data = await respuesta.json();
      if ([401, 403].includes(respuesta.status)) {
        onSesionVencida?.();
      } else if (!respuesta.ok || !data.ok) {
        const detalles = Array.isArray(data.detalles) && data.detalles.length ? `: ${data.detalles.join('; ')}` : '';
        setError((data.mensaje || 'Error al guardar y enviar la fórmula.') + detalles);
      } else {
        setExito({
          codigo: data.formula.codigo,
          documento,
          nombre,
          cuota: data.formula.cuota_moderadora,
          medicamentos: data.formula.medicamentos,
          // Copia de lo enviado, para imprimir la fórmula aunque luego se cambie el formulario
          items: items.map((i) => ({ ...i })),
          fechaEmision,
          fechaLimite,
          eps: eps.trim(),
          regimen,
          rangoIngreso: regimen === 'contributivo' ? rangoIngreso : null,
          exencion,
        });
        setSiguienteCodigo(data.siguiente_codigo);
        await cargarDatos();
      }
    } catch {
      setError('No se pudo conectar con el servidor de la aplicación.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={guardarYEnviar} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-5">
          {/* 1. Paciente y vigencia */}
          <Seccion numero="1" titulo="Paciente" icono={UserRound}>
            <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4">
              <div>
                <label htmlFor="ips-documento" className={etiqueta}>Documento</label>
                <input id="ips-documento" type="text" inputMode="numeric" value={documento}
                  onChange={(e) => setDocumento(e.target.value)} placeholder="1090123456" className={`${campo} font-mono`} />
              </div>
              <div>
                <label htmlFor="ips-nombre" className={etiqueta}>Nombre completo</label>
                <input id="ips-nombre" type="text" value={nombre}
                  onChange={(e) => setNombre(e.target.value)} placeholder="Nombres y apellidos" className={campo} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="ips-emision" className={etiqueta}>Fecha de la fórmula</label>
                <input id="ips-emision" type="date" value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)} className={campo} />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <label htmlFor="ips-limite" className="text-sm font-semibold text-slate-700">Reclamar hasta</label>
                  <div className="flex gap-1">
                    {[15, 30].map((d) => (
                      <button key={d} type="button" onClick={() => setFechaLimite(sumarDias(fechaEmision || hoyStr, d))}
                        className={`text-xs font-semibold px-2 py-0.5 rounded border cursor-pointer ${
                          diasVigencia === d ? 'border-ips bg-ips-claro text-ips-oscuro' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}>
                        {d} días
                      </button>
                    ))}
                  </div>
                </div>
                <input id="ips-limite" type="date" value={fechaLimite}
                  onChange={(e) => setFechaLimite(e.target.value)} className={campo} />
              </div>
            </div>
          </Seccion>

          {/* 2. Afiliación: régimen, rango de ingreso (IBC), EPS y exención */}
          <Seccion numero="2" titulo="Afiliación y cuota moderadora" icono={BadgeDollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
              <div>
                <span className={etiqueta}>Régimen</span>
                <Segmentos
                  nombre="Régimen"
                  valor={regimen}
                  onChange={setRegimen}
                  opciones={[
                    { valor: 'contributivo', titulo: 'Contributivo', detalle: 'Paga según ingreso' },
                    { valor: 'subsidiado', titulo: 'Subsidiado', detalle: 'Sin cuota' },
                  ]}
                />
              </div>
              <div>
                <span className={etiqueta}>Rango de ingreso (IBC)</span>
                {regimen === 'contributivo' ? (
                  <Segmentos
                    nombre="Rango de ingreso"
                    valor={rangoIngreso}
                    onChange={setRangoIngreso}
                    opciones={RANGOS.map((r) => ({
                      valor: r.valor,
                      titulo: `${r.valor}${tarifa?.[r.valor] != null ? ` · ${pesos(tarifa[r.valor])}` : ''}`,
                      detalle: r.texto,
                    }))}
                  />
                ) : (
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-3">
                    El régimen subsidiado no paga cuota moderadora.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="ips-eps" className={etiqueta}>EPS</label>
                <input id="ips-eps" type="text" value={eps} maxLength={80} onChange={(e) => setEps(e.target.value)}
                  placeholder="Nombre de la EPS" className={campo} />
              </div>
              <div>
                <label htmlFor="ips-exencion" className={etiqueta}>Exención de pago</label>
                <select id="ips-exencion" value={exencion} onChange={(e) => setExencion(e.target.value)} className={campo}>
                  {EXENCIONES.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
                </select>
              </div>
            </div>
          </Seccion>

          {/* 3. Medicamentos */}
          <Seccion
            numero="3"
            titulo="Medicamentos"
            icono={Pill}
            extra={<span className="text-sm text-slate-500">{items.length} en la fórmula</span>}
          >
            {/* Buscador del catálogo */}
            <div className="flex flex-wrap items-end gap-3">
              <div ref={buscadorRef} className="relative flex-1 min-w-[240px]">
                <label htmlFor="ips-buscar" className={etiqueta}>Agregar del catálogo</label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3 bottom-3.5 pointer-events-none" />
                <input
                  id="ips-buscar"
                  type="search"
                  autoComplete="off"
                  value={busqueda}
                  onChange={(e) => { setBusqueda(e.target.value); setListaAbierta(true); }}
                  onFocus={() => setListaAbierta(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (resultados[0]) agregarMedicamento(resultados[0]);
                    } else if (e.key === 'Escape') {
                      setListaAbierta(false);
                    }
                  }}
                  placeholder="Escriba el nombre del medicamento"
                  className={`${campo} pl-9`}
                />
                {listaAbierta && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-auto py-1">
                    {resultados.length === 0 ? (
                      <li className="px-3 py-2.5 text-sm text-slate-500">No hay medicamentos con ese nombre.</li>
                    ) : (
                      resultados.map((m) => (
                        <li key={m.id}>
                          <button type="button" onClick={() => agregarMedicamento(m)}
                            className="w-full text-left px-3 py-2 hover:bg-ips-claro flex items-center justify-between gap-3 cursor-pointer">
                            <span>
                              <span className="font-medium text-slate-900">{m.nombre}</span>{' '}
                              <span className="text-sm text-slate-500">{m.presentacion}</span>
                            </span>
                            <EstadoStock stock={m.stock_actual} />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              <div className="w-28">
                <label htmlFor="ips-cantidad" className={etiqueta}>Cantidad</label>
                <input id="ips-cantidad" type="number" min="1" value={cantidadNueva}
                  onChange={(e) => setCantidadNueva(e.target.value)} className={campo} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">Elija de la lista o presione Enter para agregar el primero.</p>

            {/* Medicamentos de la fórmula */}
            <div className="mt-4 border border-slate-200 rounded-md overflow-hidden">
              {items.length === 0 ? (
                <p className="py-8 text-center text-slate-500">Aún no hay medicamentos en la fórmula.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {items.map((item, i) => (
                    <li key={item.medicamento_id} className="flex items-center gap-4 px-4 py-3">
                      <span className="w-6 text-sm font-mono text-slate-400">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{item.nombre}</p>
                        <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                          {item.presentacion}
                          {item.stock != null && item.cantidad > item.stock && (
                            <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                              La farmacia tiene {item.stock}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center border border-slate-300 rounded-md">
                        <button type="button" aria-label="Restar uno" onClick={() => cambiarCantidadItem(item.medicamento_id, item.cantidad - 1)}
                          className="px-2 py-2 text-slate-600 hover:bg-slate-100 cursor-pointer"><Minus className="w-4 h-4" /></button>
                        <input type="number" min="1" aria-label={`Cantidad de ${item.nombre}`} value={item.cantidad}
                          onChange={(e) => cambiarCantidadItem(item.medicamento_id, e.target.value)}
                          className="w-16 text-center py-1.5 border-x border-slate-300 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                        <button type="button" aria-label="Sumar uno" onClick={() => cambiarCantidadItem(item.medicamento_id, item.cantidad + 1)}
                          className="px-2 py-2 text-slate-600 hover:bg-slate-100 cursor-pointer"><Plus className="w-4 h-4" /></button>
                      </div>
                      <button type="button" onClick={() => quitarMedicamento(item.medicamento_id)}
                        aria-label={`Quitar ${item.nombre}`} title="Quitar"
                        className="p-2 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Seccion>
        </div>

        {/* Resumen y envío */}
        <aside className="lg:sticky lg:top-6 space-y-4">
          {exito ? (
            <div className="bg-white rounded-lg border border-emerald-300 shadow-sm overflow-hidden">
              <div className="bg-emerald-600 text-white px-5 py-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <p className="font-bold">Fórmula enviada a la farmacia</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Código</p>
                  <p className="flex items-center gap-2 text-2xl font-mono font-bold text-slate-900">
                    {exito.codigo} <BotonCopiar texto={exito.codigo} etiqueta="código" />
                  </p>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Paciente</dt><dd className="font-medium text-right">{exito.nombre}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Documento</dt><dd className="font-mono">{exito.documento}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Medicamentos</dt><dd>{exito.medicamentos}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Cuota al reclamar</dt><dd className="font-semibold">{exito.cuota > 0 ? pesos(exito.cuota) : 'Sin costo'}</dd></div>
                </dl>
                <button type="button" onClick={() => imprimirFormula(exito.codigo)}
                  className="w-full bg-ips hover:bg-ips-oscuro text-white font-bold px-4 py-3 rounded-md flex items-center justify-center gap-2 cursor-pointer">
                  <Printer className="w-4 h-4" /> Imprimir fórmula
                </button>
                <FormulaImpresion datos={exito} medico={medico} />
                {onIrAPaciente && (
                  <button type="button" onClick={() => onIrAPaciente(exito.codigo, exito.documento)}
                    className="w-full border border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-semibold px-4 py-2.5 rounded-md flex items-center justify-center gap-2 cursor-pointer">
                    Ver como paciente en Mediconnect <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button type="button" onClick={nuevaFormula}
                  className="w-full border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold px-4 py-2.5 rounded-md flex items-center justify-center gap-2 cursor-pointer">
                  <RotateCcw className="w-4 h-4" /> Nueva fórmula
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Fórmula médica</p>
                <p className="text-2xl font-mono font-bold text-slate-900 mt-0.5">{siguienteCodigo}</p>
                <p className="text-xs text-slate-500">Código asignado al enviar</p>
              </div>
              <dl className="px-5 py-4 text-sm space-y-2.5">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Paciente</dt>
                  <dd className="font-medium text-right truncate">{nombre || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Documento</dt>
                  <dd className="font-mono">{documento || '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Reclamar hasta</dt>
                  <dd className="text-right">
                    {fechaLarga(fechaLimite)}
                    {diasVigencia != null && diasVigencia >= 0 && (
                      <span className="block text-xs text-slate-500">{diasVigencia} días de vigencia</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Medicamentos</dt>
                  <dd>{items.length}</dd>
                </div>
                <div className="flex justify-between items-baseline gap-3 pt-2.5 border-t border-slate-200">
                  <dt className="text-slate-700 font-semibold">Cuota moderadora</dt>
                  <dd className="text-lg font-bold text-slate-900">
                    {cuotaEstimada == null ? '—' : cuotaEstimada > 0 ? pesos(cuotaEstimada) : 'Sin costo'}
                  </dd>
                </div>
              </dl>

              <div className="px-5 pb-5 space-y-3">
                {error && (
                  <div role="alert" className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 text-red-800 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">No se pudo enviar la fórmula</p>
                      <p>{error}</p>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={enviando || items.length === 0}
                  className="w-full bg-ips hover:bg-ips-oscuro disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold px-4 py-3 rounded-md shadow-sm transition flex items-center justify-center gap-2 cursor-pointer">
                  <Send className="w-4 h-4" />
                  {enviando ? 'Enviando…' : 'Firmar y enviar a la farmacia'}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  La fórmula llega a Mediconnect y el paciente puede reclamarla.
                </p>
              </div>
            </div>
          )}
        </aside>
      </form>
    </div>
  );
}
