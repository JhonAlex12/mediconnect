import React from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import SimuladorIPS from './components/SimuladorIPS';
import PanelFarmacia from './components/farmacia/PanelFarmacia';
import VistaPaciente from './components/paciente/VistaPaciente';
import PantallaPublica from './components/pantalla/PantallaPublica';
import Encabezado, { useTitulo } from './components/Encabezado';
import { SesionProvider } from './lib/sesion';
import Inicio from './paginas/Inicio';
import NoEncontrada from './paginas/NoEncontrada';

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
      <Route path="/ips" element={<PaginaIps />} />
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

function PaginaIps() {
  useTitulo('Simulador de IPS');
  const navigate = useNavigate();
  const irAPaciente = (codigo, documento) =>
    navigate(`/paciente?${new URLSearchParams({ codigo, documento })}`);
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Encabezado seccion="Simulador de IPS (médico)" />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <SimuladorIPS onIrAPaciente={irAPaciente} />
      </main>
    </div>
  );
}
