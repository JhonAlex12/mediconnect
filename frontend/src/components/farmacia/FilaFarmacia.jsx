import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  AlertCircle, CheckCircle2, Megaphone, PauseCircle, SkipForward, Undo2,
  UserPlus, Users, Wifi, WifiOff,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSesion } from '../../lib/sesion';

const PRIORIDADES = {
  ninguna: 'Sin prioridad',
  adulto_mayor: 'Adulto mayor',
  embarazada: 'Embarazada',
  discapacidad: 'Discapacidad',
};

const ESTADOS = {
  reservado: 'Reservado',
  en_camino: 'En camino',
  presente: 'Presente',
  llamado: 'Llamado',
  en_pausa: 'En pausa',
};

const hora = (fecha) =>
  fecha ? new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

function EtiquetaPrioridad({ prioridad }) {
  if (prioridad === 'ninguna') return null;
  return (
    <span className="text-xs font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
      {PRIORIDADES[prioridad] ?? prioridad}
    </span>
  );
}

function BotonAccion({ onClick, ocupado, color, icono: Icono, children }) {
  const colores = {
    verde: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ambar: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    gris: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colores[color]}`}
    >
      <Icono className="w-4 h-4" />
      {children}
    </button>
  );
}

export default function FilaFarmacia() {
  const { token } = useSesion();
  const [datos, setDatos] = useState({ turno_actual: null, presentes: 0, fila: [] });
  const [cargando, setCargando] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: 'error' | 'exito', texto }

  const cargar = useCallback(async () => {
    try {
      const d = await api('/fila');
      setDatos(d);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }, []);

  // Tiempo real: el backend avisa "fila_actualizada" y el panel vuelve a pedir la fila
  useEffect(() => {
    cargar();
    const socket = io({ auth: { token } });
    socket.on('connect', () => {
      setConectado(true);
      cargar(); // ponerse al día tras una reconexión
    });
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', () => setConectado(false));
    socket.on('fila_actualizada', cargar);
    return () => socket.disconnect();
  }, [token, cargar]);

  // Los avisos de éxito desaparecen solos
  useEffect(() => {
    if (aviso?.tipo !== 'exito') return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const ejecutar = async (accion, textoExito) => {
    setOcupado(true);
    setAviso(null);
    try {
      const r = await accion();
      setAviso({ tipo: 'exito', texto: typeof textoExito === 'function' ? textoExito(r) : textoExito });
      await cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setOcupado(false);
    }
  };

  const llamarSiguiente = () =>
    ejecutar(
      () => api('/fila/llamar-siguiente', { metodo: 'POST' }),
      (r) => `Llamando al turno ${r.turno.numero}`
    );

  const accionTurno = (turno, accion, texto) =>
    ejecutar(() => api(`/fila/${turno.id}/${accion}`, { metodo: 'POST' }), `Turno ${turno.numero}: ${texto}`);

  const llamado = datos.fila.find((t) => t.estado === 'llamado');
  const presentes = datos.fila.filter((t) => t.estado === 'presente');
  const enPausa = datos.fila.filter((t) => t.estado === 'en_pausa');
  const porLlegar = datos.fila.filter((t) => t.estado === 'reservado' || t.estado === 'en_camino');

  return (
    <div className="space-y-6">
      {/* Estado de la conexión en tiempo real */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800">Fila de hoy</h2>
        <span
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full ${
            conectado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {conectado ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {conectado ? 'En vivo' : 'Sin conexión en vivo'}
        </span>
      </div>

      {aviso && (
        <div
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          className={`border-l-4 p-3 rounded-r-lg flex items-start gap-2 ${
            aviso.tipo === 'error'
              ? 'bg-red-50 border-red-600 text-red-800'
              : 'bg-emerald-50 border-emerald-600 text-emerald-900'
          }`}
        >
          {aviso.tipo === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <p>{aviso.texto}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal: ventanilla + fila */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ventanilla: turno llamado o botón para llamar al siguiente (RF-21, RF-22) */}
          <section className="bg-white rounded-xl shadow-md border border-slate-300 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
              En ventanilla
            </p>
            {llamado ? (
              <div className="space-y-4">
                <div className="flex items-end gap-4 flex-wrap">
                  <span className="text-5xl font-black text-slate-900">{llamado.numero}</span>
                  <div className="pb-1">
                    <p className="text-lg font-semibold text-slate-800">{llamado.paciente ?? 'Sin nombre'}</p>
                    <p className="text-sm text-slate-600">
                      {llamado.formula ? `Fórmula ${llamado.formula}` : 'Sin fórmula vinculada'} · llamado a las{' '}
                      {hora(llamado.hora_llamado)}
                    </p>
                  </div>
                  <EtiquetaPrioridad prioridad={llamado.prioridad} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <BotonAccion color="verde" icono={CheckCircle2} ocupado={ocupado}
                    onClick={() => accionTurno(llamado, 'atender', 'atendido')}>
                    Marcar atendido
                  </BotonAccion>
                  <BotonAccion color="ambar" icono={PauseCircle} ocupado={ocupado}
                    onClick={() => accionTurno(llamado, 'pausar', 'en pausa')}>
                    No se presentó (pausar)
                  </BotonAccion>
                  <BotonAccion color="gris" icono={SkipForward} ocupado={ocupado}
                    onClick={() => accionTurno(llamado, 'saltar', 'enviado al final de la fila')}>
                    Saltar
                  </BotonAccion>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-slate-600">
                  No hay nadie en ventanilla.{' '}
                  <strong>{presentes.length}</strong> {presentes.length === 1 ? 'persona espera' : 'personas esperan'}.
                </p>
                <button
                  type="button"
                  onClick={llamarSiguiente}
                  disabled={ocupado || presentes.length === 0}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg px-6 py-3 rounded-lg transition cursor-pointer"
                >
                  <Megaphone className="w-5 h-5" />
                  Llamar siguiente
                </button>
              </div>
            )}
          </section>

          {/* Presentes, en el orden en que serán llamados */}
          <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-200 flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              <h3 className="font-bold text-slate-800">Esperando en la farmacia ({presentes.length})</h3>
            </div>
            {cargando ? (
              <p className="p-6 text-slate-500">Cargando la fila…</p>
            ) : presentes.length === 0 ? (
              <p className="p-6 text-slate-500">Nadie está esperando en este momento.</p>
            ) : (
              <ol className="divide-y divide-slate-200">
                {presentes.map((t, i) => (
                  <li key={t.id} className="px-6 py-3 flex items-center gap-4 flex-wrap">
                    <span className="w-6 text-slate-400 font-semibold">{i + 1}</span>
                    <span className="text-xl font-black text-slate-900 w-20">{t.numero}</span>
                    <div className="flex-1 min-w-40">
                      <p className="font-semibold text-slate-800">{t.paciente ?? 'Sin nombre'}</p>
                      <p className="text-sm text-slate-500">
                        {t.tipo === 'fisico' ? 'Turno físico' : 'Turno virtual'} · llegó {hora(t.hora_llegada)}
                        {t.veces_pausado > 0 && ` · pausado ${t.veces_pausado} vez${t.veces_pausado > 1 ? 'es' : ''}`}
                      </p>
                    </div>
                    <EtiquetaPrioridad prioridad={t.prioridad} />
                    <div className="flex gap-2">
                      <BotonAccion color="gris" icono={PauseCircle} ocupado={ocupado}
                        onClick={() => accionTurno(t, 'pausar', 'en pausa')}>
                        Pausar
                      </BotonAccion>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Columna lateral: registrar turno físico, pausados y por llegar */}
        <div className="space-y-6">
          <RegistrarFisico ocupado={ocupado} ejecutar={ejecutar} />

          <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">En pausa ({enPausa.length})</h3>
            </div>
            {enPausa.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No hay turnos en pausa.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {enPausa.map((t) => (
                  <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{t.numero}</p>
                      <p className="text-sm text-slate-500">{t.paciente ?? 'Sin nombre'}</p>
                    </div>
                    <BotonAccion color="verde" icono={Undo2} ocupado={ocupado}
                      onClick={() => accionTurno(t, 'reubicar', 'devuelto a la fila')}>
                      Llegó
                    </BotonAccion>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Por llegar ({porLlegar.length})</h3>
            </div>
            {porLlegar.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No hay turnos virtuales pendientes.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {porLlegar.map((t) => (
                  <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{t.numero}</p>
                      <p className="text-sm text-slate-500">{t.paciente ?? 'Sin nombre'}</p>
                    </div>
                    <span className="text-xs font-semibold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">
                      {ESTADOS[t.estado]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Registro de turno físico (RN-17): con la fórmula del paciente o solo con su nombre
function RegistrarFisico({ ocupado, ejecutar }) {
  const [conFormula, setConFormula] = useState(true);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [documento, setDocumento] = useState('');
  const [prioridad, setPrioridad] = useState('ninguna');

  const enviar = (e) => {
    e.preventDefault();
    const cuerpo = conFormula ? { codigo, documento, prioridad } : { nombre, prioridad };
    ejecutar(
      async () => {
        const r = await api('/fila/fisico', { metodo: 'POST', cuerpo });
        setNombre('');
        setCodigo('');
        setDocumento('');
        setPrioridad('ninguna');
        return r;
      },
      (r) => `Turno ${r.turno.numero} registrado`
    );
  };

  const claseCampo =
    'w-full border border-slate-400 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-600';

  return (
    <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-slate-600" />
        <h3 className="font-bold text-slate-800">Registrar turno físico</h3>
      </div>
      <form onSubmit={enviar} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg" role="group">
          {[
            [true, 'Con fórmula'],
            [false, 'Solo nombre'],
          ].map(([valor, texto]) => (
            <button
              key={texto}
              type="button"
              onClick={() => setConFormula(valor)}
              aria-pressed={conFormula === valor}
              className={`py-1.5 rounded-md text-sm font-semibold transition cursor-pointer ${
                conFormula === valor ? 'bg-white shadow text-slate-900' : 'text-slate-600'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        {conFormula ? (
          <>
            <div>
              <label htmlFor="f-codigo" className="block text-sm font-bold text-slate-800 mb-1">
                Código de la fórmula
              </label>
              <input id="f-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)}
                placeholder="F-2026-0001" className={`${claseCampo} uppercase`} />
            </div>
            <div>
              <label htmlFor="f-documento" className="block text-sm font-bold text-slate-800 mb-1">
                Documento del paciente
              </label>
              <input id="f-documento" value={documento} onChange={(e) => setDocumento(e.target.value)}
                inputMode="numeric" className={claseCampo} />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="f-nombre" className="block text-sm font-bold text-slate-800 mb-1">
              Nombre del paciente
            </label>
            <input id="f-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
          </div>
        )}

        <div>
          <label htmlFor="f-prioridad" className="block text-sm font-bold text-slate-800 mb-1">
            Prioridad
          </label>
          <select id="f-prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className={claseCampo}>
            {Object.entries(PRIORIDADES).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={ocupado}
          className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition cursor-pointer"
        >
          Dar turno
        </button>
      </form>
    </section>
  );
}
