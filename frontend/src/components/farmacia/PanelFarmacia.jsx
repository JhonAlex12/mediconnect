import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { BarChart3, Bike, LayoutTemplate, ListOrdered, LogOut, MonitorPlay, Package, UserCircle2, Users, Wallet } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { TiempoRealProvider } from '../../lib/tiempoReal';
import Encabezado, { useTitulo } from '../Encabezado';
import LoginEmpleado from './LoginEmpleado';
import FilaFarmacia from './FilaFarmacia';
import InventarioFarmacia from './InventarioFarmacia';
import ReportesFarmacia from './ReportesFarmacia';
import UsuariosFarmacia from './UsuariosFarmacia';
import TarifasFarmacia from './TarifasFarmacia';
import DomiciliosFarmacia from './DomiciliosFarmacia';
import ContenidoFarmacia from './ContenidoFarmacia';

const ROLES = { auxiliar: 'Auxiliar', domicilios: 'Pedidos y domicilios', administrador: 'Administrador' };

// Cada sección es una página: /farmacia/fila, /farmacia/inventario...
// "roles": quién la ve (si no se indica, administradores y auxiliares). El backend también lo exige.
const SECCIONES = [
  { ruta: 'fila', texto: 'Fila', icono: ListOrdered, componente: FilaFarmacia },
  { ruta: 'inventario', texto: 'Inventario', icono: Package, componente: InventarioFarmacia },
  { ruta: 'domicilios', texto: 'Domicilios', icono: Bike, componente: DomiciliosFarmacia, roles: ['administrador', 'auxiliar', 'domicilios'] },
  // Reportes y usuarios: solo administradores (el backend también lo exige)
  { ruta: 'reportes', texto: 'Reportes', icono: BarChart3, componente: ReportesFarmacia, soloAdmin: true },
  { ruta: 'usuarios', texto: 'Usuarios', icono: Users, componente: UsuariosFarmacia, soloAdmin: true },
  { ruta: 'tarifas', texto: 'Tarifas', icono: Wallet, componente: TarifasFarmacia, soloAdmin: true },
  { ruta: 'contenido', texto: 'Contenido del sitio', icono: LayoutTemplate, componente: ContenidoFarmacia, soloAdmin: true },
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

  const permitidas = SECCIONES.filter((s) =>
    s.soloAdmin ? usuario.rol === 'administrador' : (s.roles ?? ['administrador', 'auxiliar']).includes(usuario.rol));
  const inicio = permitidas[0]?.ruta ?? 'fila';
  const atiendeFila = usuario.rol !== 'domicilios';

  return (
    <TiempoRealProvider>
      <Pagina
        derecha={
          <div className="flex items-center gap-4">
            {/* La pantalla de la sala se abre en otra pestaña o ventana (para el televisor) con esta misma sesión */}
            {atiendeFila && (
            <button
              type="button"
              onClick={() => window.open('/pantalla', 'pantalla-sala')}
              className="flex items-center gap-2 text-sm font-semibold bg-marca-verde hover:bg-marca-verde-oscuro px-3 py-2 rounded-lg transition cursor-pointer"
            >
              <MonitorPlay className="w-4 h-4" />
              Pantalla de la sala
            </button>
            )}
            <div className="flex items-center gap-2">
              <UserCircle2 className="w-7 h-7 text-slate-400" />
              <div className="leading-tight">
                <p className="font-semibold text-sm">{usuario.nombre}</p>
                <p className="text-xs text-slate-400">
                  {ROLES[usuario.rol] ?? usuario.rol}
                  {usuario.caja ? ` · ${usuario.caja === 6 ? 'Caja 6 preferencial' : `Caja ${usuario.caja}`}` : ''}
                </p>
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
                        ? 'border-marca-verde text-slate-900'
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
          <Route index element={<Navigate to={inicio} replace />} />
          {permitidas.map((s) => (
            <Route key={s.ruta} path={s.ruta} element={<Seccion titulo={s.texto} componente={s.componente} />} />
          ))}
          {/* Sección inexistente o sin permiso: a la primera permitida */}
          <Route path="*" element={<Navigate to={inicio} replace />} />
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
