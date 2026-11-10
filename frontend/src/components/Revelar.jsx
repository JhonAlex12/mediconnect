import React, { useEffect, useRef } from 'react';

// Un solo observador para toda la página: marca cada elemento como visible la primera vez que entra en pantalla
let observador = null;
function observar(el) {
  if (typeof IntersectionObserver === 'undefined') {
    el.classList.add('visible');
    return () => {};
  }
  observador ??= new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observador.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  observador.observe(el);
  return () => observador.unobserve(el);
}

// Hace aparecer su contenido con una animación suave al bajar por la página.
// efecto: 'arriba' (sube), 'izquierda', 'derecha' o 'zoom'; retraso en milisegundos para escalonar varios elementos.
export default function Revelar({ as: Etiqueta = 'div', efecto = 'arriba', retraso = 0, className = '', style, children, ...resto }) {
  const ref = useRef(null);
  useEffect(() => observar(ref.current), []);
  return (
    <Etiqueta ref={ref} data-efecto={efecto} className={`revelar ${className}`}
      style={retraso ? { ...style, '--retraso': `${retraso}ms` } : style} {...resto}>
      {children}
    </Etiqueta>
  );
}
