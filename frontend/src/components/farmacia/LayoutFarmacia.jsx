import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from '../Encabezado';
import { Boton, ICONO_SM, ICONO_MD } from '../ui';

const ROLES = { auxiliar: 'Auxiliar', administrador: 'Administrador' };

// Estructura del panel: barra lateral fija en computador, menú desplegable en celular.
// "secciones": [{ ruta, texto, icono }] — las mismas rutas de siempre.
export default function LayoutFarmacia({ usuario, secciones, alSalir, children }) {
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  // Al cambiar de sección en el celular, se cierra el menú
  useEffect(() => setAbierto(false), [pathname]);

  const navegacion = (
    <nav aria-label="Secciones de la farmacia" className="flex-1 px-3 py-4">
      <ul className="space-y-0.5">
        {secciones.map(({ ruta, texto, icono: Icono }) => (
          <li key={ruta}>
            <NavLink
              to={ruta}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 h-10 rounded-md text-base transition-colors ${
                  isActive
                    ? 'bg-primario-50 text-primario-800 font-bold'
                    : 'text-tinta-suave hover:bg-hundido hover:text-tinta'
                }`
              }
            >
              <Icono size={ICONO_MD} aria-hidden="true" />
              {texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  const sesion = (
    <div className="border-t border-borde px-4 py-4 space-y-3">
      <div className="leading-tight">
        <p className="font-bold text-tinta truncate">{usuario.nombre}</p>
        <p className="text-sm text-tinta-suave">{ROLES[usuario.rol] ?? usuario.rol}</p>
      </div>
      <Boton variante="secundario" tamano="sm" icono={LogOut} onClick={alSalir} ancho>
        Cerrar sesión
      </Boton>
    </div>
  );

  return (
    <div className="min-h-screen bg-fondo lg:flex">
      {/* Barra lateral (computador) */}
      <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 bg-superficie border-r border-borde-fuerte sticky top-0 h-screen">
        <div className="px-4 h-16 flex items-center border-b border-borde">
          <Logo subtitulo="Farmacia" />
        </div>
        {navegacion}
        {sesion}
      </aside>

      {/* Barra superior (celular y tableta) */}
      <header className="lg:hidden bg-superficie border-b border-borde-fuerte sticky top-0 z-30">
        <div className="px-4 h-14 flex items-center justify-between">
          <Logo subtitulo="Farmacia" />
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-controls="menu-farmacia"
            className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-borde-campo text-tinta font-bold text-sm cursor-pointer"
          >
            {abierto ? <X size={ICONO_SM} aria-hidden="true" /> : <Menu size={ICONO_SM} aria-hidden="true" />}
            Menú
          </button>
        </div>
        {abierto && (
          <div id="menu-farmacia" className="border-t border-borde bg-superficie">
            {navegacion}
            {sesion}
          </div>
        )}
      </header>

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}

// Página sin navegación (verificando sesión, login)
export function PaginaSimple({ children }) {
  return (
    <div className="min-h-screen bg-fondo flex flex-col">
      <header className="bg-superficie border-b border-borde-fuerte">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center">
          <Logo subtitulo="Farmacia" />
        </div>
      </header>
      <main className="flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
