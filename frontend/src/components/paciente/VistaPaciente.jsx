import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Bell, CalendarClock, CheckCircle2, Clock, MapPin, Navigation, Search, Ticket, Timer, XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso } from '../farmacia/comunes';
import {
  Aviso as AvisoBase, Boton, Campo, Cargando, Entrada, EstadoBadge, EstadoVacio, Selector,
} from '../ui';
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

// Estado del medicamento → tono con significado
const ESTADO_MEDICAMENTO = {
  disponible: { texto: 'Disponible', tono: 'ok' },
  pocas_unidades: { texto: 'Pocas unidades', tono: 'alerta' },
  agotado: { texto: 'Agotado', tono: 'error' },
  entregado: { texto: 'Ya entregado', tono: 'neutro' },
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
      <div className="bg-fondo py-6 sm:py-10">
        <div className="max-w-lg mx-auto px-4 space-y-5">{children}</div>
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
      <form onSubmit={consultar} className="bg-superficie border border-borde-fuerte rounded-md p-5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-tinta">Consulta tu fórmula</h2>
          <p className="text-tinta-suave text-sm mt-0.5">Los datos están en la fórmula que te entregó tu médico.</p>
        </div>
        <Campo id="p-codigo" etiqueta="Código de la fórmula" ayuda="Ejemplo: F-2026-0001">
          <Entrada value={codigo} onChange={(e) => setCodigo(e.target.value)} required
            className="h-12 text-lg uppercase cifras" autoComplete="off" />
        </Campo>
        <Campo id="p-documento" etiqueta="Número de documento">
          <Entrada value={documento} onChange={(e) => setDocumento(e.target.value)} required
            inputMode="numeric" className="h-12 text-lg cifras" autoComplete="off" />
        </Campo>
        <Boton type="submit" variante="primario" tamano="lg" icono={Search} disabled={ocupado} cargando={ocupado && !formula} ancho>
          Consultar
        </Boton>
      </form>

      {error && <AvisoBase tono="error">{error}</AvisoBase>}

      {formula && (
        <section className="bg-superficie border border-borde-fuerte rounded-md" aria-labelledby="titulo-formula">
          <div className="p-5 border-b border-borde space-y-1">
            <p className="text-sm text-tinta-suave cifras">Fórmula {formula.codigo}</p>
            <h2 id="titulo-formula" className="text-xl font-bold text-tinta">{formula.paciente}</h2>
            <p className="text-tinta-suave flex items-center gap-1.5">
              <CalendarClock size={16} aria-hidden="true" />
              Reclamar hasta el <strong className="text-tinta">{fechaLarga(formula.fecha_limite)}</strong>
            </p>
          </div>

          <div className="p-5 space-y-4">
            {formula.vencida ? (
              <AvisoBase tono="error" titulo="Fórmula vencida">Superó su fecha límite. Pide una nueva en tu IPS.</AvisoBase>
            ) : formula.alerta && (
              <AvisoBase tono="alerta" titulo="Fórmula por vencer">
                {formula.dias_restantes === 0
                  ? 'Hoy es el último día para reclamar.'
                  : `Te ${formula.dias_restantes === 1 ? 'queda 1 día' : `quedan ${formula.dias_restantes} días`} para reclamar.`}
              </AvisoBase>
            )}

            <ul className="divide-y divide-borde border border-borde rounded-md" aria-label="Medicamentos de la fórmula">
              {formula.medicamentos.map((m) => {
                const e = ESTADO_MEDICAMENTO[m.estado] ?? ESTADO_MEDICAMENTO.disponible;
                return (
                  <li key={m.medicamento_id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-tinta">{m.nombre}</p>
                      <p className="text-sm text-tinta-suave">
                        {m.presentacion} ·{' '}
                        <span className="cifras">
                          {m.entrega_parcial
                            ? `te faltan ${m.cantidad_pendiente} de ${m.cantidad_formulada}`
                            : `${m.cantidad_formulada} unidades`}
                        </span>
                      </p>
                    </div>
                    <EstadoBadge tono={e.tono}>{e.texto}</EstadoBadge>
                  </li>
                );
              })}
            </ul>

            {!formula.vencida && pendientes.length > 0 && (
              avisosTurno ? (
                <div className="space-y-3">
                  <AvisoBase tono="alerta" titulo="Antes de pedir el turno, ten en cuenta:">
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {avisosTurno.map((a) => <li key={a}>{a}</li>)}
                    </ul>
                  </AvisoBase>
                  <div className="grid grid-cols-2 gap-2">
                    <Boton variante="secundario" tamano="lg" onClick={() => setAvisosTurno(null)}>
                      Volver
                    </Boton>
                    <Boton variante="primario" tamano="lg" onClick={() => pedirTurno(true)} disabled={ocupado}>
                      Pedir igual
                    </Boton>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 border-t border-borde pt-4">
                  <Campo id="p-prioridad" etiqueta="¿Tienes atención preferencial?">
                    <Selector value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="h-12 text-lg">
                      {Object.entries(PRIORIDADES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </Selector>
                  </Campo>
                  <Boton variante="primario" tamano="lg" icono={Ticket} onClick={() => pedirTurno(false)} disabled={ocupado} ancho>
                    Pedir turno virtual
                  </Boton>
                </div>
              )
            )}
            {!formula.vencida && pendientes.length === 0 && (
              <EstadoVacio titulo="Ya recibiste todos los medicamentos de esta fórmula" icono={CheckCircle2} />
            )}
          </div>
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

  if (!turno) {
    return (
      <div className="bg-superficie border border-borde-fuerte rounded-md">
        <Cargando texto="Cargando tu turno…" className="justify-center" />
      </div>
    );
  }

  const llamado = turno.estado === 'llamado';
  const terminado = TERMINADOS.includes(turno.estado);
  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  return (
    <>
      <section
        className={`rounded-md border p-6 text-center ${
          llamado
            ? 'bg-primario-700 border-primario-700 text-white'
            : 'bg-superficie border-borde-fuerte text-tinta'
        }`}
        aria-live="polite"
        aria-labelledby="titulo-turno"
      >
        <div className="flex justify-between items-center text-sm mb-3">
          <span id="titulo-turno" className={`font-bold ${llamado ? 'text-primario-100' : 'text-tinta-suave'}`}>Tu turno</span>
          <span className={`inline-flex items-center gap-1.5 ${llamado ? 'text-primario-100' : 'text-tinta-suave'}`}>
            <span className={`w-2 h-2 rounded-full ${conectado ? (llamado ? 'bg-white' : 'bg-ok-texto') : 'bg-tinta-tenue'}`} aria-hidden="true" />
            {conectado ? 'En vivo' : 'Sin conexión en vivo'}
          </span>
        </div>
        <p className={`text-7xl font-bold cifras leading-none ${terminado ? 'text-tinta-tenue' : ''}`}>{turno.numero}</p>
        <p className={`mt-4 text-lg font-bold ${terminado ? 'text-tinta-suave' : ''}`}>
          {TEXTO_ESTADO[turno.estado] ?? turno.estado}
        </p>
      </section>

      {!terminado && (
        <dl className="bg-superficie border border-borde-fuerte rounded-md divide-y divide-borde">
          <Dato icono={MapPin} etiqueta="Atendiendo ahora" valor={turno.turno_actual ?? 'Nadie'} />
          {turno.posicion !== null && (
            <Dato icono={Timer} etiqueta="Tu posición" valor={`${turno.posicion}º · unos ${turno.minutos_estimados} min`} />
          )}
          {['reservado', 'en_camino'].includes(turno.estado) && (
            <Dato icono={Clock} etiqueta="Llega antes de" valor={hora(turno.vence_turno)} />
          )}
          <Dato icono={CalendarClock} etiqueta="Reclamar hasta" valor={fechaLarga(turno.reclamar_hasta)} />
        </dl>
      )}

      <Aviso aviso={aviso} />

      {!terminado ? (
        <div className="grid gap-3">
          {turno.estado === 'reservado' && (
            <Boton variante="secundario" tamano="lg" icono={Navigation} disabled={ocupado} onClick={() => accion('en-camino')} ancho>
              Voy en camino
            </Boton>
          )}
          {['reservado', 'en_camino', 'en_pausa'].includes(turno.estado) && (
            <Boton variante="primario" tamano="lg" icono={CheckCircle2} disabled={ocupado} onClick={() => accion('llegue')} ancho>
              Ya llegué
            </Boton>
          )}
          {turno.retraso_disponible && (
            <Boton variante="secundario" tamano="lg" icono={Clock} disabled={ocupado} ancho
              onClick={() => accion('retrasado', '¿Pedir 20 minutos más? Solo puedes hacerlo una vez.')}>
              Voy retrasado (+20 min)
            </Boton>
          )}
          <Boton variante="peligro" tamano="lg" icono={XCircle} disabled={ocupado} ancho
            onClick={() => accion('cancelar', '¿Seguro que quieres cancelar tu turno? Los medicamentos apartados se liberan.')}>
            Cancelar turno
          </Boton>
        </div>
      ) : (
        <Boton variante="primario" tamano="lg" onClick={() => alSalir()} ancho>
          Consultar otra fórmula
        </Boton>
      )}

      <section className="bg-superficie border border-borde-fuerte rounded-md" aria-labelledby="titulo-notificaciones">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-borde">
          <h2 id="titulo-notificaciones" className="font-bold text-tinta flex items-center gap-2">
            <Bell size={20} aria-hidden="true" />
            Notificaciones
            {sinLeer > 0 && <span className="text-sm font-normal text-tinta-suave cifras">({sinLeer} sin leer)</span>}
          </h2>
          {sinLeer > 0 && (
            <Boton variante="fantasma" tamano="sm" onClick={marcarLeidas}>Marcar como leídas</Boton>
          )}
        </div>
        {notificaciones.length === 0 ? (
          <EstadoVacio titulo="Aún no tienes notificaciones" icono={Bell}>
            Aquí verás cuándo te llamen y si cambia la disponibilidad.
          </EstadoVacio>
        ) : (
          <ul className="divide-y divide-borde">
            {notificaciones.map((n) => (
              <li key={n.id} className="px-4 py-3 flex gap-3">
                <span
                  className={`mt-2 w-2 h-2 shrink-0 rounded-full ${n.leida ? 'bg-transparent' : 'bg-primario-600'}`}
                  aria-hidden="true"
                />
                <div>
                  <p className={n.leida ? 'text-tinta-suave' : 'text-tinta font-bold'}>
                    {!n.leida && <span className="sr-only">Sin leer: </span>}
                    {n.mensaje}
                  </p>
                  <p className="text-xs text-tinta-tenue mt-0.5 cifras">{hora(n.fecha)}</p>
                </div>
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
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="text-tinta-suave flex items-center gap-2">
        <Icono size={16} aria-hidden="true" />
        {etiqueta}
      </dt>
      <dd className="font-bold text-tinta text-right cifras">{valor}</dd>
    </div>
  );
}
