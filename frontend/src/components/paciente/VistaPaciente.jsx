import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  AlertTriangle, Bell, CalendarClock, CheckCircle2, Clock, MapPin, Navigation, Search, Timer, XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso, claseCampo } from '../farmacia/comunes';
import { useTitulo } from '../Encabezado';
import SitioPublico, { TituloPagina } from '../SitioPublico';

// El turno del paciente vive en su teléfono: se guarda su token aparte del de los empleados
const CLAVE_TURNO = 'mediconect_token_turno';

const leerTurno = () => {
  try {
    return localStorage.getItem(CLAVE_TURNO);
  } catch {
    return null;
  }
};
const guardarTurno = (token) => {
  try {
    if (token) localStorage.setItem(CLAVE_TURNO, token);
    else localStorage.removeItem(CLAVE_TURNO);
  } catch {
    // Sin almacenamiento: el turno se ve mientras la página siga abierta
  }
};

const PRIORIDADES = {
  ninguna: 'Ninguna',
  adulto_mayor: 'Adulto mayor',
  embarazada: 'Embarazada',
  discapacidad: 'Persona con discapacidad',
};

const ESTADO_MEDICAMENTO = {
  disponible: { texto: 'Disponible', clase: 'bg-emerald-100 text-emerald-800' },
  pocas_unidades: { texto: 'Pocas unidades', clase: 'bg-amber-100 text-amber-900' },
  agotado: { texto: 'Agotado', clase: 'bg-red-100 text-red-800' },
  entregado: { texto: 'Ya entregado', clase: 'bg-slate-200 text-slate-600' },
};

// "2026-11-30" → "30 de noviembre" (sin pasar por zonas horarias)
const fechaLarga = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '—');

// Página del sitio, con el contenido en una columna angosta pensada para el celular
function PaginaPaciente({ children }) {
  return (
    <SitioPublico>
      <TituloPagina titulo="Mi turno" descripcion="Consulta tu fórmula, pide tu turno virtual y síguelo en vivo." />
      <div className="bg-slate-50 py-8">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">{children}</div>
        </div>
      </div>
    </SitioPublico>
  );
}

export default function VistaPaciente({ codigoInicial = '', documentoInicial = '' }) {
  useTitulo('Mi turno');
  const [token, setToken] = useState(leerTurno);
  const [aviso, setAviso] = useState(null);

  const entrar = (nuevo) => {
    guardarTurno(nuevo);
    setToken(nuevo);
    setAviso(null);
  };
  const salir = (mensaje) => {
    guardarTurno(null);
    setToken(null);
    setAviso(mensaje ? { tipo: 'error', texto: mensaje } : null);
  };

  return (
    <PaginaPaciente>
      <Aviso aviso={aviso} />
      {token ? (
        <MiTurno token={token} alSalir={salir} />
      ) : (
        <ConsultaYTurno codigoInicial={codigoInicial} documentoInicial={documentoInicial} alTomarTurno={entrar} />
      )}
    </PaginaPaciente>
  );
}

// ============================================================
// 1. Consultar la fórmula y pedir el turno (CU-01, CU-02)
// ============================================================
function ConsultaYTurno({ codigoInicial, documentoInicial, alTomarTurno }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [documento, setDocumento] = useState(documentoInicial);
  const [formula, setFormula] = useState(null);
  const [prioridad, setPrioridad] = useState('ninguna');
  const [avisosTurno, setAvisosTurno] = useState(null); // avisos que requieren confirmar
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);

  const consultar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    setFormula(null);
    setAvisosTurno(null);
    try {
      const d = await api('/formulas/consulta', { metodo: 'POST', cuerpo: { codigo, documento }, token: null });
      setFormula(d.formula);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const pedirTurno = async (confirmar = false) => {
    setOcupado(true);
    setError(null);
    try {
      const d = await api('/turnos', {
        metodo: 'POST',
        cuerpo: { codigo, documento, prioridad, confirmar },
        token: null,
      });
      if (d.requiere_confirmacion) setAvisosTurno(d.avisos);
      else alTomarTurno(d.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const pendientes = formula?.medicamentos.filter((m) => m.cantidad_pendiente > 0) ?? [];

  return (
    <>
      <form onSubmit={consultar} className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Consulta tu fórmula</h2>
        <div>
          <label htmlFor="p-codigo" className="block text-sm font-bold text-slate-800 mb-1">Código de la fórmula</label>
          <input id="p-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required
            placeholder="F-2026-0001" className={`${claseCampo} uppercase`} />
        </div>
        <div>
          <label htmlFor="p-documento" className="block text-sm font-bold text-slate-800 mb-1">Número de documento</label>
          <input id="p-documento" value={documento} onChange={(e) => setDocumento(e.target.value)} required
            inputMode="numeric" className={claseCampo} />
        </div>
        <button type="submit" disabled={ocupado}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition cursor-pointer">
          <Search className="w-5 h-5" />
          Consultar
        </button>
      </form>

      {error && <Aviso aviso={{ tipo: 'error', texto: error }} />}

      {formula && (
        <section className="space-y-4 border-t border-slate-200 pt-4">
          <div>
            <p className="text-sm text-slate-500">Fórmula {formula.codigo}</p>
            <p className="text-lg font-bold text-slate-900">{formula.paciente}</p>
            <p className="text-sm text-slate-600 flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4" />
              Reclamar hasta el {fechaLarga(formula.fecha_limite)}
            </p>
          </div>

          {formula.vencida ? (
            <Aviso aviso={{ tipo: 'error', texto: 'Esta fórmula superó su fecha límite. Pide una nueva en tu IPS.' }} />
          ) : formula.alerta && (
            <p className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {formula.dias_restantes === 0
                ? 'Hoy es el último día para reclamar.'
                : `Te ${formula.dias_restantes === 1 ? 'queda 1 día' : `quedan ${formula.dias_restantes} días`} para reclamar.`}
            </p>
          )}

          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
            {formula.medicamentos.map((m) => {
              const e = ESTADO_MEDICAMENTO[m.estado] ?? ESTADO_MEDICAMENTO.disponible;
              return (
                <li key={m.medicamento_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{m.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {m.presentacion} · {m.entrega_parcial
                        ? `te faltan ${m.cantidad_pendiente} de ${m.cantidad_formulada}`
                        : `${m.cantidad_formulada} unidades`}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${e.clase}`}>{e.texto}</span>
                </li>
              );
            })}
          </ul>

          {!formula.vencida && pendientes.length > 0 && (
            avisosTurno ? (
              <div className="space-y-3 bg-amber-50 border border-amber-300 rounded-xl p-4">
                <p className="font-bold text-amber-900">Antes de pedir el turno, ten en cuenta:</p>
                <ul className="list-disc pl-5 text-sm text-amber-900 space-y-0.5">
                  {avisosTurno.map((a) => <li key={a}>{a}</li>)}
                </ul>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAvisosTurno(null)}
                    className="py-2.5 rounded-xl font-semibold bg-white border border-slate-300 text-slate-800 cursor-pointer">
                    Volver
                  </button>
                  <button type="button" onClick={() => pedirTurno(true)} disabled={ocupado}
                    className="py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white cursor-pointer">
                    Pedir de todos modos
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor="p-prioridad" className="block text-sm font-bold text-slate-800 mb-1">
                    ¿Tienes atención preferencial?
                  </label>
                  <select id="p-prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className={claseCampo}>
                    {Object.entries(PRIORIDADES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => pedirTurno(false)} disabled={ocupado}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-lg py-3 rounded-xl transition cursor-pointer">
                  Pedir turno virtual
                </button>
              </div>
            )
          )}
          {!formula.vencida && pendientes.length === 0 && (
            <p className="text-center text-slate-600">Ya recibiste todos los medicamentos de esta fórmula.</p>
          )}
        </section>
      )}
    </>
  );
}

// ============================================================
// 2. Seguir el turno en vivo (CU-03, CU-04)
// ============================================================
const TEXTO_ESTADO = {
  reservado: 'Tu turno está reservado. Avísanos cuando salgas hacia la farmacia.',
  en_camino: 'Vas en camino. Cuando llegues, presiona "Ya llegué".',
  presente: 'Estás en la fila. Te llamaremos pronto.',
  llamado: '¡Es tu turno! Acércate a la ventanilla.',
  en_pausa: 'Te llamamos y no te encontramos. Si ya estás aquí, presiona "Ya llegué".',
  atendido: 'Tu turno fue atendido. ¡Gracias!',
  cancelado: 'Cancelaste este turno.',
  vencido: 'Este turno venció.',
};
const TERMINADOS = ['atendido', 'cancelado', 'vencido'];

function MiTurno({ token, alSalir }) {
  const [turno, setTurno] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Si el token del turno ya no sirve, se vuelve a la consulta
  const manejarError = useCallback(
    (err) => {
      if (err.estado === 401) alSalir('Tu sesión del turno venció. Consulta tu fórmula de nuevo.');
      else setAviso({ tipo: 'error', texto: err.message });
    },
    [alSalir]
  );

  const cargarTurno = useCallback(
    () => api('/turnos/mio', { token }).then((d) => setTurno(d.turno)).catch(manejarError),
    [token, manejarError]
  );
  const cargarNotificaciones = useCallback(
    () => api('/turnos/mio/notificaciones', { token }).then((d) => setNotificaciones(d.notificaciones)).catch(manejarError),
    [token, manejarError]
  );

  useEffect(() => {
    cargarTurno();
    cargarNotificaciones();
    const socket = io({ auth: { token } });
    socket.on('connect', () => {
      setConectado(true);
      cargarTurno();
      cargarNotificaciones();
    });
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', () => setConectado(false));
    socket.on('turno_actualizado', (t) => setTurno(t));
    socket.on('notificaciones_actualizadas', cargarNotificaciones);
    // Cuando la farmacia llama a otro turno, cambia la posición de este
    socket.on('turno_actual', cargarTurno);
    return () => socket.disconnect();
  }, [token, cargarTurno, cargarNotificaciones]);

  const accion = async (nombre, confirmacion) => {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setOcupado(true);
    setAviso(null);
    try {
      const d = await api(`/turnos/mio/${nombre}`, { metodo: 'POST', token });
      setTurno(d.turno);
    } catch (err) {
      manejarError(err);
    } finally {
      setOcupado(false);
    }
  };

  const marcarLeidas = async () => {
    try {
      await api('/turnos/mio/notificaciones/leidas', { metodo: 'POST', token });
      setNotificaciones((n) => n.map((x) => ({ ...x, leida: true })));
    } catch (err) {
      manejarError(err);
    }
  };

  if (!turno) return <p className="text-center text-slate-500 py-12">Cargando tu turno…</p>;

  const llamado = turno.estado === 'llamado';
  const terminado = TERMINADOS.includes(turno.estado);
  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  return (
    <>
      <div className="flex justify-end">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          conectado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
        }`}>
          {conectado ? 'En vivo' : 'Sin conexión en vivo'}
        </span>
      </div>

      <section className={`rounded-2xl p-5 text-center space-y-2 ${
        llamado ? 'bg-emerald-600 text-white animate-pulse' : terminado ? 'bg-slate-100' : 'bg-slate-900 text-white'
      }`} aria-live="polite">
        <p className={`text-sm font-semibold uppercase tracking-wide ${llamado ? 'text-emerald-100' : 'text-slate-400'}`}>
          Tu turno
        </p>
        <p className={`text-6xl font-black ${terminado ? 'text-slate-400' : ''}`}>{turno.numero}</p>
        <p className={`font-semibold ${terminado ? 'text-slate-700' : ''}`}>{TEXTO_ESTADO[turno.estado] ?? turno.estado}</p>
      </section>

      {!terminado && (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Dato icono={MapPin} etiqueta="Atendiendo ahora" valor={turno.turno_actual ?? 'Nadie'} />
          {turno.posicion !== null && (
            <Dato icono={Timer} etiqueta="Tu posición"
              valor={`${turno.posicion}º · ~${turno.minutos_estimados} min`} />
          )}
          {['reservado', 'en_camino'].includes(turno.estado) && (
            <Dato icono={Clock} etiqueta="Llega antes de" valor={hora(turno.vence_turno)} />
          )}
          <Dato icono={CalendarClock} etiqueta="Reclamar hasta" valor={fechaLarga(turno.reclamar_hasta)} />
        </dl>
      )}

      <Aviso aviso={aviso} />

      {!terminado ? (
        <div className="grid gap-2">
          {turno.estado === 'reservado' && (
            <BotonGrande color="oscuro" icono={Navigation} disabled={ocupado} onClick={() => accion('en-camino')}>
              Voy en camino
            </BotonGrande>
          )}
          {['reservado', 'en_camino', 'en_pausa'].includes(turno.estado) && (
            <BotonGrande color="verde" icono={CheckCircle2} disabled={ocupado} onClick={() => accion('llegue')}>
              Ya llegué
            </BotonGrande>
          )}
          {turno.retraso_disponible && (
            <BotonGrande color="ambar" icono={Clock} disabled={ocupado}
              onClick={() => accion('retrasado', '¿Pedir 20 minutos más? Solo puedes hacerlo una vez.')}>
              Voy retrasado (+20 min)
            </BotonGrande>
          )}
          <button type="button" disabled={ocupado}
            onClick={() => accion('cancelar', '¿Seguro que quieres cancelar tu turno? Los medicamentos apartados se liberan.')}
            className="flex items-center justify-center gap-2 py-2.5 text-red-700 font-semibold hover:bg-red-50 rounded-xl transition cursor-pointer disabled:opacity-50">
            <XCircle className="w-5 h-5" />
            Cancelar turno
          </button>
        </div>
      ) : (
        <BotonGrande color="oscuro" onClick={() => alSalir()}>
          Consultar otra fórmula
        </BotonGrande>
      )}

      <section className="border-t border-slate-200 pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificaciones
            {sinLeer > 0 && (
              <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">{sinLeer}</span>
            )}
          </h3>
          {sinLeer > 0 && (
            <button type="button" onClick={marcarLeidas} className="text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">
              Marcar como leídas
            </button>
          )}
        </div>
        {notificaciones.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no tienes notificaciones.</p>
        ) : (
          <ul className="space-y-2">
            {notificaciones.map((n) => (
              <li key={n.id} className={`text-sm rounded-lg p-3 border ${
                n.leida ? 'border-slate-200 text-slate-600' : 'border-emerald-300 bg-emerald-50 text-slate-900'
              }`}>
                <p>{n.mensaje}</p>
                <p className="text-xs text-slate-500 mt-1">{hora(n.fecha)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Dato({ icono: Icono, etiqueta, valor }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <dt className="text-slate-500 flex items-center gap-1"><Icono className="w-3.5 h-3.5" />{etiqueta}</dt>
      <dd className="font-bold text-slate-900">{valor}</dd>
    </div>
  );
}

function BotonGrande({ color, icono: Icono, children, ...props }) {
  const colores = {
    verde: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ambar: 'bg-amber-400 hover:bg-amber-500 text-slate-950',
    oscuro: 'bg-slate-800 hover:bg-slate-900 text-white',
  };
  return (
    <button type="button" {...props}
      className={`w-full flex items-center justify-center gap-2 font-bold text-lg py-3 rounded-xl transition cursor-pointer disabled:opacity-50 ${colores[color]}`}>
      {Icono && <Icono className="w-5 h-5" />}
      {children}
    </button>
  );
}
