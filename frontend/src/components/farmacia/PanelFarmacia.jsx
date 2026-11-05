import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { BarChart3, ListOrdered, LogOut, Package, UserCircle2, Users } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { TiempoRealProvider } from '../../lib/tiempoReal';
import Encabezado, { useTitulo } from '../Encabezado';
import LoginEmpleado from './LoginEmpleado';
import FilaFarmacia from './FilaFarmacia';
import InventarioFarmacia from './InventarioFarmacia';
import ReportesFarmacia from './ReportesFarmacia';
import UsuariosFarmacia from './UsuariosFarmacia';

const ROLES = { auxiliar: 'Auxiliar', administrador: 'Administrador' };

// Cada sección es una página: /farmacia/fila, /farmacia/inventario...
const SECCIONES = [
  { ruta: 'fila', texto: 'Fila', icono: ListOrdered, componente: FilaFarmacia },
  { ruta: 'inventario', texto: 'Inventario', icono: Package, componente: InventarioFarmacia },
  // Reportes y usuarios: solo administradores (el backend también lo exige)
  { ruta: 'reportes', texto: 'Reportes', icono: BarChart3, componente: ReportesFarmacia, soloAdmin: true },
  { ruta: 'usuarios', texto: 'Usuarios', icono: Users, componente: UsuariosFarmacia, soloAdmin: true },
];

function Seccion({ titulo, componente: Componente }) {
  useTitulo(`${titulo} · Farmacia`);
  return <Componente />;
}

export default function PanelFarmacia() {
  const { usuario, verificando, cerrarSesion } = useSesion();
  useTitulo('Farmacia');

  if (verificando) {
    return (
      <Pagina>
        <p className="text-center text-slate-500 py-12">Verificando la sesión…</p>
      </Pagina>
    );
  }
  if (!usuario) {
    return (
      <Pagina>
        <LoginEmpleado />
      </Pagina>
    );
  }

  const permitidas = SECCIONES.filter((s) => !s.soloAdmin || usuario.rol === 'administrador');

  return (
    <TiempoRealProvider>
      <Pagina
        derecha={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <UserCircle2 className="w-7 h-7 text-slate-400" />
              <div className="leading-tight">
                <p className="font-semibold text-sm">{usuario.nombre}</p>
                <p className="text-xs text-slate-400">{ROLES[usuario.rol] ?? usuario.rol}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              className="flex items-center gap-2 text-sm font-semibold bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        }
        menu={
          <nav className="bg-white border-b border-slate-300" aria-label="Secciones de la farmacia">
            <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
              {permitidas.map(({ ruta, texto, icono: Icono }) => (
                <NavLink
                  key={ruta}
                  to={ruta}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                      isActive
                        ? 'border-emerald-600 text-slate-900'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`
                  }
                >
                  <Icono className="w-4 h-4" />
                  {texto}
                </NavLink>
              ))}
            </div>
          </nav>
        }
      >
        <Routes>
          <Route index element={<Navigate to="fila" replace />} />
          {permitidas.map((s) => (
            <Route key={s.ruta} path={s.ruta} element={<Seccion titulo={s.texto} componente={s.componente} />} />
          ))}
          {/* Sección inexistente o sin permiso: a la fila */}
          <Route path="*" element={<Navigate to="fila" replace />} />
        </Routes>
      </Pagina>
    </TiempoRealProvider>
  );
}

function Pagina({ derecha, menu, children }) {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Encabezado seccion="Panel de la farmacia">{derecha}</Encabezado>
      {menu}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
