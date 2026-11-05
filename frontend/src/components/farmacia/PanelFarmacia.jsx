import React, { useState } from 'react';
import { BarChart3, ListOrdered, LogOut, Package, UserCircle2, Users } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { TiempoRealProvider } from '../../lib/tiempoReal';
import LoginEmpleado from './LoginEmpleado';
import FilaFarmacia from './FilaFarmacia';
import InventarioFarmacia from './InventarioFarmacia';
import ReportesFarmacia from './ReportesFarmacia';
import UsuariosFarmacia from './UsuariosFarmacia';

const ROLES = { auxiliar: 'Auxiliar', administrador: 'Administrador' };

const SECCIONES = [
  { id: 'fila', texto: 'Fila', icono: ListOrdered, componente: FilaFarmacia },
  { id: 'inventario', texto: 'Inventario', icono: Package, componente: InventarioFarmacia },
  // Reportes y usuarios: solo administradores (el backend también lo exige)
  { id: 'reportes', texto: 'Reportes', icono: BarChart3, componente: ReportesFarmacia, soloAdmin: true },
  { id: 'usuarios', texto: 'Usuarios', icono: Users, componente: UsuariosFarmacia, soloAdmin: true },
];

const CLAVE_SECCION = 'mediconect_seccion_farmacia';

function leerSeccion() {
  try {
    return localStorage.getItem(CLAVE_SECCION) ?? 'fila';
  } catch {
    return 'fila';
  }
}

export default function PanelFarmacia() {
  const { usuario, verificando, cerrarSesion } = useSesion();
  const [seccion, setSeccion] = useState(leerSeccion);

  if (verificando) {
    return <p className="text-center text-slate-500 py-12">Verificando la sesión…</p>;
  }
  if (!usuario) return <LoginEmpleado />;

  const cambiarSeccion = (id) => {
    setSeccion(id);
    try {
      localStorage.setItem(CLAVE_SECCION, id);
    } catch {
      // Sin almacenamiento: se recuerda solo mientras la página esté abierta
    }
  };

  const permitidas = SECCIONES.filter((s) => !s.soloAdmin || usuario.rol === 'administrador');
  // Si la sección recordada no existe o no le corresponde a este rol, se abre la fila
  const actual = permitidas.find((s) => s.id === seccion) ?? permitidas[0];
  const Activa = actual.componente;

  return (
    <TiempoRealProvider>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-300 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <UserCircle2 className="w-8 h-8 text-slate-500" />
            <div>
              <p className="font-bold text-slate-800">{usuario.nombre}</p>
              <p className="text-sm text-slate-500">{ROLES[usuario.rol] ?? usuario.rol}</p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg" aria-label="Secciones de la farmacia">
            {permitidas.map(({ id, texto, icono: Icono }) => (
              <button
                key={id}
                type="button"
                onClick={() => cambiarSeccion(id)}
                aria-current={actual.id === id ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${
                  actual.id === id ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icono className="w-4 h-4" />
                {texto}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={cerrarSesion}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>

        <Activa />
      </div>
    </TiempoRealProvider>
  );
}
