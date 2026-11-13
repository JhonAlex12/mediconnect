import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardPen, ExternalLink, MonitorOff, MonitorSmartphone, Printer, Save, TabletSmartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { useSesion } from '../../lib/sesion';
import { guardarTokenKiosco } from '../../lib/kiosco';
import { Aviso, BotonAccion, useAccion } from './comunes';
import { TiqueteImpresion, imprimirTiquete } from '../TiqueteImpresion';

// Pantalla de turnos de la entrada: activarla en un equipo, desactivarlas y, como respaldo,
// abrir la página para registrar un turno a mano (/turno-manual) si la pantalla falla
export default function KioscoAdmin() {
  const navegar = useNavigate();
  const { cerrarSesion } = useSesion();
  const { ocupado, aviso, ejecutar } = useAccion();

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

      <AjustesImpresion />

      <section className="bg-white rounded-xl border border-slate-300 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ClipboardPen className="w-5 h-5 text-slate-600" /> Respaldo: registrar un turno a mano
          </h3>
          <p className="text-sm text-slate-600">Úsalo solo si la pantalla de la entrada no está funcionando. Se abre en otra pestaña.</p>
        </div>
        <a href="/turno-manual" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-marca-azul hover:bg-marca-azul-oscuro text-white px-4 py-2.5 rounded-lg text-sm font-semibold">
          Abrir registro manual <ExternalLink className="w-4 h-4" />
        </a>
      </section>
    </div>
  );
}

const OPCIONES_IMPRESION = [
  ['automatica', 'Automática', 'El tiquete sale apenas se genera el turno, como en los dispensadores de las clínicas.'],
  ['boton', 'Con botón', 'Aparece el botón “Imprimir tiquete” y solo imprime quien lo toque.'],
  ['ninguna', 'Sin impresión', 'El turno solo se muestra en la pantalla (si aún no hay impresora).'],
];

// Cómo se imprime el tiquete del turno en las pantallas de la entrada
function AjustesImpresion() {
  const [ajustes, setAjustes] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useAccion();
  const [prueba, setPrueba] = useState(false);

  useEffect(() => {
    api('/kiosco/ajustes').then((r) => setAjustes(r.ajustes)).catch((err) => setAviso({ tipo: 'error', texto: err.message }));
  }, [setAviso]);

  // El tiquete de prueba se monta, se imprime y se retira
  useEffect(() => {
    if (!prueba) return undefined;
    imprimirTiquete();
    const t = setTimeout(() => setPrueba(false), 2000);
    return () => clearTimeout(t);
  }, [prueba]);

  const guardar = () => ejecutar(async () => {
    const r = await api('/kiosco/ajustes', { metodo: 'PUT', cuerpo: ajustes });
    setAjustes(r.ajustes);
  }, 'Guardado. Las pantallas lo toman en máximo 2 minutos (o al recargarlas).');

  if (!ajustes) return <Aviso aviso={aviso} />;
  return (
    <section className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Printer className="w-5 h-5 text-slate-600" /> Impresión del tiquete</h3>
      <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Impresión del tiquete">
        {OPCIONES_IMPRESION.map(([valor, titulo, detalle]) => (
          <label key={valor} className={`rounded-lg border-2 p-3 cursor-pointer ${
            ajustes.impresion === valor ? 'border-marca-azul bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <input type="radio" name="impresion" value={valor} checked={ajustes.impresion === valor} className="sr-only"
              onChange={() => setAjustes((a) => ({ ...a, impresion: valor }))} />
            <span className="block font-bold text-slate-900">{titulo}</span>
            <span className="block text-sm text-slate-600 mt-0.5">{detalle}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="papel" className="font-semibold text-slate-800">Ancho del papel</label>
        <select id="papel" value={ajustes.papel} onChange={(e) => setAjustes((a) => ({ ...a, papel: Number(e.target.value) }))}
          className="border border-slate-400 rounded-lg px-3 py-2">
          <option value={80}>80 mm</option>
          <option value={58}>58 mm</option>
        </select>
      </div>
      <Aviso aviso={aviso} />
      <div className="flex flex-wrap gap-3">
        <BotonAccion color="verde" icono={Save} ocupado={ocupado} onClick={guardar}>Guardar</BotonAccion>
        <BotonAccion color="gris" icono={Printer} onClick={() => setPrueba(true)}>Imprimir tiquete de prueba</BotonAccion>
      </div>
      {prueba && (
        <TiqueteImpresion papel={ajustes.papel}
          datos={{ numero: 'F-000', tramite: 'reclamar', prioridad: 'ninguna', fecha: new Date() }} />
      )}

      <details className="text-sm text-slate-700 bg-slate-50 rounded-lg p-4">
        <summary className="font-semibold cursor-pointer">Cómo dejar la impresora lista para imprimir sin preguntar</summary>
        <p className="mt-3">
          Normalmente el navegador muestra la ventana de impresión cada vez. En el computador de la entrada (con Windows y Google Chrome):
        </p>
        <ol className="list-decimal pl-5 mt-2 space-y-1.5">
          <li>Instale la impresora de tiquetes y déjela como <strong>impresora predeterminada</strong> de Windows. En sus preferencias elija el papel de 80 mm (o 58 mm).</li>
          <li>En Chrome normal, entre a este panel y toque <strong>Activar este equipo como pantalla de turnos</strong>.</li>
          <li>Cree un acceso directo en el escritorio con este destino (cambie la dirección por la del sitio):
            <code className="block bg-white border border-slate-200 rounded px-2 py-1 mt-1 break-all">
              &quot;C:\Program Files\Google\Chrome\Application\chrome.exe&quot; --kiosk --kiosk-printing {window.location.origin}/kiosco
            </code>
          </li>
          <li>Ábralo con ese acceso directo: la pantalla de turnos ocupa toda la pantalla e imprime directo, sin preguntar.
            Para salir del modo kiosco use <strong>Alt + F4</strong>.</li>
          <li>Opcional: copie el acceso directo en la carpeta de inicio de Windows (<code>shell:startup</code>) para que abra sola al encender.</li>
        </ol>
        <p className="mt-3 text-slate-600">
          En tablets Android el navegador siempre muestra la ventana de impresión; para imprimir directo se recomienda un computador con Windows.
        </p>
      </details>
    </section>
  );
}
