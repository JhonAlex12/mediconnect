import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, MonitorOff, MonitorSmartphone, TabletSmartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { useSesion } from '../../lib/sesion';
import { guardarTokenKiosco } from '../../lib/kiosco';
import { Aviso, BotonAccion, useAccion } from './comunes';
import { RegistrarFisico } from './FilaFarmacia';

// Pantalla de turnos de la entrada: activarla en un equipo, desactivarlas y, como respaldo,
// registrar un turno a mano si la pantalla falla
export default function KioscoAdmin() {
  const navegar = useNavigate();
  const { cerrarSesion } = useSesion();
  const { ocupado, aviso, ejecutar } = useAccion();
  const respaldo = useAccion();

  const activarAqui = async () => {
    if (!window.confirm(
      'Este equipo quedará como pantalla de turnos para los pacientes y se cerrará tu sesión en él.\n\n¿Continuar?'
    )) return;
    await ejecutar(async () => {
      const r = await api('/kiosco/activar', { metodo: 'POST' });
      guardarTokenKiosco(r.token);
      cerrarSesion(); // en un equipo público no puede quedar abierta la sesión del administrador
      navegar('/kiosco', { replace: true });
    }, 'Pantalla activada');
  };

  const desactivarTodas = () => {
    if (!window.confirm('Todas las pantallas de turnos activadas dejarán de funcionar hasta que las actives otra vez.\n\n¿Continuar?')) return;
    ejecutar(() => api('/kiosco/desactivar', { metodo: 'POST' }), 'Pantallas desactivadas. Actívalas de nuevo en cada equipo.');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <TabletSmartphone className="w-6 h-6 text-slate-600" /> Pantalla de turnos
      </h2>

      <section className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
        <p className="text-slate-700">
          Es la pantalla de la entrada donde los pacientes sacan su turno. Escriben su cédula y el sistema
          <strong> les da un turno con su fórmula</strong> o, si ya tenían turno virtual, <strong>registra que llegaron</strong>.
          También pueden sacar un turno de “Otro trámite”. No muestra nombres, códigos ni medicamentos.
        </p>
        <ol className="list-decimal pl-5 text-slate-700 space-y-1">
          <li>Abre el panel en la tablet o el computador de la entrada e inicia sesión como administrador.</li>
          <li>Entra a esta sección y toca <strong>Activar este equipo como pantalla de turnos</strong>.</li>
          <li>Tu sesión se cierra en ese equipo y queda la pantalla de turnos (dirección <code>/kiosco</code>). Toca “Pantalla completa”.</li>
        </ol>
        <Aviso aviso={aviso} />
        <div className="flex flex-wrap gap-3">
          <BotonAccion color="verde" icono={MonitorSmartphone} ocupado={ocupado} onClick={activarAqui}>
            Activar este equipo como pantalla de turnos
          </BotonAccion>
          <BotonAccion color="gris" icono={MonitorOff} ocupado={ocupado} onClick={desactivarTodas}>
            Desactivar todas las pantallas
          </BotonAccion>
          <a href="/kiosco" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:underline px-2">
            Ver cómo se ve <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <p className="text-sm text-slate-500">
          Usa “Desactivar todas” si roban o cambian un equipo: las pantallas activadas dejan de funcionar al instante.
        </p>
      </section>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Respaldo: registrar un turno a mano</h3>
          <p className="text-sm text-slate-600">Úsalo solo si la pantalla de la entrada no está funcionando.</p>
        </div>
        <Aviso aviso={respaldo.aviso} />
        <div className="max-w-md">
          <RegistrarFisico ocupado={respaldo.ocupado} ejecutar={respaldo.ejecutar} />
        </div>
      </div>
    </div>
  );
}
