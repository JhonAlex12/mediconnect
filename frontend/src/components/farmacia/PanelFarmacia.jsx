import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, Bike, Contact, LayoutTemplate, ListOrdered, LogOut, MonitorPlay, Navigation, Package, UserCircle2, Users, Wallet, TabletSmartphone, X } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { VENTANA_PANTALLA } from '../../lib/api';
import { TiempoRealProvider, useSocketEnVivo } from '../../lib/tiempoReal';
import Encabezado, { useTitulo } from '../Encabezado';
import FilaFarmacia from './FilaFarmacia';
import InventarioFarmacia from './InventarioFarmacia';
import ReportesFarmacia from './ReportesFarmacia';
import UsuariosFarmacia from './UsuariosFarmacia';
import TarifasFarmacia from './TarifasFarmacia';
import DomiciliosFarmacia from './DomiciliosFarmacia';
import RutaDomiciliario from './RutaDomiciliario';
import ContenidoFarmacia from './ContenidoFarmacia';
import KioscoAdmin from './KioscoAdmin';
import PacientesFarmacia from './PacientesFarmacia';

const ROLES = { auxiliar: 'Auxiliar', domicilios: 'Pedidos y domicilios', domiciliario: 'Domiciliario', administrador: 'Administrador', medico: 'Médico (sistema IPS)' };

// Cada sección es una página: /farmacia/fila, /farmacia/inventario...
// "roles": quién la ve (si no se indica, administradores y auxiliares). El backend también lo exige.
const SECCIONES = [
  // Fila y domicilios son el trabajo diario de auxiliares y repartidores; el administrador no los ve en su menú
  { ruta: 'fila', texto: 'Fila', icono: ListOrdered, componente: FilaFarmacia, roles: ['auxiliar'] },
  { ruta: 'inventario', texto: 'Inventario', icono: Package, componente: InventarioFarmacia },
  { ruta: 'domicilios', texto: 'Domicilios', icono: Bike, componente: DomiciliosFarmacia, roles: ['domicilios'] },
  // El domiciliario solo ve sus entregas (en el celular)
  { ruta: 'entregas', texto: 'Mis entregas', icono: Navigation, componente: RutaDomiciliario, roles: ['domiciliario'] },
  // Pacientes: el administrador ve la lista; el auxiliar solo busca por documento exacto
  { ruta: 'pacientes', texto: 'Pacientes', icono: Contact, componente: PacientesFarmacia },
  // Reportes y usuarios: solo administradores (el backend también lo exige)
  { ruta: 'reportes', texto: 'Reportes', icono: BarChart3, componente: ReportesFarmacia, soloAdmin: true },
  { ruta: 'usuarios', texto: 'Usuarios', icono: Users, componente: UsuariosFarmacia, soloAdmin: true },
  { ruta: 'tarifas', texto: 'Tarifas', icono: Wallet, componente: TarifasFarmacia, soloAdmin: true },
  { ruta: 'contenido', texto: 'Contenido del sitio', icono: LayoutTemplate, componente: ContenidoFarmacia, soloAdmin: true },
  { ruta: 'pantalla-turnos', texto: 'Pantalla de turnos', icono: TabletSmartphone, componente: KioscoAdmin, soloAdmin: true },
];

function Seccion({ titulo, componente: Componente }) {
  useTitulo(`${titulo} · Farmacia`);
  return <Componente />;
}

export default function PanelFarmacia() {
  const { usuario, verificando, cerrarSesion, salir: cerrarYLiberar } = useSesion();
  const navegar = useNavigate();
  // Al salir se vuelve a la página principal (no al formulario de ingreso) y la cuenta queda libre
  const salir = () => {
    navegar('/', { replace: true });
    cerrarYLiberar();
  };
  useTitulo('Farmacia');

  // Una sesión de médico (sistema de la IPS) no sirve en el panel: se cierra
  useEffect(() => {
    if (usuario?.rol === 'medico') cerrarSesion();
  }, [usuario, cerrarSesion]);

  if (verificando) {
    return (
      <Pagina>
        <p className="text-center text-slate-500 py-12">Verificando la sesión…</p>
      </Pagina>
    );
  }
  // Sin sesión (salió, venció o nunca ingresó) se vuelve a la página principal;
  // los empleados ingresan desde allí con "Iniciar sesión → Soy empleado"
  if (!usuario || usuario.rol === 'medico') return <Navigate to="/" replace />;

  const permitidas = SECCIONES.filter((s) =>
    s.soloAdmin ? usuario.rol === 'administrador' : (s.roles ?? ['administrador', 'auxiliar']).includes(usuario.rol));
  const inicio = permitidas[0]?.ruta ?? 'fila';
  const atiendeFila = ['administrador', 'auxiliar'].includes(usuario.rol);

  return (
    <TiempoRealProvider>
      <Pagina
        derecha={
          <div className="flex items-center gap-4">
            {/* La pantalla de la sala se abre en otra pestaña o ventana (para el televisor) con esta misma sesión */}
            {atiendeFila && (
            <button
              type="button"
              onClick={() => window.open('/pantalla', VENTANA_PANTALLA)}
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
              onClick={salir}
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
        <AvisoIntentoIngreso puedeCambiarClave={usuario.rol === 'administrador'} />
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

// Alguien escribió la contraseña correcta de esta cuenta en otro equipo y no lo dejó entrar
// porque esta sesión está abierta: se avisa aquí para que se cambie la contraseña si no fue uno mismo
function AvisoIntentoIngreso({ puedeCambiarClave }) {
  const socket = useSocketEnVivo();
  const [hora, setHora] = useState(null);
  useEffect(() => {
    if (!socket) return undefined;
    const recibir = (d) => setHora(new Date(d?.hora ?? Date.now()));
    socket.on('intento_ingreso', recibir);
    return () => socket.off('intento_ingreso', recibir);
  }, [socket]);
  if (!hora) return null;
  return (
    <div role="alert" className="mb-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 flex items-start gap-3 text-sm">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="flex-1">
        <strong>A las {hora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })} alguien intentó entrar con tu cuenta
        desde otro equipo</strong> y el sistema no lo dejó, porque tu sesión está abierta aquí. Usó la contraseña correcta:
        si no fuiste tú, otra persona la conoce. {puedeCambiarClave
          ? 'Cámbiala en Usuarios.'
          : 'Pídele al administrador que la cambie.'}
      </p>
      <button type="button" onClick={() => setHora(null)} aria-label="Cerrar aviso"
        className="p-1 rounded hover:bg-amber-100 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
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
