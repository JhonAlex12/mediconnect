import React, { useEffect } from 'react';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import PanelFarmacia from './components/farmacia/PanelFarmacia';
import VistaPaciente from './components/paciente/VistaPaciente';
import PantallaPublica from './components/pantalla/PantallaPublica';
import { SesionProvider } from './lib/sesion';
import Inicio from './paginas/Inicio';
import NoEncontrada from './paginas/NoEncontrada';
import Informacion from './paginas/Informacion';
import SaludAlDia from './paginas/SaludAlDia';

// Cada módulo es una página independiente con su propia dirección
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/paciente" element={<PaginaPaciente />} />
      <Route
        path="/farmacia/*"
        element={
          <SesionProvider>
            <PanelFarmacia />
          </SesionProvider>
        }
      />
      <Route path="/pantalla" element={<PantallaPublica />} />
      <Route path="/informacion" element={<Informacion />} />
      <Route path="/salud-al-dia" element={<SaludAlDia />} />
      <Route path="/salud-al-dia/:slug" element={<SaludAlDia />} />
      {/* El sistema de la IPS es otra aplicación (ips/index.html): no se enlaza desde el sitio */}
      <Route path="/ips" element={<IrA destino="/ips/" />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}

// /paciente?codigo=F-2026-0001&documento=1090123456 llena el formulario
function PaginaPaciente() {
  const [params] = useSearchParams();
  const codigo = params.get('codigo') ?? '';
  const documento = params.get('documento') ?? '';
  return <VistaPaciente key={`${codigo}|${documento}`} codigoInicial={codigo} documentoInicial={documento} />;
}

// Carga completa del navegador hacia otra aplicación
function IrA({ destino }) {
  useEffect(() => {
    window.location.replace(destino);
  }, [destino]);
  return null;
}
