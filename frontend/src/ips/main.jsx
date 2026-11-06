import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClipboardPlus, ShieldCheck } from 'lucide-react';
import FormulaMedica from './FormulaMedica';
import '../index.css';

// Sistema de la IPS (simulado). Es una aplicación aparte de Mediconect:
// el médico emite la fórmula aquí y la información viaja a la farmacia.
function SistemaIps() {
  // Abre Mediconect, en otra pestaña, con la fórmula lista para consultar
  const verEnMediconect = (codigo, documento) =>
    window.open(`/paciente?${new URLSearchParams({ codigo, documento })}`, '_blank', 'noopener');

  return (
    <div className="min-h-screen bg-indigo-50 flex flex-col">
      <header className="bg-white border-b border-indigo-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-indigo-700 text-white flex items-center justify-center">
              <ClipboardPlus className="w-5 h-5" />
            </span>
            <div className="leading-tight">
              <p className="font-black text-indigo-950 text-lg">IPS · Consulta externa</p>
              <p className="text-xs text-slate-500">Sistema de prescripción médica (simulado)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:flex items-center gap-1.5 text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Conectado con la farmacia
            </span>
            <span className="bg-indigo-100 text-indigo-900 font-semibold px-3 py-1.5 rounded-full">Dr(a). Médico de turno</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <FormulaMedica onIrAPaciente={verEnMediconect} />
      </main>

      <footer className="text-center text-xs text-slate-500 py-4">
        Entorno de demostración: reemplaza al sistema real de la IPS, que envía las fórmulas con su clave de acceso.
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SistemaIps />
  </React.StrictMode>
);
