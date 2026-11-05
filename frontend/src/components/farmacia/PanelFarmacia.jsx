import React, { useState } from 'react';
import { ListOrdered, LogOut, Package, UserCircle2 } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { TiempoRealProvider } from '../../lib/tiempoReal';
import LoginEmpleado from './LoginEmpleado';
import FilaFarmacia from './FilaFarmacia';
import InventarioFarmacia from './InventarioFarmacia';

const ROLES = { auxiliar: 'Auxiliar', administrador: 'Administrador' };

const SECCIONES = [
  { id: 'fila', texto: 'Fila', icono: ListOrdered, componente: FilaFarmacia },
  { id: 'inventario', texto: 'Inventario', icono: Package, componente: InventarioFarmacia },
];

const CLAVE_SECCION = 'mediconect_seccion_farmacia';

function leerSeccion() {
  try {
    const guardada = localStorage.getItem(CLAVE_SECCION);
    return SECCIONES.some((s) => s.id === guardada) ? guardada : 'fila';
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

  const Activa = SECCIONES.find((s) => s.id === seccion).componente;

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

          <nav className="flex gap-1 bg-slate-100 p-1 rounded-lg" aria-label="Secciones de la farmacia">
            {SECCIONES.map(({ id, texto, icono: Icono }) => (
              <button
                key={id}
                type="button"
                onClick={() => cambiarSeccion(id)}
                aria-current={seccion === id ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${
                  seccion === id ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
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
