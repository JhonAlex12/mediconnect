import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Clock, LayoutDashboard, LogIn, Mail, MapPin, Menu, Phone, UserRound, X } from 'lucide-react';
import { Logo } from './Encabezado';
import VentanaIngreso from './cuenta/VentanaIngreso';
import ChatBot from './ChatBot';
import { useSesion } from '../lib/sesion';
import { useCuenta } from '../lib/cuenta';
import { useContacto } from '../lib/contenido';

// Permite abrir la ventana de ingreso desde cualquier página pública
const ContextoIngreso = createContext(() => {});
export const useAbrirIngreso = () => useContext(ContextoIngreso);

const MENU = [
  { a: '/', texto: 'Inicio', fin: true },
  { a: '/paciente', texto: 'Mi fórmula' },
  { a: '/informacion', texto: 'Información al paciente' },
  { a: '/#domicilio', texto: 'Domicilios', ancla: true },
  { a: '/salud-al-dia', texto: 'Salud al día' },
  { a: '/#contacto', texto: 'Contáctenos', ancla: true },
];

// Al llegar con un ancla (/informacion#cuotas) baja hasta la sección; si no, sube al inicio
function useDesplazarAAncla() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    // Espera a que la página pinte su contenido
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50);
    return () => clearTimeout(t);
  }, [pathname, hash]);
}

const claseMenu = (activo) =>
  `px-3 py-2.5 font-semibold text-[15px] whitespace-nowrap border-b-2 transition ${
    activo ? 'text-marca-azul border-marca-azul' : 'text-slate-700 border-transparent hover:text-marca-azul'}`;

// Estructura de las páginas públicas: franja superior, encabezado, contenido y pie de página
export default function SitioPublico({ children }) {
  const [abierto, setAbierto] = useState(false);
  const [ingresando, setIngresando] = useState(false);
  const { pathname } = useLocation();
  const { usuario } = useSesion();
  const { cuenta } = useCuenta();
  const CONTACTO = useContacto();
  useDesplazarAAncla();

  // Al bajar por la página el encabezado fijo muestra una sombra para separarse del contenido
  const [bajo, setBajo] = useState(false);
  useEffect(() => {
    const revisar = () => setBajo(window.scrollY > 40);
    revisar();
    window.addEventListener('scroll', revisar, { passive: true });
    return () => window.removeEventListener('scroll', revisar);
  }, []);

  // El menú del celular se cierra al cambiar de página
  useEffect(() => setAbierto(false), [pathname]);

  // Con sesión abierta, el botón lleva a la cuenta del paciente o al panel; sin sesión, abre el ingreso
  const claseAcceso = 'flex items-center justify-center gap-1.5 text-marca-azul hover:underline font-bold px-2 py-2 whitespace-nowrap cursor-pointer';
  const accesoPanel = cuenta ? (
    <Link to="/mi-cuenta" className={claseAcceso}>
      <UserRound className="w-5 h-5" /> Mi cuenta
    </Link>
  ) : usuario ? (
    <Link to="/farmacia" className={claseAcceso}>
      <LayoutDashboard className="w-5 h-5" /> Ir al panel
    </Link>
  ) : (
    <button type="button" onClick={() => { setAbierto(false); setIngresando(true); }}
      className={claseAcceso}>
      <LogIn className="w-5 h-5" /> Iniciar sesión
    </button>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Franja superior */}
      <div className="bg-marca-verde-oscuro text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <div className="hidden md:flex items-center gap-5">
            <a href={`tel:${(CONTACTO.telefono ?? '').replace(/\D/g, '')}`} className="flex items-center gap-1.5 hover:underline">
              <Phone className="w-4 h-4" /> Línea de atención {CONTACTO.telefono}
            </a>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {CONTACTO.horario}</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <Link to="/informacion#pqrs" className="hover:underline">PQRS</Link>
            <span className="opacity-40" aria-hidden="true">|</span>
            <Link to="/farmacia" className="hover:underline">Acceso empleados</Link>
          </div>
        </div>
      </div>

      {/* Encabezado */}
      <header className={`border-b-4 border-marca-azul sticky top-0 bg-white z-40 transition-shadow duration-300 ${bajo ? 'shadow-lg' : ''}`}>
        {/* Una sola fila: logo a la izquierda, menú en el centro (computador) y botones a la derecha */}
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-6">
          <Logo subtitulo="Tu farmacia conectada" />
          <nav className="hidden xl:flex items-center" aria-label="Menú principal">
            {MENU.map(({ a, texto, fin, ancla }) =>
              ancla ? (
                <Link key={a} to={a} className={claseMenu(false)}>{texto}</Link>
              ) : (
                <NavLink key={a} to={a} end={fin} className={({ isActive }) => claseMenu(isActive)}>{texto}</NavLink>
              )
            )}
          </nav>
          <div className="flex items-center justify-end gap-2">
            <div className="hidden sm:block">{accesoPanel}</div>
            <Link to="/paciente" className="hidden sm:block whitespace-nowrap bg-marca-azul hover:bg-marca-azul-oscuro text-white font-bold px-5 py-2.5 rounded transition">
              Pedir turno
            </Link>
            <button type="button" onClick={() => setAbierto((v) => !v)}
              aria-expanded={abierto} aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
              className="xl:hidden p-2 rounded text-marca-noche hover:bg-slate-100 cursor-pointer">
              {abierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {abierto && (
          <nav className="xl:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1" aria-label="Menú principal">
            {MENU.map(({ a, texto }) => (
              <Link key={a} to={a} onClick={() => setAbierto(false)}
                className="block px-3 py-2.5 rounded font-semibold text-slate-800 hover:bg-marca-hielo">
                {texto}
              </Link>
            ))}
            <Link to="/paciente" className="block text-center bg-marca-azul text-white font-bold px-5 py-3 rounded mt-2">
              Pedir turno
            </Link>
            <div className="sm:hidden mt-2 border-2 border-marca-azul rounded">{accesoPanel}</div>
          </nav>
        )}
      </header>

      <main className="flex-1 overflow-x-clip">
        <ContextoIngreso.Provider value={() => setIngresando(true)}>{children}</ContextoIngreso.Provider>
      </main>

      {ingresando && <VentanaIngreso alCerrar={() => setIngresando(false)} />}
      <ChatBot />

      {/* Pie de página */}
      <footer id="contacto" className="bg-marca-noche text-blue-100 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="space-y-3">
            <Logo claro />
            <p className="text-blue-200">Tu fórmula de la IPS, directo a la farmacia.</p>
          </div>
          <PieColumna titulo="Pacientes" enlaces={[
            ['/paciente', 'Consultar mi fórmula'],
            ['/paciente', 'Pedir turno virtual'],
            ['/#domicilio', 'Medicamentos a domicilio'],
            ['/informacion#cuotas', 'Cuotas moderadoras'],
            ['/salud-al-dia', 'Salud al día'],
          ]} />
          <PieColumna titulo="Institucional" enlaces={[
            ['/#quienes-somos', 'Quiénes somos'],
            ['/informacion#datos', 'Tratamiento de datos'],
            ['/informacion#derechos', 'Derechos y deberes'],
            ['/informacion#pqrs', 'PQRS'],
          ]} />
          <div>
            <h2 className="font-bold text-white mb-3">Contacto</h2>
            <ul className="space-y-2 text-blue-200">
              <li className="flex gap-2"><Phone className="w-4 h-4 mt-0.5 shrink-0" /> {CONTACTO.telefono}</li>
              <li className="flex gap-2"><Mail className="w-4 h-4 mt-0.5 shrink-0" /> {CONTACTO.correo}</li>
              <li className="flex gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {CONTACTO.direccion}</li>
              <li className="flex gap-2"><Clock className="w-4 h-4 mt-0.5 shrink-0" /> {CONTACTO.horario}</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-white/10">
          <span className="block max-w-7xl mx-auto px-4 py-4 text-xs text-blue-300">
            © {new Date().getFullYear()} Mediconnect. Tus datos de salud se usan solo para gestionar tu fórmula y tu turno.
          </span>
        </p>
      </footer>
    </div>
  );
}

function PieColumna({ titulo, enlaces }) {
  return (
    <div>
      <h2 className="font-bold text-white mb-3">{titulo}</h2>
      <ul className="space-y-2">
        {enlaces.map(([a, texto]) => (
          <li key={texto}><Link to={a} className="hover:text-white">{texto}</Link></li>
        ))}
      </ul>
    </div>
  );
}

// Franja de título de cada página interna (con miga de pan)
export function TituloPagina({ titulo, descripcion, miga }) {
  return (
    <section className="bg-marca-hielo border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-sm text-slate-600 mb-1">
          <Link to="/" className="hover:text-marca-azul">Inicio</Link>
          {miga && <> <span aria-hidden="true">›</span> <Link to={miga.a} className="hover:text-marca-azul">{miga.texto}</Link></>}
          {' '}<span aria-hidden="true">›</span> {titulo}
        </p>
        <h1 className="font-titulo text-3xl font-extrabold text-marca-noche">{titulo}</h1>
        {descripcion && <p className="text-slate-700 mt-1 max-w-3xl">{descripcion}</p>}
      </div>
    </section>
  );
}
