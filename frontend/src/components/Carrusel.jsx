import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useContenido } from '../lib/contenido';

// Cada slide viene del panel (Contenido del sitio → Carrusel).
// Sin "fondo" se trata como el banner de la marca: se muestra completo sobre el fondo general.
// Con "fondo" (color o degradado) la foto se muestra completa y sus bordes se funden con ese fondo.
// Celular: el desvanecido es arriba y abajo; computador: a los lados.
function Slide({ slide, primera }) {
  const banner = !slide.fondo;
  const contenido = (
    <div className="h-full" style={banner ? undefined : { background: slide.fondo }}>
      <picture className={`block h-full lg:flex lg:justify-center ${banner ? 'bg-marca-hielo lg:bg-transparent' : ''}`}>
        {slide.imagen_movil && <source media="(max-width: 700px)" srcSet={slide.imagen_movil} />}
        <img
          src={slide.imagen}
          alt={slide.texto_alt}
          fetchPriority={primera ? 'high' : undefined}
          loading={primera ? undefined : 'lazy'}
          className={`w-full h-full object-contain lg:w-auto lg:max-w-none lg:[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] ${
            banner ? '' : '[mask-image:linear-gradient(to_bottom,transparent,black_6%,black_94%,transparent)]'}`}
        />
      </picture>
    </div>
  );
  if (!slide.enlace) return contenido;
  return slide.enlace.startsWith('/')
    ? <Link to={slide.enlace} className="block h-full" aria-label={slide.texto_alt}>{contenido}</Link>
    : <a href={slide.enlace} target="_blank" rel="noopener noreferrer" className="block h-full" aria-label={slide.texto_alt}>{contenido}</a>;
}

const INTERVALO = 7000;

export default function Carrusel() {
  const { slides: SLIDES } = useContenido();
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [toque, setToque] = useState(null); // posición inicial del dedo

  const ir = useCallback((i) => setActual((i + SLIDES.length) % SLIDES.length), [SLIDES.length]);

  // Avance automático; se detiene con el mouse encima, con el foco dentro
  // o si la persona pidió reducir el movimiento
  useEffect(() => {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (pausado || reducir || SLIDES.length < 2) return;
    const t = setTimeout(() => ir(actual + 1), INTERVALO);
    return () => clearTimeout(t);
  }, [actual, pausado, ir, SLIDES.length]);

  if (SLIDES.length === 0) return null;

  return (
    // El fondo ocupa todo el ancho; en computador el carrusel toma la altura de la pantalla
    // y el banner se muestra completo (sin recortes) centrado sobre el fondo
    <div className="bg-[linear-gradient(to_right,#ffffff_0%,#ffffff_40%,#cbeee9_68%,#cbeee9_100%)]">
    <section
      className="relative w-full"
      aria-roledescription="carrusel"
      aria-label="Novedades de Mediconnect"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      onTouchStart={(e) => setToque(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (toque === null) return;
        const dx = e.changedTouches[0].clientX - toque;
        if (Math.abs(dx) > 50) ir(actual + (dx < 0 ? 1 : -1));
        setToque(null);
      }}
    >
      {/* Todas las slides ocupan la misma celda: la altura la fija la más alta */}
      <div className="grid overflow-hidden">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${SLIDES.length}: ${slide.nombre}`}
            aria-hidden={i !== actual}
            inert={i !== actual ? '' : undefined}
            className={`[grid-area:1/1] aspect-[4/3] lg:aspect-auto lg:h-[min(calc(100svh-11rem),56vw,1080px)] transition-opacity duration-700 ${
              i === actual ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <Slide slide={slide} primera={i === 0} />
          </div>
        ))}
      </div>

      {SLIDES.length > 1 && (<>
      <button type="button" onClick={() => ir(actual - 1)} aria-label="Slide anterior"
        className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-md text-marca-noche items-center justify-center cursor-pointer">
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button type="button" onClick={() => ir(actual + 1)} aria-label="Slide siguiente"
        className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white shadow-md text-marca-noche items-center justify-center cursor-pointer">
        <ChevronRight className="w-6 h-6" />
      </button>

      <div className="absolute bottom-4 inset-x-0 z-20 flex justify-center gap-2">
        {SLIDES.map(({ id, nombre }, i) => (
          <button
            key={id}
            type="button"
            onClick={() => ir(i)}
            aria-label={`Ir a: ${nombre}`}
            aria-current={i === actual}
            className={`h-2.5 rounded-full transition-all cursor-pointer ${
              i === actual ? 'w-8 bg-marca-verde' : 'w-2.5 bg-marca-noche/25 hover:bg-marca-noche/40'
            }`}
          />
        ))}
      </div>
      </>)}
    </section>
    </div>
  );
}
