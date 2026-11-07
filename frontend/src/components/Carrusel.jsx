import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Slide 1: el banner de la marca (imagen 4:3 con su propio texto).
// En computador se muestra completo a la altura de la pantalla y sus bordes se funden con el fondo.
function SlideBanner() {
  return (
    <picture className="block h-full bg-marca-hielo lg:bg-transparent lg:flex lg:justify-center">
      <source media="(max-width: 700px)" srcSet="/img/banner-familia-900.webp" />
      <img
        src="/img/banner-familia-1600.webp"
        alt="Mediconnect. Tu salud, sin complicaciones: ¡reclama tus medicamentos desde casa! Evita filas y ahorra tiempo."
        className="w-full h-full object-contain lg:w-auto lg:max-w-none lg:[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        fetchPriority="high"
      />
    </picture>
  );
}

// Slides de foto 16:9, tratadas igual que el banner: la imagen completa (sin recortes),
// con los bordes desvanecidos hacia un fondo de sus mismos tonos.
// Celular: el desvanecido es arriba y abajo; computador: a los lados.
function SlideFoto({ nombre, alt, enlace, fondo }) {
  const contenido = (
    <div className="h-full" style={{ background: fondo }}>
      <picture className="block h-full lg:flex lg:justify-center">
        <source media="(max-width: 700px)" srcSet={`/img/slide-${nombre}-900.webp`} />
        <img src={`/img/slide-${nombre}-1600.webp`} alt={alt} loading="lazy"
          className="w-full h-full object-contain [mask-image:linear-gradient(to_bottom,transparent,black_6%,black_94%,transparent)] lg:w-auto lg:max-w-none lg:[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]" />
      </picture>
    </div>
  );
  return enlace ? <Link to={enlace} className="block h-full" aria-label={alt}>{contenido}</Link> : contenido;
}

const SLIDES = [
  { id: 'banner', nombre: 'Reclama tus medicamentos', Componente: SlideBanner },
  {
    id: 'bienestar',
    nombre: 'El bienestar de tu familia',
    Componente: () => (
      <SlideFoto nombre="bienestar" fondo="linear-gradient(to right, #f2ebe1 0%, #ece3d8 45%, #b9ada1 100%)"
        alt="El bienestar de tu familia es nuestra prioridad. Trabajamos de la mano para que disfrutes cada momento con tranquilidad." />
    ),
  },
  {
    id: 'sede',
    nombre: 'IPS y droguería en un solo lugar',
    Componente: () => (
      <SlideFoto nombre="sede" enlace="/#quienes-somos" fondo="linear-gradient(to right, #fbfdfd 0%, #eef7f9 45%, #a9d3db 100%)"
        alt="La salud y el bienestar en un solo lugar: IPS y droguería juntas para cuidar de ti y de tu familia. Conoce más." />
    ),
  },
];

const INTERVALO = 7000;

export default function Carrusel() {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [toque, setToque] = useState(null); // posición inicial del dedo

  const ir = useCallback((i) => setActual((i + SLIDES.length) % SLIDES.length), []);

  // Avance automático; se detiene con el mouse encima, con el foco dentro
  // o si la persona pidió reducir el movimiento
  useEffect(() => {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (pausado || reducir) return;
    const t = setTimeout(() => ir(actual + 1), INTERVALO);
    return () => clearTimeout(t);
  }, [actual, pausado, ir]);

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
        {SLIDES.map(({ id, nombre, Componente }, i) => (
          <div
            key={id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${SLIDES.length}: ${nombre}`}
            aria-hidden={i !== actual}
            inert={i !== actual ? '' : undefined}
            className={`[grid-area:1/1] aspect-[4/3] lg:aspect-auto lg:h-[min(calc(100svh-11rem),56vw,1080px)] transition-opacity duration-700 ${
              i === actual ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <Componente />
          </div>
        ))}
      </div>

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
    </section>
    </div>
  );
}
