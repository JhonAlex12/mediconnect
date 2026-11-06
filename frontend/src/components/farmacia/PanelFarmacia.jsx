import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BarChart3, ListOrdered, Package, Users } from 'lucide-react';
import { useSesion } from '../../lib/sesion';
import { TiempoRealProvider } from '../../lib/tiempoReal';
import { useTitulo } from '../Encabezado';
import { Cargando } from '../ui';
import LayoutFarmacia, { PaginaSimple } from './LayoutFarmacia';
import LoginEmpleado from './LoginEmpleado';
import FilaFarmacia from './FilaFarmacia';
import InventarioFarmacia from './InventarioFarmacia';
import ReportesFarmacia from './ReportesFarmacia';
import UsuariosFarmacia from './UsuariosFarmacia';

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
      <PaginaSimple>
        <Cargando texto="Verificando la sesión…" className="justify-center" />
      </PaginaSimple>
    );
  }
  if (!usuario) {
    return (
      <PaginaSimple>
        <LoginEmpleado />
      </PaginaSimple>
    );
  }

  const permitidas = SECCIONES.filter((s) => !s.soloAdmin || usuario.rol === 'administrador');

  return (
    <TiempoRealProvider>
      <LayoutFarmacia usuario={usuario} secciones={permitidas} alSalir={cerrarSesion}>
        <Routes>
          <Route index element={<Navigate to="fila" replace />} />
          {permitidas.map((s) => (
            <Route key={s.ruta} path={s.ruta} element={<Seccion titulo={s.texto} componente={s.componente} />} />
          ))}
          {/* Sección inexistente o sin permiso: a la fila */}
          <Route path="*" element={<Navigate to="fila" replace />} />
        </Routes>
      </LayoutFarmacia>
    </TiempoRealProvider>
  );
}
