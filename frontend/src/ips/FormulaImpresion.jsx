import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { LogoIps, NOMBRE_IPS } from './IngresoIps';
import { enlaceFormula } from '../lib/qrFormula';

// Fórmula médica de Salud IPS para imprimir en hoja carta.
// Se monta fuera de la página (en <body>) y, al imprimir, es lo único que sale en el papel
// (ver ".formula-impresion" en index.css).

const AZUL = '#1b63c6';
const NOCHE = '#14306a';
const ROJO = '#e3263c';

const REGIMENES = { contributivo: 'Contributivo', subsidiado: 'Subsidiado' };
const EXENCIONES = {
  promocion_prevencion: 'Promoción y prevención',
  control_prenatal: 'Control prenatal',
  alto_costo: 'Alto costo',
  urgencia: 'Urgencia',
};

const fechaLarga = (f) =>
  f ? new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

// Cantidad en letras (las fórmulas en Colombia llevan la cantidad en números y letras)
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos',
  'setecientos', 'ochocientos', 'novecientos'];
function enLetras(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 30) return UNIDADES[n];
  if (n < 100) return DECENAS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNIDADES[n % 10]}` : '');
  if (n === 100) return 'cien';
  if (n < 1000) return CENTENAS[Math.floor(n / 100)] + (n % 100 ? ` ${enLetras(n % 100)}` : '');
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    return (miles === 1 ? 'mil' : `${enLetras(miles)} mil`) + (n % 1000 ? ` ${enLetras(n % 1000)}` : '');
  }
  return String(n);
}

const celda = { border: '1px solid #cbd5e1', padding: '2.2mm 2.5mm', verticalAlign: 'top' };
const etiqueta = { fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748b', fontWeight: 700 };
const valor = { fontSize: '10.5pt', color: '#0f172a', fontWeight: 600, marginTop: '0.6mm' };

// datos = { codigo, nombre, documento, fechaEmision, fechaLimite, eps, regimen, rangoIngreso, exencion, cuota, items, indicaciones }
export function FormulaImpresion({ datos, medico }) {
  const impreso = new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  // QR con el enlace a la fórmula (celular del paciente y pantalla de la entrada)
  const [qr, setQr] = useState('');
  useEffect(() => {
    let vigente = true;
    QRCode.toString(enlaceFormula(datos.codigo, datos.documento), { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
      .then((svg) => vigente && setQr(svg.replace('<svg ', '<svg width="100%" height="100%" ')))
      .catch(() => vigente && setQr(''));
    return () => { vigente = false; };
  }, [datos.codigo, datos.documento]);
  const afiliacion = [
    REGIMENES[datos.regimen] ?? datos.regimen,
    datos.regimen === 'contributivo' && datos.rangoIngreso ? `rango ${datos.rangoIngreso}` : null,
  ].filter(Boolean).join(' · ');

  return createPortal(
    <div className="formula-impresion" style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${AZUL}`, paddingBottom: '4mm' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5mm' }}>
          <LogoIps className="text-[34pt]" />
          <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '4mm' }}>
            <div style={{ fontSize: '12pt', fontWeight: 700, color: NOCHE }}>{NOMBRE_IPS}</div>
            <div style={{ fontSize: '9pt', color: '#475569' }}>Consulta externa</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '15pt', fontWeight: 800, color: NOCHE, letterSpacing: '0.02em' }}>FÓRMULA MÉDICA</div>
          <div style={{ fontSize: '9pt', color: '#475569', marginTop: '1mm' }}>Código</div>
          <div style={{ fontFamily: '"Courier New", monospace', fontSize: '15pt', fontWeight: 700 }}>{datos.codigo}</div>
        </div>
      </div>

      {/* Paciente y fechas */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5mm' }}>
        <tbody>
          <tr>
            <td style={{ ...celda, width: '40%' }}>
              <div style={etiqueta}>Paciente</div>
              <div style={valor}>{datos.nombre}</div>
            </td>
            <td style={{ ...celda, width: '24%' }}>
              <div style={etiqueta}>Documento</div>
              <div style={valor}>{datos.documento}</div>
            </td>
            <td style={celda}>
              <div style={etiqueta}>Fecha de la fórmula</div>
              <div style={valor}>{fechaLarga(datos.fechaEmision)}</div>
            </td>
          </tr>
          <tr>
            <td style={celda}>
              <div style={etiqueta}>EPS</div>
              <div style={valor}>{datos.eps || '—'}</div>
            </td>
            <td style={celda}>
              <div style={etiqueta}>Régimen</div>
              <div style={valor}>{afiliacion || '—'}</div>
            </td>
            <td style={celda}>
              <div style={etiqueta}>Reclamar hasta</div>
              <div style={{ ...valor, color: ROJO }}>{fechaLarga(datos.fechaLimite)}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Medicamentos */}
      <div style={{ fontSize: '10pt', fontWeight: 700, color: NOCHE, margin: '6mm 0 2mm' }}>Medicamentos formulados</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
        <thead>
          <tr style={{ background: '#eaf2fc' }}>
            <th style={{ ...celda, width: '8mm', textAlign: 'center' }}>#</th>
            <th style={{ ...celda, textAlign: 'left' }}>Medicamento</th>
            <th style={{ ...celda, textAlign: 'left' }}>Presentación</th>
            <th style={{ ...celda, textAlign: 'right', width: '18mm' }}>Cantidad</th>
            <th style={{ ...celda, textAlign: 'left', width: '50mm' }}>Cantidad en letras</th>
          </tr>
        </thead>
        <tbody>
          {datos.items.map((it, i) => (
            <tr key={it.medicamento_id}>
              <td style={{ ...celda, textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
              <td style={{ ...celda, fontWeight: 700 }}>{it.nombre}</td>
              <td style={celda}>{it.presentacion}</td>
              <td style={{ ...celda, textAlign: 'right', fontWeight: 700 }}>{it.cantidad}</td>
              <td style={celda}>{enLetras(it.cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Indicaciones del médico (si las escribió) */}
      {datos.indicaciones && (
        <div style={{ marginTop: '5mm', border: '1px solid #cbd5e1', borderRadius: '2mm', padding: '3mm 4mm' }}>
          <div style={etiqueta}>Indicaciones</div>
          <div style={{ fontSize: '10pt', lineHeight: 1.45, marginTop: '1mm', whiteSpace: 'pre-wrap' }}>{datos.indicaciones}</div>
        </div>
      )}

      {/* Cobro y dónde reclamar */}
      <div style={{ display: 'flex', gap: '5mm', marginTop: '6mm' }}>
        <div style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '2mm', padding: '3mm 4mm' }}>
          <div style={etiqueta}>Cuota moderadora al reclamar</div>
          <div style={{ fontSize: '13pt', fontWeight: 800, marginTop: '0.6mm' }}>
            {datos.exencion ? `Sin costo (${EXENCIONES[datos.exencion] ?? 'exento'})` : datos.cuota > 0 ? pesos(datos.cuota) : 'Sin costo'}
          </div>
        </div>
        <div style={{ flex: 2, display: 'flex', gap: '4mm', alignItems: 'center', border: `1px solid ${AZUL}`, background: '#eaf2fc', borderRadius: '2mm', padding: '3mm 4mm', fontSize: '9.5pt', lineHeight: 1.45 }}>
          {qr && (
            <div style={{ background: '#fff', padding: '1.5mm', borderRadius: '1mm', flexShrink: 0 }}>
              <div style={{ width: '27mm', height: '27mm' }} dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
          )}
          <div>
            <strong style={{ color: NOCHE }}>Reclame sus medicamentos en la farmacia Mediconnect.</strong>{' '}
            Escanee este código con la cámara de su celular para ver su fórmula, pedir turno o pedirla a domicilio, o muéstrelo
            en la pantalla de la entrada. También puede usar su documento y el código
            {' '}<strong style={{ fontFamily: '"Courier New", monospace' }}>{datos.codigo}</strong>.
            Después de la fecha límite la fórmula vence.
          </div>
        </div>
      </div>

      {/* Firma */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22mm' }}>
        <div style={{ width: '75mm', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #0f172a', paddingTop: '1.5mm', fontSize: '10pt', fontWeight: 700 }}>
            Dr(a). {medico?.nombre ?? 'Médico tratante'}
          </div>
          <div style={{ fontSize: '8.5pt', color: '#475569' }}>Médico tratante · {NOMBRE_IPS}</div>
        </div>
      </div>

      {/* Pie */}
      <div style={{ marginTop: '12mm', borderTop: '1px solid #e2e8f0', paddingTop: '2mm', fontSize: '7.5pt', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
        <span>Documento generado por el sistema de prueba de {NOMBRE_IPS}.</span>
        <span>Impreso: {impreso}</span>
      </div>
    </div>,
    document.body
  );
}

// Imprime la fórmula montada. Al terminar (o cancelar) la página vuelve a su estado normal.
// codigo: se usa como título mientras se imprime, para que el PDF se guarde como "Formula F-2026-0054".
export function imprimirFormula(codigo) {
  // Hoja carta sin margen también para la página por defecto (algunos navegadores no aplican la hoja con nombre)
  const estilo = document.createElement('style');
  estilo.textContent = '@page { size: letter; margin: 0; }';
  document.head.appendChild(estilo);
  const tituloAnterior = document.title;
  if (typeof codigo === 'string') document.title = `Formula ${codigo}`;
  document.body.classList.add('con-formula');

  const quitar = () => {
    document.body.classList.remove('con-formula');
    estilo.remove();
    document.title = tituloAnterior;
    window.removeEventListener('afterprint', quitar);
  };
  window.addEventListener('afterprint', quitar);
  setTimeout(() => window.print(), 200);
}
