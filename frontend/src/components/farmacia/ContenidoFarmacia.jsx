import React, { useState } from 'react';
import { BookOpen, Bot, FileText, Images, LayoutTemplate, MapPin } from 'lucide-react';
import CarruselAdmin from './contenido/CarruselAdmin';
import ArticulosAdmin from './contenido/ArticulosAdmin';
import InformacionAdmin from './contenido/InformacionAdmin';
import ContactoAdmin from './contenido/ContactoAdmin';
import BotAdmin from './contenido/BotAdmin';

const PESTANAS = [
  ['carrusel', 'Carrusel', Images, CarruselAdmin],
  ['articulos', 'Salud al día', BookOpen, ArticulosAdmin],
  ['informacion', 'Información al paciente', FileText, InformacionAdmin],
  ['contacto', 'Contacto y ubicación', MapPin, ContactoAdmin],
  ['bot', 'Mediconnect Bot', Bot, BotAdmin],
];

// Contenido del sitio público (solo administradores)
export default function ContenidoFarmacia() {
  const [pestana, setPestana] = useState('carrusel');
  const Componente = PESTANAS.find(([id]) => id === pestana)[3];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <LayoutTemplate className="w-6 h-6 text-slate-600" /> Contenido del sitio
        </h2>
        <a href="/" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-700 hover:underline">
          Ver el sitio ↗
        </a>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {PESTANAS.map(([id, texto, Icono]) => (
          <button key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold cursor-pointer ${
              pestana === id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            <Icono className="w-4 h-4" /> {texto}
          </button>
        ))}
      </div>
      <Componente key={pestana} />
    </div>
  );
}
