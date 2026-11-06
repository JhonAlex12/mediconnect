import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso, BotonAccion, claseCampo } from './comunes';

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

      <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
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
