import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Tiquete de turno para impresoras térmicas (rollo de 58 u 80 mm): solo negro, sin fondos.
// Se monta fuera de la página (en <body>) y, al imprimir, es lo único que sale en el papel
// (ver ".tiquete-impresion" en index.css).

const TRAMITES = {
  reclamar: 'Reclamar medicamentos',
  virtual: 'Turno virtual',
  otro: 'Otro trámite',
};
const PRIORIDADES = {
  adulto_mayor: 'Adulto mayor',
  embarazada: 'Mujer en embarazo',
  discapacidad: 'Persona con discapacidad',
};

const fecha = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const hora = (d) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

// datos = { numero, tramite, prioridad, fecha }; papel = 58 | 80
export function TiqueteImpresion({ datos, papel = 80 }) {
  const ancho = papel === 58 ? '48mm' : '72mm'; // área que imprime cada rollo
  return createPortal(
    <div className="tiquete-impresion" style={{ width: ancho }}>
      <div style={{ textAlign: 'center', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', padding: '3mm 0 6mm' }}>
        <img src="/img/logo-simbolo.png" alt="" style={{ width: '12mm', height: '12mm', margin: '0 auto', filter: 'grayscale(1) contrast(1.4)' }} />
        <div style={{ fontWeight: 800, fontSize: papel === 58 ? '13pt' : '15pt' }}>Mediconnect</div>
        <div style={{ fontSize: '8pt' }}>Farmacia</div>
        <div style={{ borderTop: '1px dashed #000', margin: '2.5mm 0' }} />
        <div style={{ fontSize: '10pt', fontWeight: 700 }}>TURNO</div>
        <div style={{ fontSize: papel === 58 ? '30pt' : '38pt', fontWeight: 800, lineHeight: 1.05 }}>{datos.numero}</div>
        <div style={{ fontSize: '10pt', fontWeight: 700, marginTop: '1.5mm' }}>{TRAMITES[datos.tramite] ?? ''}</div>
        {datos.prioridad && datos.prioridad !== 'ninguna' && (
          <div style={{ fontSize: '9pt', marginTop: '1mm' }}>Preferencial: {PRIORIDADES[datos.prioridad]}</div>
        )}
        <div style={{ borderTop: '1px dashed #000', margin: '2.5mm 0' }} />
        <div style={{ fontSize: '9pt' }}>{fecha(datos.fecha)} · {hora(datos.fecha)}</div>
        <div style={{ fontSize: '8.5pt', marginTop: '2mm' }}>Espere a que su turno aparezca en la pantalla de la sala.</div>
      </div>
    </div>,
    document.body
  );
}

// Imprime el tiquete que esté montado. Al terminar (o cancelar) la página vuelve a su estado normal.
export function imprimirTiquete() {
  document.body.classList.add('con-tiquete');
  const quitar = () => {
    document.body.classList.remove('con-tiquete');
    window.removeEventListener('afterprint', quitar);
  };
  window.addEventListener('afterprint', quitar);
  // Un momento para que cargue el logo antes de imprimir
  setTimeout(() => window.print(), 300);
}

// Imprime automáticamente una vez cuando "activo" pasa a true
export function useImpresionAutomatica(activo) {
  useEffect(() => {
    if (activo) imprimirTiquete();
  }, [activo]);
}
