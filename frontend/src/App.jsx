import React, { useState } from 'react';
import { Stethoscope, Smartphone, Building2, MonitorPlay } from 'lucide-react';
import SimuladorIPS from './components/SimuladorIPS';
import PanelFarmacia from './components/farmacia/PanelFarmacia';
import VistaPaciente from './components/paciente/VistaPaciente';
import PantallaPublica from './components/pantalla/PantallaPublica';
import { SesionProvider } from './lib/sesion';

export default function App() {
  const [moduloActivo, setModuloActivo] = useState('ips');
  const [datosFormulaPaciente, setDatosFormulaPaciente] = useState({
    codigo: 'F-2026-0001',
    documento: '1090123456'
  });

  const irAPacienteConFormula = (codigo, documento) => {
    setDatosFormulaPaciente({ codigo, documento });
    setModuloActivo('paciente');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Barra superior de navegación entre los 4 módulos de la Figura 6 */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-900 text-lg">
              M
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Mediconect</h1>
              <p className="text-xs text-slate-400">
                Control de farmacia conectada a una IPS (Simulación)
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            <button
              onClick={() => setModuloActivo('ips')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                moduloActivo === 'ips'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              1. Simulador IPS (Doctor)
            </button>

            <button
              onClick={() => setModuloActivo('paciente')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                moduloActivo === 'paciente'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              2. Vista del Paciente (Móvil)
            </button>

            <button
              onClick={() => setModuloActivo('farmacia')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                moduloActivo === 'farmacia'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              3. Panel de la Farmacia
            </button>

            <button
              onClick={() => setModuloActivo('pantalla')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                moduloActivo === 'pantalla'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <MonitorPlay className="w-4 h-4" />
              4. Pantalla Pública
            </button>
          </nav>
        </div>
      </header>

      {/* Contenido del módulo activo */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {moduloActivo === 'ips' && (
          <SimuladorIPS onIrAPaciente={irAPacienteConFormula} />
        )}

        {moduloActivo === 'farmacia' && (
          <SesionProvider>
            <PanelFarmacia />
          </SesionProvider>
        )}

        {moduloActivo === 'paciente' && (
          <VistaPaciente
            key={`${datosFormulaPaciente.codigo}|${datosFormulaPaciente.documento}`}
            codigoInicial={datosFormulaPaciente.codigo}
            documentoInicial={datosFormulaPaciente.documento}
          />
        )}

        {moduloActivo === 'pantalla' && <PantallaPublica />}
      </main>
    </div>
  );
}
