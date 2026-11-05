import React, { useState } from 'react';
import { Stethoscope, Smartphone, Building2, MonitorPlay } from 'lucide-react';
import SimuladorIPS from './components/SimuladorIPS';
import PanelFarmacia from './components/farmacia/PanelFarmacia';
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

        {(moduloActivo === 'paciente' || moduloActivo === 'pantalla') && (
          <div className="max-w-xl mx-auto bg-white rounded-xl shadow border border-slate-300 p-8 text-center space-y-3">
            <h2 className="text-xl font-bold text-slate-800">
              Módulo en construcción para el siguiente paso
            </h2>
            <p className="text-slate-600">
              Seleccionaste la pestaña <strong>{moduloActivo}</strong>. Una vez probemos el{' '}
              <strong>Paso 2 (Simulador de IPS - Doctor)</strong>, activaremos esta vista en el{' '}
              <strong>Paso 3</strong>.
            </p>
            {datosFormulaPaciente.codigo && (
              <p className="text-sm bg-slate-100 p-3 rounded-lg font-mono text-slate-700">
                Fórmula lista para consultar: {datosFormulaPaciente.codigo} | Doc:{' '}
                {datosFormulaPaciente.documento}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
