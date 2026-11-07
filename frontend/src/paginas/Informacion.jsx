import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SitioPublico, { CONTACTO, TituloPagina } from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { api } from '../lib/api';

const SECCIONES = [
  ['requisitos', 'Requisitos para reclamar'],
  ['cuotas', 'Cuotas moderadoras y exenciones'],
  ['pendientes', 'Entregas pendientes'],
  ['preferencial', 'Atención preferencial'],
  ['derechos', 'Derechos y deberes del paciente'],
  ['datos', 'Tratamiento de datos personales'],
  ['pqrs', 'Peticiones, quejas y reclamos (PQRS)'],
];

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

export default function Informacion() {
  useTitulo('Información al paciente');
  const [tarifa, setTarifa] = useState(null);

  // Valores vigentes de la cuota moderadora (los configura el administrador)
  useEffect(() => {
    api('/tarifas/vigentes', { token: null }).then((r) => setTarifa(r.tarifa)).catch(() => {});
  }, []);

  return (
    <SitioPublico>
      <TituloPagina titulo="Información al paciente"
        descripcion="Lo que necesitas saber para reclamar tus medicamentos en la farmacia." />

      <div className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-[16rem_1fr] gap-12">
        {/* Índice */}
        <nav aria-label="Contenido de la página" className="lg:sticky lg:top-28 self-start">
          <p className="font-bold text-marca-noche mb-2">En esta página</p>
          <ul className="border-l-2 border-slate-200 text-sm">
            {SECCIONES.map(([id, texto]) => (
              <li key={id}>
                <a href={`#${id}`} className="block pl-4 py-1.5 -ml-0.5 border-l-2 border-transparent text-slate-600 hover:text-marca-azul hover:border-marca-azul">
                  {texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl space-y-14 text-slate-700 text-lg leading-relaxed">
          <Seccion id="requisitos" titulo="Requisitos para reclamar">
            <Lista items={[
              'Tu documento de identidad.',
              'El código de tu fórmula (tiene la forma F-2026-0001). Te lo entrega el médico o la IPS.',
              'Que la fórmula esté vigente: puedes reclamar hasta la fecha límite que aparece al consultarla.',
              'El valor de la cuota moderadora, si te corresponde pagarla (ver abajo).',
            ]} />
            <p>
              <strong>Si reclama otra persona por ti</strong>, en la ventanilla se registran su nombre y su número de documento.
              Debe llevar el código de tu fórmula y tu número de documento.
            </p>
            <p>
              Con el <strong>turno virtual</strong> tus medicamentos quedan apartados durante 2 horas. Si se te hace tarde,
              puedes pedir 20 minutos más una sola vez con el botón "Voy retrasado".
            </p>
            <Accion a="/paciente">Consultar mi fórmula</Accion>
          </Seccion>

          <Seccion id="cuotas" titulo="Cuotas moderadoras y exenciones">
            <p>
              La cuota moderadora es un valor fijo que pagan los afiliados del <strong>régimen contributivo</strong> al
              reclamar medicamentos ambulatorios. Depende de tu ingreso base de cotización (IBC):
            </p>
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
            <p>
              <strong>Se paga una sola vez por fórmula</strong>, en la ventanilla, en efectivo, transferencia o tarjeta.
              Si vuelves por medicamentos pendientes de la misma fórmula, no pagas de nuevo. Sin el pago no se pueden entregar los medicamentos.
            </p>
            <p><strong>No pagan cuota moderadora:</strong></p>
            <Lista items={[
              'Los afiliados del régimen subsidiado.',
              'Los programas de promoción y prevención.',
              'El control prenatal.',
              'Las enfermedades de alto costo (por ejemplo, cáncer o VIH).',
              'Las urgencias.',
            ]} />
            <p>Al consultar tu fórmula verás el valor exacto que te corresponde, según los datos que envió tu IPS.</p>
          </Seccion>

          <Seccion id="pendientes" titulo="Entregas pendientes">
            <p>
              Si la farmacia no tiene todas las unidades de un medicamento, te entrega lo disponible y
              <strong> lo demás queda pendiente en la misma fórmula</strong>. Puedes reclamarlo hasta la fecha límite.
            </p>
            <p>
              Te avisamos cuando cambie la disponibilidad. Al consultar tu fórmula verás cuánto te falta de cada medicamento,
              y para reclamarlo solo tienes que pedir un nuevo turno.
            </p>
          </Seccion>

          <Seccion id="preferencial" titulo="Atención preferencial">
            <p>Tienen prioridad en la fila:</p>
            <Lista items={['Adultos mayores.', 'Mujeres en embarazo.', 'Personas con discapacidad.']} />
            <p>
              Indícalo al pedir tu turno virtual o al llegar a la farmacia, y tu turno se ubicará antes en la fila.
            </p>
          </Seccion>

          <Seccion id="derechos" titulo="Derechos y deberes del paciente">
            <p className="font-semibold text-marca-noche">En la farmacia tienes derecho a:</p>
            <Lista items={[
              'Recibir un trato digno y respetuoso.',
              'Saber antes de ir qué medicamentos hay disponibles y cuánto debes pagar.',
              'Recibir información clara sobre tus medicamentos y lo que queda pendiente.',
              'Que tus datos personales y de salud se manejen de forma confidencial.',
              'Presentar peticiones, quejas, reclamos y sugerencias, y recibir respuesta.',
            ]} />
            <p className="font-semibold text-marca-noche">Y el deber de:</p>
            <Lista items={[
              'Presentar tu documento y dar información verdadera.',
              'Llegar a tiempo a tu turno, o cancelarlo si no puedes ir, para que otro paciente lo aproveche.',
              'Tratar con respeto al personal y a los demás pacientes.',
              'Usar los medicamentos como los indicó tu médico y no entregarlos a otras personas.',
            ]} />
            <p className="text-base text-slate-500">
              Este es un resumen para la farmacia. La carta completa de derechos y deberes te la entrega tu EPS.
            </p>
          </Seccion>

          <Seccion id="datos" titulo="Tratamiento de datos personales">
            <p>
              Usamos tus datos (nombre, documento, teléfono y fórmula) solo para gestionar la entrega de tus medicamentos,
              tu turno y los avisos que te enviamos, según la Ley 1581 de 2012 de protección de datos personales.
            </p>
            <p>
              Solo el personal autorizado de la farmacia puede verlos, y queda registro de cada consulta.
              Puedes pedir conocer, actualizar o corregir tus datos por los canales de PQRS.
            </p>
          </Seccion>

          <Seccion id="pqrs" titulo="Peticiones, quejas y reclamos (PQRS)">
            <p>Puedes comunicarte con nosotros por cualquiera de estos canales:</p>
            <Lista items={[
              `En la ventanilla de la farmacia (${CONTACTO.horario}).`,
              `Por teléfono: ${CONTACTO.telefono}.`,
              `Por correo: ${CONTACTO.correo}.`,
            ]} />
            <p>Indica tu nombre, tu documento, el código de la fórmula (si aplica) y lo que necesitas.</p>
          </Seccion>
        </div>
      </div>
    </SitioPublico>
  );
}

function Seccion({ id, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="font-titulo text-2xl font-extrabold text-marca-noche">{titulo}</h2>
      {children}
    </section>
  );
}

function Lista({ items }) {
  return (
    <ul className="space-y-1.5 list-disc pl-6 marker:text-marca-verde">
      {items.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}

function Accion({ a, children }) {
  return (
    <Link to={a} className="inline-flex items-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro text-white font-bold px-5 py-2.5 rounded text-base">
      {children} <ArrowRight className="w-4 h-4" />
    </Link>
  );
}
