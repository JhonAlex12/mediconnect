import React from 'react';
import { LogOut, UserCircle2 } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import LoginEmpleado from './LoginEmpleado';
import FilaFarmacia from './FilaFarmacia';

const ROLES = { auxiliar: 'Auxiliar', administrador: 'Administrador' };

export default function PanelFarmacia() {
  const { usuario, verificando, cerrarSesion } = useSesion();

  if (verificando) {
    return <p className="text-center text-slate-500 py-12">Verificando la sesión…</p>;
  }
  if (!usuario) return <LoginEmpleado />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-300 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <UserCircle2 className="w-8 h-8 text-slate-500" />
          <div>
            <p className="font-bold text-slate-800">{usuario.nombre}</p>
            <p className="text-sm text-slate-500">{ROLES[usuario.rol] ?? usuario.rol}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>

      <FilaFarmacia />
    </div>
  );
}
