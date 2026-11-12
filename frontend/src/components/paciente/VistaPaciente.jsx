import React, { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  AlertTriangle, BellOff, BellRing, Truck, CalendarClock, CheckCircle2, Clock, MapPin, Navigation, Search, Share, Timer, Wallet, XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { activarAvisos, desactivarAvisos, estadoAvisos, vincularAvisos } from '../../lib/avisosCelular';
import { Aviso, claseCampo } from '../farmacia/comunes';
import { useTitulo } from '../Encabezado';
import SitioPublico, { TituloPagina, useAbrirIngreso } from '../SitioPublico';
import { useNavigate } from 'react-router-dom';
import { useCuenta } from '../../lib/cuenta';
import { useCostoEnvio } from '../../lib/costoEnvio';
import { guardarDomicilioPendiente } from '../../lib/domicilioPendiente';

export const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

// Cuánto paga el paciente al reclamar (cuota moderadora)
export function CobroFormula({ cobro }) {
  if (!cobro) return null;
  if (cobro.valor > 0 && cobro.pagado) {
    return (
      <p className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
        Ya pagaste la cuota moderadora de esta fórmula ({pesos(cobro.valor)}). Lo pendiente no tiene costo.
      </p>
    );
  }
  if (cobro.valor > 0) {
    return (
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Wallet className="w-5 h-5 shrink-0 text-marca-azul mt-0.5" />
        <div>
          <p className="font-bold text-marca-noche">Valor a pagar al reclamar: {pesos(cobro.valor)}</p>
          <p className="text-sm text-slate-600">
            Cuota moderadora. Se paga una sola vez en la caja, en efectivo, transferencia o tarjeta.
            Sin el pago no se pueden entregar los medicamentos.
          </p>
        </div>
      </div>
    );
  }
  return (
    <p className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900">
      <CheckCircle2 className="w-5 h-5 shrink-0" />
      Sin costo. {cobro.motivo}.
    </p>
  );
}

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

export const ESTADO_MEDICAMENTO = {
  disponible: { texto: 'Disponible', clase: 'bg-emerald-100 text-emerald-800' },
  pocas_unidades: { texto: 'Pocas unidades', clase: 'bg-amber-100 text-amber-900' },
  agotado: { texto: 'Agotado', clase: 'bg-red-100 text-red-800' },
  entregado: { texto: 'Ya entregado', clase: 'bg-slate-200 text-slate-600' },
};

// "2026-11-30" → "30 de noviembre" (sin pasar por zonas horarias)
export const fechaLarga = (iso) => {
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
      <div className="bg-marca-hielo py-8">
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
    e?.preventDefault();
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

  // Llegó desde el QR de la fórmula impresa (o el enlace de la IPS): se consulta de una vez
  useEffect(() => {
    if (codigoInicial && documentoInicial) consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          className="w-full flex items-center justify-center gap-2 bg-marca-azul hover:bg-marca-azul-oscuro disabled:opacity-50 text-white font-bold py-3 rounded-xl transition cursor-pointer">
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

          {!formula.vencida && pendientes.length > 0 && <CobroFormula cobro={formula.cobro} />}

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
                    className="py-2.5 rounded-xl font-bold bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-50 text-white cursor-pointer">
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
                  className="w-full bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-50 text-white font-bold text-lg py-3 rounded-xl transition cursor-pointer">
                  Pedir turno virtual
                </button>
                <OpcionDomicilio codigo={formula.codigo ?? codigo.trim().toUpperCase()} />
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

// Pedir los medicamentos a domicilio en vez de ir a la farmacia.
// Necesita una cuenta de Mediconnect (para saber a quién y a dónde se entrega): si no hay sesión,
// se abre la ventana de ingreso; "Mi cuenta" retoma el pedido al entrar (ver domicilioPendiente.js).
function OpcionDomicilio({ codigo }) {
  const { cuenta } = useCuenta();
  const abrirIngreso = useAbrirIngreso();
  const navegar = useNavigate();
  const envio = useCostoEnvio();

  const pedir = () => {
    guardarDomicilioPendiente(codigo);
    if (cuenta) navegar('/mi-cuenta');
    else abrirIngreso();
  };

  return (
    <div className="pt-1">
      <div className="flex items-center gap-3 text-sm text-slate-500 my-2" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" /> o <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button type="button" onClick={pedir}
        className="w-full flex items-center justify-center gap-2 border-2 border-marca-azul text-marca-azul hover:bg-marca-hielo font-bold text-lg py-3 rounded-xl transition cursor-pointer">
        <Truck className="w-5 h-5" /> Pedir a domicilio
      </button>
      <p className="text-xs text-slate-500 text-center mt-2">
        {envio != null ? `Envío ${pesos(envio)}, se paga al recibir. ` : ''}
        {cuenta ? 'Lo terminas en tu cuenta.' : 'Necesitas una cuenta de Mediconnect: ingresa o créala en un minuto.'}
      </p>
    </div>
  );
}

// ============================================================
// 2. Seguir el turno en vivo (CU-03, CU-04)
// ============================================================
const TEXTO_ESTADO = {
  reservado: 'Tu turno está reservado. Avísanos cuando salgas hacia la farmacia.',
  en_camino: 'Vas en camino. Cuando llegues, presiona "Ya llegué".',
  presente: 'Estás en la fila. Te llamaremos pronto.',
  llamado: '¡Es tu turno! Acércate a la caja.',
  en_pausa: 'Te llamamos y no te encontramos. Si ya estás aquí, presiona "Ya llegué".',
  atendido: 'Tu turno fue atendido. ¡Gracias!',
  cancelado: 'Cancelaste este turno.',
  vencido: 'Este turno venció.',
};
const TERMINADOS = ['atendido', 'cancelado', 'vencido'];

function MiTurno({ token, alSalir }) {
  const [turno, setTurno] = useState(null);
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

  useEffect(() => {
    cargarTurno();
    const socket = io({ auth: { token } });
    socket.on('connect', () => {
      setConectado(true);
      cargarTurno();
    });
    socket.on('disconnect', () => setConectado(false));
    socket.on('connect_error', () => setConectado(false));
    socket.on('turno_actualizado', (t) => setTurno(t));
    // Cuando la farmacia llama a otro turno, cambia la posición de este
    socket.on('turno_actual', cargarTurno);
    return () => socket.disconnect();
  }, [token, cargarTurno]);

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

  if (!turno) return <p className="text-center text-slate-500 py-12">Cargando tu turno…</p>;

  const llamado = turno.estado === 'llamado';
  const terminado = TERMINADOS.includes(turno.estado);

  return (
    <>
      <div className="flex justify-end">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          conectado ? 'bg-marca-hielo text-marca-azul-oscuro' : 'bg-slate-100 text-slate-500'
        }`}>
          {conectado ? 'En vivo' : 'Sin conexión en vivo'}
        </span>
      </div>

      <section className={`rounded-2xl p-5 text-center space-y-2 ${
        llamado ? 'bg-marca-azul text-white animate-pulse' : terminado ? 'bg-slate-100' : 'bg-white border-2 border-marca-azul text-marca-noche'
      }`} aria-live="polite">
        <p className={`text-sm font-semibold uppercase tracking-wide ${llamado ? 'text-white/80' : terminado ? 'text-slate-400' : 'text-marca-azul'}`}>
          Tu turno
        </p>
        <p className={`text-6xl font-black ${terminado ? 'text-slate-400' : ''}`}>{turno.numero}</p>
        {llamado && turno.caja ? (
          <p className="text-2xl font-black">¡Es tu turno! Acércate a la caja {turno.caja}.</p>
        ) : (
          <p className={`font-semibold ${terminado ? 'text-slate-700' : ''}`}>{TEXTO_ESTADO[turno.estado] ?? turno.estado}</p>
        )}
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
          {turno.valor_a_pagar > 0 && (
            <Dato icono={Wallet} etiqueta="Lleva para pagar" valor={pesos(turno.valor_a_pagar)} />
          )}
        </dl>
      )}

      {!terminado && <AvisosCelular token={token} />}

      <Aviso aviso={aviso} />

      {!terminado ? (
        <div className="grid gap-2">
          {turno.estado === 'reservado' && (
            <BotonGrande color="secundario" icono={Navigation} disabled={ocupado} onClick={() => accion('en-camino')}>
              Voy en camino
            </BotonGrande>
          )}
          {['reservado', 'en_camino', 'en_pausa'].includes(turno.estado) && (
            <BotonGrande color="principal" icono={CheckCircle2} disabled={ocupado} onClick={() => accion('llegue')}>
              Ya llegué
            </BotonGrande>
          )}
          {turno.retraso_disponible && (
            <BotonGrande color="suave" icono={Clock} disabled={ocupado}
              onClick={() => accion('retrasado', '¿Pedir 20 minutos más? Solo puedes hacerlo una vez.')}>
              Voy retrasado (+20 min)
            </BotonGrande>
          )}
          <button type="button" disabled={ocupado}
            onClick={() => accion('cancelar', '¿Seguro que quieres cancelar tu turno? Los medicamentos apartados se liberan.')}
            className="flex items-center justify-center gap-2 py-2.5 text-slate-500 font-semibold hover:text-slate-800 hover:bg-slate-50 rounded-xl transition cursor-pointer disabled:opacity-50">
            <XCircle className="w-5 h-5" />
            Cancelar turno
          </button>
        </div>
      ) : (
        <BotonGrande color="principal" onClick={() => alSalir()}>
          Consultar otra fórmula
        </BotonGrande>
      )}

    </>
  );
}

// Avisos en el celular: "Es tu turno", pausas, vencimientos y entregas llegan como notificación del teléfono
function AvisosCelular({ token }) {
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    estadoAvisos()
      .then(async (e) => {
        if (cancelado) return;
        setEstado(e);
        // Si este celular ya recibía avisos (otro turno), queda vinculado también a este
        if (e === 'activo') await vincularAvisos(token).catch(() => {});
      })
      .catch(() => !cancelado && setEstado('no_soportado'));
    return () => { cancelado = true; };
  }, [token]);

  const activar = async () => {
    setOcupado(true);
    setError('');
    try {
      await activarAvisos(token);
      setEstado('activo');
    } catch (err) {
      setError(err.message);
      setEstado(await estadoAvisos().catch(() => 'inactivo'));
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    try {
      await desactivarAvisos(token);
      setEstado('inactivo');
    } finally {
      setOcupado(false);
    }
  };

  if (!estado || estado === 'no_soportado' || estado === 'sin_servidor') return null;

  const caja = 'rounded-xl border p-4 flex items-start gap-3';
  if (estado === 'activo') {
    return (
      <div className={`${caja} border-marca-azul/20 bg-marca-hielo`}>
        <BellRing className="w-5 h-5 text-marca-azul shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-bold text-marca-noche">Avisos activados en este celular</p>
          <p className="text-slate-600">Te avisaremos cuando sea tu turno, aunque cierres esta página.</p>
        </div>
        <button type="button" onClick={desactivar} disabled={ocupado}
          className="text-xs font-semibold text-marca-azul hover:text-marca-azul-oscuro underline cursor-pointer disabled:opacity-50">
          Desactivar
        </button>
      </div>
    );
  }
  if (estado === 'iphone') {
    return (
      <div className={`${caja} border-slate-200 bg-slate-50`}>
        <Share className="w-5 h-5 text-marca-azul shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700">
          <p className="font-bold text-slate-900">¿Quieres avisos en tu iPhone?</p>
          <p>Toca <strong>Compartir</strong> y luego <strong>Agregar a inicio</strong>. Abre Mediconnect desde ese ícono y activa los avisos.</p>
        </div>
      </div>
    );
  }
  if (estado === 'bloqueado') {
    return (
      <div className={`${caja} border-slate-200 bg-slate-50`}>
        <BellOff className="w-5 h-5 text-marca-azul shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700">
          <p className="font-bold">Los avisos están bloqueados</p>
          <p>Para recibirlos, permite las notificaciones de esta página en la configuración del navegador.</p>
        </div>
      </div>
    );
  }
  if (estado === 'sin_https') {
    return (
      <div className={`${caja} border-slate-200 bg-slate-50`}>
        <BellOff className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">Los avisos al celular solo funcionan cuando la página se abre con una dirección segura (https).</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={activar} disabled={ocupado}
        className="w-full flex items-center justify-center gap-2 font-semibold py-3 px-4 rounded-xl bg-marca-hielo text-marca-azul-oscuro hover:bg-[#e2eef8] transition cursor-pointer disabled:opacity-50">
        <BellRing className="w-5 h-5" />
        {ocupado ? 'Activando…' : 'Avisarme en este celular cuando sea mi turno'}
      </button>
      {error && <p className="text-sm text-red-700 text-center">{error}</p>}
    </div>
  );
}

function Dato({ icono: Icono, etiqueta, valor }) {
  return (
    <div className="bg-marca-hielo rounded-xl p-3">
      <dt className="text-slate-600 flex items-center gap-1"><Icono className="w-3.5 h-3.5 text-marca-azul" />{etiqueta}</dt>
      <dd className="font-bold text-marca-noche">{valor}</dd>
    </div>
  );
}

function BotonGrande({ color, icono: Icono, children, ...props }) {
  const colores = {
    verde: 'bg-marca-verde hover:bg-marca-verde-oscuro text-white',
    ambar: 'bg-amber-400 hover:bg-amber-500 text-slate-950',
    oscuro: 'bg-slate-800 hover:bg-slate-900 text-white',
    // Vista del turno: un solo azul (Mediconnect) en tres pesos
    principal: 'bg-marca-azul hover:bg-marca-azul-oscuro text-white shadow-sm',
    secundario: 'bg-white border-2 border-marca-azul text-marca-azul hover:bg-marca-hielo',
    suave: 'bg-marca-hielo text-marca-azul-oscuro hover:bg-[#e2eef8]',
  };
  return (
    <button type="button" {...props}
      className={`w-full flex items-center justify-center gap-2 font-bold text-lg py-3 rounded-xl transition cursor-pointer disabled:opacity-50 ${colores[color]}`}>
      {Icono && <Icono className="w-5 h-5" />}
      {children}
    </button>
  );
}
