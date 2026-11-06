import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import SitioPublico from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { Boton, Campo, Entrada } from '../components/ui';

const PASOS = [
  { titulo: 'Recibe tu fórmula', texto: 'Tu médico la registra y la IPS la envía a la farmacia. En la fórmula está su código.' },
  { titulo: 'Consulta la disponibilidad', texto: 'Con el código y tu documento ves qué medicamentos hay antes de salir.' },
  { titulo: 'Pide tu turno', texto: 'Tus medicamentos quedan apartados mientras llegas. Avisa cuando vayas en camino.' },
  { titulo: 'Reclama en ventanilla', texto: 'Al llegar presiona “Ya llegué” y espera tu número en la pantalla de la sala.' },
];

// Reglas que el paciente necesita saber (valores de backend/src/config/negocio.js)
const REGLAS = [
  ['Medicamentos apartados', '2 horas desde que pides el turno'],
  ['Si se te hace tarde', '20 minutos más, una sola vez, con “Voy retrasado”'],
  ['Si no te presentas al llamado', 'El turno queda en pausa 30 minutos; después vence'],
  ['Atención preferencial', 'Adultos mayores, embarazadas y personas con discapacidad'],
  ['Recoge otra persona', 'Con su nombre y número de documento'],
];

const PREGUNTAS = [
  {
    p: '¿Dónde encuentro el código de mi fórmula?',
    r: 'Te lo entrega tu médico o la IPS al emitir la fórmula. Tiene la forma F-2026-0001.',
  },
  {
    p: '¿Qué pasa si un medicamento está agotado?',
    r: 'Puedes pedir el turno igual y reclamar lo que haya. Lo que falte queda pendiente en tu fórmula hasta su fecha límite. Si tienes un turno activo y llega el medicamento, te avisamos.',
  },
  {
    p: '¿Qué pasa si no me presento cuando me llaman?',
    r: 'Si no te acercas en unos 4 minutos, tu turno queda en pausa. Tienes 30 minutos para presionar “Ya llegué” y volver a la fila; después el turno vence y los medicamentos apartados se liberan.',
  },
  {
    p: '¿Puede reclamar los medicamentos otra persona?',
    r: 'Sí. En la ventanilla se registran el nombre y el documento de quien recoge.',
  },
];

export default function Inicio() {
  useTitulo(null);
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [documento, setDocumento] = useState('');

  // Los enlaces del menú (/#como-funciona...) bajan hasta la sección
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  // La consulta se hace en /paciente, que ya recibe el código y el documento por la dirección
  const consultar = (e) => {
    e.preventDefault();
    navigate(`/paciente?${new URLSearchParams({ codigo: codigo.trim(), documento: documento.trim() })}`);
  };

  return (
    <SitioPublico>
      {/* Portada: qué es y la consulta, sin rodeos */}
      <section className="bg-superficie border-b border-borde">
        <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14 grid lg:grid-cols-[1fr_24rem] gap-10 items-start">
          <div className="space-y-4 max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-tinta leading-tight">
              Consulta tu fórmula y pide turno en la farmacia
            </h1>
            <p className="text-lg text-tinta-suave">
              Revisa qué medicamentos hay disponibles antes de ir y espera tu turno desde donde estés.
              Te avisamos cuando te llamen a la ventanilla.
            </p>
            <a href="#como-funciona" className="inline-flex items-center gap-1 font-bold text-primario-700 hover:underline underline-offset-2">
              Ver cómo funciona
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </div>

          <form onSubmit={consultar} className="border border-borde-fuerte rounded-md p-5 space-y-4 bg-fondo">
            <h2 className="text-lg font-bold text-tinta">Consulta tu fórmula</h2>
            <Campo id="inicio-codigo" etiqueta="Código de la fórmula" ayuda="Ejemplo: F-2026-0001">
              <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)} required
                className="h-12 text-lg uppercase cifras" autoComplete="off" />
            </Campo>
            <Campo id="inicio-documento" etiqueta="Número de documento">
              <Entrada value={documento} onChange={(e) => setDocumento(e.target.value)} required
                inputMode="numeric" className="h-12 text-lg cifras" autoComplete="off" />
            </Campo>
            <Boton type="submit" variante="primario" tamano="lg" icono={Search} ancho>
              Consultar
            </Boton>
          </form>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-4 py-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-tinta mb-6">Cómo funciona</h2>
        <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map(({ titulo, texto }, i) => (
            <li key={titulo} className="border-t-2 border-primario-600 pt-3">
              <p className="text-sm font-bold text-primario-700 cifras">Paso {i + 1}</p>
              <h3 className="font-bold text-tinta mt-1">{titulo}</h3>
              <p className="text-tinta-suave mt-1">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Reglas clave, en formato de tabla */}
      <section id="antes-de-ir" className="bg-superficie border-y border-borde scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-[16rem_1fr] gap-6">
          <div>
            <h2 className="text-2xl font-bold text-tinta">Antes de ir</h2>
            <p className="text-tinta-suave mt-1">Lo que debes tener en cuenta con tu turno.</p>
          </div>
          <dl className="divide-y divide-borde border-y border-borde">
            {REGLAS.map(([dato, valor]) => (
              <div key={dato} className="grid sm:grid-cols-[16rem_1fr] gap-1 sm:gap-4 py-3">
                <dt className="font-bold text-tinta">{dato}</dt>
                <dd className="text-tinta-suave">{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className="max-w-3xl mx-auto px-4 py-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-tinta mb-4">Preguntas frecuentes</h2>
        <div className="divide-y divide-borde border-y border-borde">
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 py-4 font-bold text-tinta">
                {p}
                <ChevronRight size={20} className="shrink-0 text-tinta-tenue transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <p className="pb-4 text-tinta-suave">{r}</p>
            </details>
          ))}
        </div>
      </section>
    </SitioPublico>
  );
}
