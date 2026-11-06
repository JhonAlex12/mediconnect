import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Encabezado';
import { clasesBoton } from './ui';

const MENU = [
  { a: '/#como-funciona', texto: 'Cómo funciona' },
  { a: '/#antes-de-ir', texto: 'Antes de ir' },
  { a: '/#preguntas', texto: 'Preguntas frecuentes' },
];

// Estructura de las páginas públicas: encabezado, contenido y pie de página
export default function SitioPublico({ children }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="min-h-screen bg-fondo flex flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-superficie px-3 py-2 rounded-md">
        Ir al contenido
      </a>

      <header className="bg-superficie border-b border-borde-fuerte sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-6">
          <Logo />

          <nav className="hidden md:flex items-center gap-1" aria-label="Menú principal">
            {MENU.map(({ a, texto }) => (
              <a key={a} href={a} className="px-3 h-10 inline-flex items-center rounded-md text-tinta-suave hover:text-tinta hover:bg-hundido">
                {texto}
              </a>
            ))}
            <Link to="/farmacia" className="px-3 h-10 inline-flex items-center rounded-md text-tinta-suave hover:text-tinta hover:bg-hundido">
              Acceso empleados
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/paciente" className={`${clasesBoton({ variante: 'primario' })} hidden sm:inline-flex`}>
              Mi turno
            </Link>
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              aria-expanded={abierto}
              aria-controls="menu-publico"
              className="md:hidden inline-flex items-center gap-2 h-10 px-3 rounded-md border border-borde-campo text-tinta font-bold text-sm cursor-pointer"
            >
              {abierto ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
              Menú
            </button>
          </div>
        </div>

        {abierto && (
          <nav id="menu-publico" className="md:hidden border-t border-borde px-4 py-3" aria-label="Menú principal">
            <ul className="space-y-1">
              {MENU.map(({ a, texto }) => (
                <li key={a}>
                  <a href={a} onClick={() => setAbierto(false)} className="flex h-11 items-center px-3 rounded-md text-tinta hover:bg-hundido">
                    {texto}
                  </a>
                </li>
              ))}
              <li>
                <Link to="/farmacia" onClick={() => setAbierto(false)} className="flex h-11 items-center px-3 rounded-md text-tinta hover:bg-hundido">
                  Acceso empleados
                </Link>
              </li>
              <li className="pt-2">
                <Link to="/paciente" onClick={() => setAbierto(false)} className={clasesBoton({ variante: 'primario', tamano: 'lg', ancho: true })}>
                  Mi turno
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <main id="contenido" className="flex-1">{children}</main>

      <footer className="bg-superficie border-t border-borde-fuerte">
        <div className="max-w-6xl mx-auto px-4 py-8 grid gap-6 sm:grid-cols-3 text-sm">
          <div className="space-y-2">
            <Logo />
            <p className="text-tinta-suave max-w-xs">
              Consulta de fórmulas y turnos para la farmacia de tu IPS.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-tinta mb-2">Pacientes</h2>
            <ul className="space-y-1.5 text-tinta-suave">
              <li><Link to="/paciente" className="hover:text-tinta underline-offset-2 hover:underline">Consultar mi fórmula</Link></li>
              <li><a href="/#preguntas" className="hover:text-tinta underline-offset-2 hover:underline">Preguntas frecuentes</a></li>
            </ul>
          </div>
          <div>
            <h2 className="font-bold text-tinta mb-2">Farmacia</h2>
            <ul className="space-y-1.5 text-tinta-suave">
              <li><Link to="/farmacia" className="hover:text-tinta underline-offset-2 hover:underline">Acceso empleados</Link></li>
              <li><Link to="/pantalla" className="hover:text-tinta underline-offset-2 hover:underline">Pantalla de la sala de espera</Link></li>
            </ul>
          </div>
        </div>
        <p className="max-w-6xl mx-auto px-4 pb-6 text-xs text-tinta-tenue">
          © {new Date().getFullYear()} Mediconnect. Tus datos de salud se usan solo para gestionar tu fórmula y tu turno.
        </p>
      </footer>
    </div>
  );
}

// Título de cada página del sitio, con miga de pan
export function TituloPagina({ titulo, descripcion }) {
  return (
    <section className="bg-superficie border-b border-borde">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <nav aria-label="Ruta" className="text-sm text-tinta-suave mb-1">
          <Link to="/" className="hover:text-tinta hover:underline underline-offset-2">Inicio</Link>
          <span aria-hidden="true"> › </span>
          <span aria-current="page">{titulo}</span>
        </nav>
        <h1 className="text-3xl font-bold text-tinta">{titulo}</h1>
        {descripcion && <p className="text-tinta-suave mt-1">{descripcion}</p>}
      </div>
    </section>
  );
}
