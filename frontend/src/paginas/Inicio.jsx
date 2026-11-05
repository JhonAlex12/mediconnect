import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, MonitorPlay, Smartphone, Stethoscope } from 'lucide-react';
import Encabezado, { useTitulo } from '../components/Encabezado';

const PAGINAS = [
  {
    ruta: '/paciente',
    icono: Smartphone,
    titulo: 'Soy paciente',
    texto: 'Consulta tu fórmula, pide tu turno virtual y síguelo desde el celular.',
  },
  {
    ruta: '/farmacia',
    icono: Building2,
    titulo: 'Farmacia',
    texto: 'Ingreso de empleados: fila, dispensación, inventario, reportes y usuarios.',
  },
  {
    ruta: '/pantalla',
    icono: MonitorPlay,
    titulo: 'Pantalla de la sala',
    texto: 'Turno que se está llamando y próximos turnos, para el televisor de la sala de espera.',
  },
  {
    ruta: '/ips',
    icono: Stethoscope,
    titulo: 'Simulador de IPS',
    texto: 'El médico emite fórmulas de prueba, como lo haría la IPS real.',
  },
];

export default function Inicio() {
  useTitulo(null);
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Encabezado seccion="Farmacia conectada a la IPS" />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12 space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900">Reclama tus medicamentos sin hacer fila</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Mediconect conecta tu fórmula médica con la farmacia: consultas qué hay disponible,
            pides tu turno desde el celular y llegas justo cuando te van a atender.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {PAGINAS.map(({ ruta, icono: Icono, titulo, texto }) => (
            <Link
              key={ruta}
              to={ruta}
              className="group bg-white rounded-2xl border border-slate-300 p-6 shadow-sm hover:shadow-md hover:border-emerald-500 transition flex gap-4"
            >
              <span className="w-12 h-12 shrink-0 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition">
                <Icono className="w-6 h-6" />
              </span>
              <span>
                <span className="block text-lg font-bold text-slate-900">{titulo}</span>
                <span className="block text-slate-600 mt-1">{texto}</span>
                <span className="block text-sm font-mono text-slate-400 mt-2">{ruta}</span>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
