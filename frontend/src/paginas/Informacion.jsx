import React, { useEffect, useState } from 'react';
import SitioPublico, { TituloPagina } from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import TextoEnriquecido from '../components/TextoEnriquecido';
import { api } from '../lib/api';
import { useContenido } from '../lib/contenido';

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

// Las secciones se escriben en el panel (Contenido del sitio → Información al paciente)
export default function Informacion() {
  useTitulo('Información al paciente');
  const { secciones, contacto } = useContenido();
  const [tarifa, setTarifa] = useState(null);

  // Valores vigentes de la cuota moderadora (los configura el administrador en Tarifas)
  useEffect(() => {
    api('/tarifas/vigentes', { token: null }).then((r) => setTarifa(r.tarifa)).catch(() => {});
  }, []);

  // Al llegar con un ancla (/informacion#cuotas), bajar cuando ya estén las secciones
  useEffect(() => {
    if (!secciones || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, [secciones]);

  const especiales = { tabla_cuotas: <TablaCuotas tarifa={tarifa} /> };

  return (
    <SitioPublico>
      <TituloPagina titulo="Información al paciente"
        descripcion="Lo que necesitas saber para reclamar tus medicamentos en la farmacia." />

      {secciones === null ? (
        <p className="text-center text-slate-500 py-16">Cargando…</p>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-[16rem_1fr] gap-12">
          <nav aria-label="Contenido de la página" className="lg:sticky lg:top-28 self-start">
            <p className="font-bold text-marca-noche mb-2">En esta página</p>
            <ul className="border-l-2 border-slate-200 text-sm">
              {secciones.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.ancla}`} className="block pl-4 py-1.5 -ml-0.5 border-l-2 border-transparent text-slate-600 hover:text-marca-azul hover:border-marca-azul">
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="max-w-3xl space-y-14">
            {secciones.map((s) => (
              <section key={s.id} id={s.ancla} className="scroll-mt-28 space-y-4">
                <h2 className="font-titulo text-2xl font-extrabold text-marca-noche">{s.titulo}</h2>
                <TextoEnriquecido texto={s.contenido} datos={contacto} especiales={especiales} />
              </section>
            ))}
          </div>
        </div>
      )}
    </SitioPublico>
  );
}

// {tabla_cuotas}: valores vigentes por rango de ingreso
export function TablaCuotas({ tarifa }) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg text-base">
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-4 py-2 font-semibold">Ingreso base de cotización</th>
            <th className="px-4 py-2 font-semibold text-right">Cuota {tarifa ? tarifa.anio : ''}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {[['A', 'Menos de 2 salarios mínimos'], ['B', 'Entre 2 y 5 salarios mínimos'], ['C', 'Más de 5 salarios mínimos']].map(([r, t]) => (
            <tr key={r}>
              <td className="px-4 py-2.5">{t}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-marca-noche tabular-nums">{tarifa ? pesos(tarifa[r]) : '…'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
