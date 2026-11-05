import React from 'react';
import { Link } from 'react-router-dom';
import Encabezado, { useTitulo } from '../components/Encabezado';

export default function NoEncontrada() {
  useTitulo('Página no encontrada');
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Encabezado />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-6xl font-black text-slate-300">404</p>
        <h1 className="text-2xl font-bold text-slate-800">Esta página no existe</h1>
        <Link to="/" className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-lg">
          Ir al inicio
        </Link>
      </main>
    </div>
  );
}
