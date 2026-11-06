import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso } from './comunes';
import {
  Boton, Campo, Cargando, Cuerpo, Encabezado, Entrada, EstadoVacio, Fila, Panel, Segmentado, Tabla, Td, Th,
  TituloPantalla,
} from '../ui';

// "2026-11-05" → "5 nov 2026" (sin pasar por zonas horarias)
const fechaCorta = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

const dosDigitos = (n) => String(n).padStart(2, '0');

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
    <div>
      <TituloPantalla titulo="Reportes" descripcion={def.descripcion} />

      <div className="space-y-5">
        <Segmentado
          etiqueta="Tipo de reporte"
          valor={tipo}
          onChange={cambiarTipo}
          opciones={Object.entries(REPORTES).map(([id, r]) => ({ valor: id, texto: r.titulo }))}
        />

        <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
          <Campo id="rep-desde" etiqueta="Desde">
            <Entrada type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)}
              className="cifras" />
          </Campo>
          <Campo id="rep-hasta" etiqueta="Hasta">
            <Entrada type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)}
              className="cifras" />
          </Campo>
          <Boton type="submit" variante="primario" icono={RefreshCw} cargando={cargando}>
            Consultar
          </Boton>
          {vigente && !vigente.sin_datos && (
            <Boton variante="secundario" icono={Download} onClick={() => descargarCsv(tipo, vigente)}>
              Descargar CSV
            </Boton>
          )}
        </form>

        <Aviso aviso={aviso} />

        <Panel
          titulo={def.titulo}
          descripcion={vigente ? `Del ${fechaCorta(vigente.desde)} al ${fechaCorta(vigente.hasta)}` : undefined}
          sinRelleno
        >
          {cargando || !vigente ? (
            cargando ? <Cargando texto="Generando el reporte…" /> : <EstadoVacio titulo="Sin consultar" />
          ) : vigente.sin_datos ? (
            <EstadoVacio titulo="No hay datos en este rango de fechas">Prueba con un rango más amplio.</EstadoVacio>
          ) : (
            <Tabla etiqueta={`Reporte de ${def.titulo.toLowerCase()}`}>
              <Encabezado>
                {def.columnas.map((c) => (
                  <Th key={c.clave} numero={c.numero}>{c.texto}</Th>
                ))}
              </Encabezado>
              <Cuerpo>
                {vigente.datos.map((fila, i) => (
                  <Fila key={i}>
                    {def.columnas.map((c) => (
                      <Td key={c.clave} numero={c.numero} className={c.numero ? '' : 'text-tinta'}>
                        {textoCelda(c, fila)}
                      </Td>
                    ))}
                  </Fila>
                ))}
              </Cuerpo>
            </Tabla>
          )}

          {vigente?.tipo === 'faltas' && (
            <p className="px-4 py-3 border-t border-borde text-sm text-tinta-suave">
              Pacientes con faltas seguidas que deberán confirmar su próximo turno:{' '}
              <strong className="text-tinta cifras">{vigente.pacientes_con_faltas_seguidas}</strong>
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
