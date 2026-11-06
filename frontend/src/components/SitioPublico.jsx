import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Building2, ChevronRight, Menu, X } from 'lucide-react';
import { Logo } from './Encabezado';

const MENU = [
  { a: '/', texto: 'Inicio' },
  { a: '/#servicios', texto: 'Servicios' },
  { a: '/#como-funciona', texto: 'Cómo funciona' },
  { a: '/#preguntas', texto: 'Preguntas frecuentes' },
];

// Estructura de las páginas públicas: franja superior, menú, contenido y pie de página
export default function SitioPublico({ children }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Franja superior */}
      <div className="bg-blue-950 text-blue-100 text-sm">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-4">
          <p className="truncate">Tu fórmula de la IPS, directo a la farmacia</p>
          <Link to="/farmacia" className="flex items-center gap-1.5 hover:text-white shrink-0">
            <Building2 className="w-4 h-4" />
            Acceso empleados
          </Link>
        </div>
      </div>

      {/* Menú principal */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-6">
          <Logo subtitulo="Tu farmacia conectada" />

          <nav className="hidden lg:flex items-center gap-1" aria-label="Menú principal">
            {MENU.map(({ a, texto }) => (
              <a key={a} href={a}
                className="px-3 py-2 rounded-lg text-slate-700 font-semibold hover:text-blue-900 hover:bg-blue-50 transition">
                {texto}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NavLink to="/paciente"
              className="hidden sm:inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-full shadow-sm transition">
              Pide tu turno
              <ChevronRight className="w-4 h-4" />
            </NavLink>
            <button type="button" onClick={() => setAbierto((v) => !v)}
              aria-expanded={abierto} aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
              className="lg:hidden p-2 rounded-lg text-blue-950 hover:bg-slate-100 cursor-pointer">
              {abierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {abierto && (
          <nav className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1" aria-label="Menú principal">
            {MENU.map(({ a, texto }) => (
              <a key={a} href={a} onClick={() => setAbierto(false)}
                className="block px-3 py-2.5 rounded-lg text-slate-800 font-semibold hover:bg-blue-50">
                {texto}
              </a>
            ))}
            <Link to="/paciente" onClick={() => setAbierto(false)}
              className="block text-center bg-emerald-500 text-white font-bold px-5 py-3 rounded-full mt-2">
              Pide tu turno
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Pie de página */}
      <footer className="bg-blue-950 text-blue-100">
        <div className="max-w-7xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <Logo claro />
            <p className="text-sm text-blue-200 max-w-xs">
              Conectamos la fórmula de tu IPS con la farmacia para que sepas qué hay disponible
              y reclames tus medicamentos sin hacer fila.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-white mb-3">Pacientes</h2>
            <ul className="space-y-2 text-sm">
              <li><Link to="/paciente" className="hover:text-white">Consultar mi fórmula</Link></li>
              <li><Link to="/paciente" className="hover:text-white">Pedir turno virtual</Link></li>
              <li><a href="/#preguntas" className="hover:text-white">Preguntas frecuentes</a></li>
            </ul>
          </div>
          <div>
            <h2 className="font-bold text-white mb-3">Farmacia</h2>
            <ul className="space-y-2 text-sm">
              <li><Link to="/farmacia" className="hover:text-white">Acceso empleados</Link></li>
              <li><Link to="/pantalla" className="hover:text-white">Pantalla de la sala de espera</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-blue-900">
          <p className="max-w-7xl mx-auto px-4 py-4 text-xs text-blue-300">
            © {new Date().getFullYear()} Mediconect. Tus datos de salud se usan solo para gestionar tu fórmula y tu turno.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Franja de título de cada página interna del sitio (con miga de pan)
export function TituloPagina({ titulo, descripcion }) {
  return (
    <section className="bg-gradient-to-r from-blue-950 to-blue-800 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-sm text-blue-200 mb-1">
          <Link to="/" className="hover:text-white">Inicio</Link> <span aria-hidden="true">›</span> {titulo}
        </p>
        <h1 className="text-3xl font-black">{titulo}</h1>
        {descripcion && <p className="text-blue-100 mt-1">{descripcion}</p>}
      </div>
    </section>
  );
}
