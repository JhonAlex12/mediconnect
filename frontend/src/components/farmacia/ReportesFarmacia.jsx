import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso, BotonAccion, claseCampo } from './comunes';
import { BarrasHorizontales, COLOR, Columnas, Leyenda } from './Graficas';

// "2026-11-05" → "5 nov 2026" (sin pasar por zonas horarias)
const fechaCorta = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const dosDigitos = (n) => String(n).padStart(2, '0');
const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;
const MEDIOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', datafono: 'Tarjeta (datáfono)' };

// Cada reporte: qué mide y cómo se muestran sus columnas
const REPORTES = {
  faltantes: {
    titulo: 'Faltantes',
    descripcion: 'Lo que falta por entregar en fórmulas vigentes emitidas en el rango.',
    columnas: [
      { clave: 'nombre', texto: 'Medicamento', valor: (f) => `${f.nombre} ${f.presentacion}` },
      { clave: 'cantidad_pendiente', texto: 'Unidades pendientes', numero: true },
      { clave: 'formulas_afectadas', texto: 'Fórmulas afectadas', numero: true },
      { clave: 'stock_actual', texto: 'Stock actual', numero: true },
    ],
  },
  espera: {
    titulo: 'Tiempo de espera',
    descripcion: 'Minutos desde que el paciente llegó hasta que lo llamaron, en turnos atendidos.',
    columnas: [
      { clave: 'tipo', texto: 'Tipo de turno', valor: (f) => (f.tipo === 'fisico' ? 'Físico' : 'Virtual') },
      { clave: 'atendidos', texto: 'Atendidos', numero: true },
      { clave: 'minutos_promedio', texto: 'Promedio (min)', numero: true },
      { clave: 'minutos_maximo', texto: 'Máximo (min)', numero: true },
    ],
  },
  'horas-pico': {
    titulo: 'Horas pico',
    descripcion: 'Turnos tomados según la hora del día (hora de Colombia).',
    columnas: [
      { clave: 'hora', texto: 'Hora', valor: (f) => `${dosDigitos(f.hora)}:00 – ${dosDigitos(f.hora + 1)}:00` },
      { clave: 'turnos', texto: 'Turnos', numero: true },
    ],
  },
  faltas: {
    titulo: 'Asistencia',
    descripcion: 'Resultado de los turnos por día. "No se presentó": venció sin llegar o después de ser pausado.',
    columnas: [
      { clave: 'fecha', texto: 'Fecha', valor: (f) => fechaCorta(f.fecha) },
      { clave: 'total', texto: 'Total', numero: true },
      { clave: 'atendidos', texto: 'Atendidos', numero: true },
      { clave: 'cancelados', texto: 'Cancelados', numero: true },
      { clave: 'no_presentados', texto: 'No se presentó', numero: true },
    ],
  },
  caja: {
    titulo: 'Cierre de caja',
    descripcion: 'Cuotas moderadoras cobradas por día, auxiliar y medio de pago.',
    columnas: [
      { clave: 'fecha', texto: 'Fecha', valor: (f) => fechaCorta(f.fecha) },
      { clave: 'auxiliar', texto: 'Auxiliar' },
      { clave: 'medio', texto: 'Medio de pago', valor: (f) => MEDIOS[f.medio] ?? f.medio },
      { clave: 'pagos', texto: 'Pagos', numero: true },
      { clave: 'total', texto: 'Total', numero: true, valor: (f) => pesos(f.total) },
    ],
  },
};

// "2026-11-05" → "5 nov" para los rótulos de las gráficas
const diaCorto = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
};
const plural = (n, uno, varios) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;

const SERIES_ASISTENCIA = [
  { clave: 'atendidos', nombre: 'Atendidos', color: COLOR.azul },
  { clave: 'cancelados', nombre: 'Cancelados', color: COLOR.verde },
  { clave: 'no_presentados', nombre: 'No se presentó', color: COLOR.naranja },
];

// Gráfica de cada reporte, encima de su tabla
function GraficaReporte({ r }) {
  const datos = r.datos;
  let titulo;
  let contenido;

  if (r.tipo === 'faltantes') {
    const top = datos.slice(0, 10);
    titulo = datos.length > 10 ? `Los 10 medicamentos con más unidades pendientes (de ${datos.length})` : 'Unidades pendientes por medicamento';
    contenido = (
      <BarrasHorizontales ancho="w-56" filas={top.map((f) => ({
        etiqueta: `${f.nombre} ${f.presentacion}`,
        valor: f.cantidad_pendiente,
        texto: f.cantidad_pendiente.toLocaleString('es-CO'),
        detalle: [`${f.nombre} ${f.presentacion}`, plural(f.cantidad_pendiente, 'unidad pendiente', 'unidades pendientes'),
          plural(f.formulas_afectadas, 'fórmula afectada', 'fórmulas afectadas'), `Stock actual: ${f.stock_actual}`],
      }))} />
    );
  } else if (r.tipo === 'espera') {
    titulo = 'Espera promedio en minutos, por tipo de turno';
    contenido = (
      <BarrasHorizontales ancho="w-24" filas={datos.map((f) => {
        const nombre = f.tipo === 'fisico' ? 'Físico' : 'Virtual';
        return {
          etiqueta: nombre,
          valor: f.minutos_promedio,
          texto: `${f.minutos_promedio.toLocaleString('es-CO')} min`,
          detalle: [`Turno ${nombre.toLowerCase()}`, `Promedio: ${f.minutos_promedio} min`, `Máximo: ${f.minutos_maximo} min`,
            plural(f.atendidos, 'turno atendido', 'turnos atendidos')],
        };
      })} />
    );
  } else if (r.tipo === 'horas-pico') {
    // Todas las horas entre la primera y la última con turnos, aunque alguna quede en cero
    const porHora = new Map(datos.map((f) => [f.hora, f.turnos]));
    const horas = datos.map((f) => f.hora);
    const pico = datos.reduce((a, b) => (b.turnos > a.turnos ? b : a));
    const columnas = [];
    for (let h = Math.min(...horas); h <= Math.max(...horas); h++) {
      const turnos = porHora.get(h) ?? 0;
      const esPico = h === pico.hora;
      columnas.push({
        clave: h,
        etiqueta: `${dosDigitos(h)}:00`,
        segmentos: [{ valor: turnos, color: esPico ? COLOR.azul : COLOR.gris }],
        rotulo: esPico ? String(turnos) : null,
        detalle: [`${dosDigitos(h)}:00 – ${dosDigitos(h + 1)}:00`, plural(turnos, 'turno', 'turnos')],
      });
    }
    titulo = `Turnos por hora del día · la hora pico es de ${dosDigitos(pico.hora)}:00 a ${dosDigitos(pico.hora + 1)}:00`;
    contenido = <Columnas columnas={columnas} />;
  } else if (r.tipo === 'faltas') {
    titulo = 'Resultado de los turnos por día';
    contenido = (
      <>
        <div className="mb-3"><Leyenda series={SERIES_ASISTENCIA} /></div>
        <Columnas columnas={datos.map((f) => ({
          clave: String(f.fecha).slice(0, 10),
          etiqueta: diaCorto(f.fecha),
          segmentos: SERIES_ASISTENCIA.map((s) => ({ valor: f[s.clave], color: s.color })),
          detalle: [fechaCorta(f.fecha), `${f.total} turnos en total`,
            ...SERIES_ASISTENCIA.map((s) => `${s.nombre}: ${f[s.clave]}`)],
        }))} />
      </>
    );
  } else if (r.tipo === 'caja') {
    // Recaudo por día (de la fecha más antigua a la más reciente) y por medio de pago
    const porDia = new Map();
    const porMedio = new Map();
    for (const f of datos) {
      const dia = String(f.fecha).slice(0, 10);
      const d = porDia.get(dia) ?? { total: 0, pagos: 0 };
      porDia.set(dia, { total: d.total + f.total, pagos: d.pagos + f.pagos });
      const m = porMedio.get(f.medio) ?? { total: 0, pagos: 0 };
      porMedio.set(f.medio, { total: m.total + f.total, pagos: m.pagos + f.pagos });
    }
    const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b));
    const mayor = Math.max(...dias.map(([, d]) => d.total));
    titulo = null;
    contenido = (
      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <h4 className="font-semibold text-slate-800 mb-1">Recaudo por día</h4>
          <Columnas formato={(v) => (v >= 1000 ? `$${(v / 1000).toLocaleString('es-CO')} mil` : `$${v}`)}
            columnas={dias.map(([dia, d]) => ({
              clave: dia,
              etiqueta: diaCorto(dia),
              segmentos: [{ valor: d.total, color: COLOR.azul }],
              rotulo: d.total === mayor && dias.length > 1 ? pesos(d.total) : null,
              detalle: [fechaCorta(dia), pesos(d.total), plural(d.pagos, 'pago', 'pagos')],
            }))} />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 mb-3">Por medio de pago</h4>
          <BarrasHorizontales ancho="w-36" filas={[...porMedio.entries()].sort(([, a], [, b]) => b.total - a.total).map(([medio, m]) => ({
            etiqueta: MEDIOS[medio] ?? medio,
            valor: m.total,
            texto: pesos(m.total),
            detalle: [MEDIOS[medio] ?? medio, pesos(m.total), plural(m.pagos, 'pago', 'pagos')],
          }))} />
        </div>
      </div>
    );
  }

  if (!contenido) return null;
  return (
    <div className="px-5 py-5 border-b border-slate-200">
      {titulo && <h4 className="font-semibold text-slate-800 mb-3">{titulo}</h4>}
      {contenido}
      <p className="text-xs text-slate-500 mt-3">Pasa el mouse sobre una barra para ver el detalle. Los valores exactos están en la tabla.</p>
    </div>
  );
}

const textoCelda = (col, fila) => (col.valor ? col.valor(fila) : fila[col.clave] ?? '—');

// Descarga el reporte como CSV (con BOM para que Excel respete las tildes)
function descargarCsv(tipo, resultado) {
  const { columnas } = REPORTES[tipo];
  const escapar = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lineas = [
    columnas.map((c) => escapar(c.texto)).join(';'),
    ...resultado.datos.map((f) => columnas.map((c) => escapar(textoCelda(c, f))).join(';')),
  ];
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-${tipo}-${resultado.desde}-a-${resultado.hasta}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportesFarmacia() {
  const [tipo, setTipo] = useState('faltantes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const consultar = useCallback(async (tipoConsulta, rango) => {
    setCargando(true);
    setAviso(null);
    try {
      const params = new URLSearchParams();
      if (rango.desde) params.set('desde', rango.desde);
      if (rango.hasta) params.set('hasta', rango.hasta);
      const qs = params.toString();
      const r = await api(`/reportes/${tipoConsulta}${qs ? `?${qs}` : ''}`);
      setResultado(r);
      // La primera vez el backend elige el rango (últimos 30 días): se muestra en los campos
      setDesde(r.desde);
      setHasta(r.hasta);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }, []);

  // Carga inicial con el rango por defecto del backend
  useEffect(() => {
    consultar('faltantes', {});
  }, [consultar]);

  const cambiarTipo = (nuevo) => {
    setTipo(nuevo);
    setResultado(null);
    consultar(nuevo, { desde, hasta });
  };

  const enviar = (e) => {
    e.preventDefault();
    consultar(tipo, { desde, hasta });
  };

  const def = REPORTES[tipo];
  const vigente = resultado?.tipo === tipo ? resultado : null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-slate-600" />
        Reportes
      </h2>

      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-fit" role="tablist" aria-label="Tipo de reporte">
        {Object.entries(REPORTES).map(([id, r]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tipo === id}
            onClick={() => cambiarTipo(id)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${
              tipo === id ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {r.titulo}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} className="bg-white rounded-xl border border-slate-300 p-5 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="rep-desde" className="block text-sm font-bold text-slate-800 mb-1">Desde</label>
          <input id="rep-desde" type="date" value={desde} max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)} className={claseCampo} />
        </div>
        <div>
          <label htmlFor="rep-hasta" className="block text-sm font-bold text-slate-800 mb-1">Hasta</label>
          <input id="rep-hasta" type="date" value={hasta} min={desde || undefined}
            onChange={(e) => setHasta(e.target.value)} className={claseCampo} />
        </div>
        <BotonAccion type="submit" color="oscuro" icono={RefreshCw} ocupado={cargando}>
          Consultar
        </BotonAccion>
        {vigente && !vigente.sin_datos && (
          <BotonAccion color="gris" icono={Download} onClick={() => descargarCsv(tipo, vigente)}>
            Descargar CSV
          </BotonAccion>
        )}
      </form>

      <Aviso aviso={aviso} />

      <section className="bg-white rounded-xl shadow-md border border-slate-300">
        <div className="px-5 py-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">{def.titulo}</h3>
          <p className="text-sm text-slate-500">
            {def.descripcion}
            {vigente && ` Del ${fechaCorta(vigente.desde)} al ${fechaCorta(vigente.hasta)}.`}
          </p>
        </div>

        {cargando || !vigente ? (
          <p className="p-6 text-slate-500">{cargando ? 'Generando el reporte…' : 'Sin consultar.'}</p>
        ) : vigente.sin_datos ? (
          <p className="p-6 text-slate-500">No hay datos en este rango de fechas.</p>
        ) : (
          <>
          <GraficaReporte r={vigente} />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  {def.columnas.map((c) => (
                    <th key={c.clave} className={`px-5 py-2 font-semibold ${c.numero ? 'text-right' : ''}`}>{c.texto}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {vigente.datos.map((fila, i) => (
                  <tr key={i}>
                    {def.columnas.map((c) => (
                      <td key={c.clave} className={`px-5 py-2.5 ${c.numero ? 'text-right tabular-nums' : 'text-slate-900'}`}>
                        {textoCelda(c, fila)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {vigente?.tipo === 'caja' && (
          <div className="px-5 py-3 border-t border-slate-200 text-sm text-slate-700 flex flex-wrap gap-x-8 gap-y-1">
            <p>Total recaudado: <strong className="text-base text-slate-900">{pesos(vigente.total_recaudado)}</strong></p>
            <p>Fórmulas entregadas sin cobro (subsidiado o exentas): <strong>{vigente.formulas_sin_cobro}</strong></p>
          </div>
        )}

        {vigente?.tipo === 'faltas' && (
          <p className="px-5 py-3 border-t border-slate-200 text-sm text-slate-700">
            Pacientes con faltas seguidas que deberán confirmar su próximo turno:{' '}
            <strong>{vigente.pacientes_con_faltas_seguidas}</strong>
          </p>
        )}
      </section>
    </div>
  );
}
