import React from 'react';
import { Link } from 'react-router-dom';
import SitioPublico from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { clasesBoton } from '../components/ui';

export default function NoEncontrada() {
  useTitulo('Página no encontrada');
  return (
    <SitioPublico>
      <div className="max-w-xl mx-auto px-4 py-16 space-y-3">
        <p className="text-sm font-bold text-tinta-suave cifras">Error 404</p>
        <h1 className="text-3xl font-bold text-tinta">Esta página no existe</h1>
        <p className="text-tinta-suave">Revisa la dirección o vuelve al inicio para consultar tu fórmula.</p>
        <div className="pt-2">
          <Link to="/" className={clasesBoton({ variante: 'primario' })}>Ir al inicio</Link>
        </div>
      </div>
    </SitioPublico>
  );
}
