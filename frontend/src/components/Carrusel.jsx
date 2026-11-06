import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronLeft, ChevronRight, Search } from 'lucide-react';

// Cruz decorativa del estilo del banner
function Cruz({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="currentColor" />
    </svg>
  );
}

// Fondo claro con manchas suaves en azul y verde agua, como el banner
function FondoMarca({ children }) {
  return (
    <div className="relative h-full overflow-hidden bg-marca-hielo">
      <div className="absolute -top-24 right-10 w-96 h-72 rounded-full bg-blue-200/50 blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-24 -left-10 w-96 h-72 rounded-full bg-marca-verde/20 blur-2xl" aria-hidden="true" />
      <div className="absolute top-1/3 right-1/3 w-72 h-72 rounded-full bg-marca-verde/10 blur-2xl" aria-hidden="true" />
      <Cruz className="absolute top-8 right-[42%] w-12 h-12 text-marca-verde/40" />
      <Cruz className="absolute bottom-10 left-6 w-10 h-10 text-blue-300/60" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function BotonSlide({ to, children, variante = 'verde' }) {
  const clases = variante === 'verde'
    ? 'bg-marca-verde hover:bg-marca-verde-oscuro text-white shadow-lg shadow-marca-verde/30'
    : 'bg-white hover:bg-slate-50 text-marca-noche border border-slate-200';
  return (
    <Link to={to} className={`inline-flex items-center gap-2 font-bold text-lg px-6 py-3 rounded-full transition ${clases}`}>
      {children}
      <ChevronRight className="w-5 h-5" />
    </Link>
  );
}

// Slide 1: el banner de la marca (imagen con su propio texto).
// Se recorta solo por abajo en computador y por la derecha en celular,
// para que el logo y el mensaje siempre queden a la vista.
function SlideBanner() {
  return (
    <picture className="block h-full bg-marca-hielo lg:bg-transparent">
      <source media="(max-width: 700px)" srcSet="/img/banner-familia-900.webp" />
      <img
        src="/img/banner-familia-1600.webp"
        alt="Mediconnect. Tu salud, sin complicaciones: ¡reclama tus medicamentos desde casa! Evita filas y ahorra tiempo."
        className="w-full h-full object-cover object-[0%_50%] lg:object-[50%_10%] lg:[mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
        fetchPriority="high"
      />
    </picture>
  );
}

// Slide 2: turno virtual
function SlideTurno() {
  return (
    <FondoMarca>
      <div className="h-full grid lg:grid-cols-2 gap-8 items-center px-6 sm:px-16 lg:px-24 py-10">
        <div className="space-y-5">
          <p className="text-marca-noche font-semibold">Sin madrugar, sin filas</p>
          <h2 className="font-titulo font-black text-3xl sm:text-5xl leading-tight text-marca-noche uppercase">
            Pide tu <span className="text-marca-verde">turno virtual</span> desde el celular
          </h2>
          <p className="text-lg text-slate-700 max-w-lg">
            Tus medicamentos quedan apartados mientras llegas. Te avisamos cuando te llamen a la ventanilla.
          </p>
          <BotonSlide to="/paciente">Pedir mi turno</BotonSlide>
        </div>
        <div className="hidden lg:flex justify-center" aria-hidden="true">
          <div className="w-72 bg-white rounded-[2rem] shadow-2xl shadow-marca-azul/20 p-5 space-y-4 border border-slate-200">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tu turno</p>
            <div className="bg-gradient-to-br from-marca-azul to-marca-verde text-white rounded-2xl p-5 text-center">
              <p className="font-titulo text-5xl font-black">V-014</p>
              <p className="text-sm text-white/80 mt-1">Estás en la fila</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-marca-hielo rounded-xl p-2.5">
                <p className="text-slate-500 text-xs">Tu posición</p>
                <p className="font-bold text-marca-noche">3º · ~10 min</p>
              </div>
              <div className="bg-marca-hielo rounded-xl p-2.5">
                <p className="text-slate-500 text-xs">Atendiendo</p>
                <p className="font-bold text-marca-noche">V-011</p>
              </div>
            </div>
            <div className="bg-marca-verde-claro rounded-xl p-3 text-sm flex gap-2 text-marca-noche">
              <Bell className="w-4 h-4 text-marca-verde-oscuro shrink-0 mt-0.5" />
              Te avisaremos cuando te llamen.
            </div>
          </div>
        </div>
      </div>
    </FondoMarca>
  );
}

// Slide 3: consulta de disponibilidad
function SlideDisponibilidad() {
  const ejemplo = [
    ['Acetaminofén 500 mg', 'Disponible', 'bg-emerald-100 text-emerald-800'],
    ['Losartán 50 mg', 'Pocas unidades', 'bg-amber-100 text-amber-900'],
    ['Metformina 850 mg', 'Disponible', 'bg-emerald-100 text-emerald-800'],
  ];
  return (
    <FondoMarca>
      <div className="h-full grid lg:grid-cols-2 gap-8 items-center px-6 sm:px-16 lg:px-24 py-10">
        <div className="space-y-5">
          <p className="text-marca-noche font-semibold">Antes de salir de casa</p>
          <h2 className="font-titulo font-black text-3xl sm:text-5xl leading-tight text-marca-noche uppercase">
            Consulta si tus <span className="text-marca-verde">medicamentos</span> están disponibles
          </h2>
          <p className="text-lg text-slate-700 max-w-lg">
            Solo necesitas el código de tu fórmula y tu documento. Si algo falta, te avisamos cuando llegue.
          </p>
          <BotonSlide to="/paciente">Consultar mi fórmula</BotonSlide>
        </div>
        <div className="hidden lg:flex justify-center" aria-hidden="true">
          <div className="w-96 bg-white rounded-3xl shadow-2xl shadow-marca-azul/20 p-6 space-y-4 border border-slate-200">
            <div className="flex items-center gap-2 text-marca-noche font-bold">
              <Search className="w-5 h-5 text-marca-verde" />
              Fórmula F-2026-0014
            </div>
            <ul className="divide-y divide-slate-100">
              {ejemplo.map(([nombre, estado, clase]) => (
                <li key={nombre} className="py-3 flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-800">{nombre}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${clase}`}>{estado}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </FondoMarca>
  );
}

const SLIDES = [
  { id: 'banner', nombre: 'Reclama tus medicamentos', Componente: SlideBanner },
  { id: 'turno', nombre: 'Turno virtual', Componente: SlideTurno },
  { id: 'disponibilidad', nombre: 'Consulta de disponibilidad', Componente: SlideDisponibilidad },
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
    // El fondo ocupa todo el ancho; el carrusel mantiene proporción 2:1 y se achica
    // si la pantalla es baja, para que la imagen nunca quede cortada
    <div className="bg-[linear-gradient(to_right,#ffffff_0%,#ffffff_45%,#cdefea_100%)]">
    <section
      className="relative mx-auto w-full lg:w-[min(1440px,100%,calc((100svh-7.5rem)*2))]"
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
            className={`[grid-area:1/1] min-h-[26rem] lg:min-h-0 lg:aspect-[2/1] transition-opacity duration-700 ${
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

      <div className="absolute bottom-4 inset-x-0 lg:right-auto lg:left-[6.5%] z-20 flex justify-center gap-2">
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
