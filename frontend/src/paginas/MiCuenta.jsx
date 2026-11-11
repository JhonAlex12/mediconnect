import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Bike, CalendarClock, CheckCircle2, ClipboardList, FilePlus2, History, LogOut, MailWarning, MapPin, Package, Save, Ticket, Truck,
  UserRound, XCircle,
} from 'lucide-react';
import SitioPublico from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { Aviso, useAccion } from '../components/farmacia/comunes';
import { CobroFormula, ESTADO_MEDICAMENTO, fechaLarga, pesos } from '../components/paciente/VistaPaciente';
import CamposPersonales, { Campo, Seccion, claseInput, datosDesdeCuenta } from '../components/cuenta/CamposPersonales';
import { useCuenta } from '../lib/cuenta';
import CampoClave from '../components/CampoClave';
import { totalDomicilio, useCostoEnvio } from '../lib/costoEnvio';

const PESTANAS = [
  ['formulas', 'Mis fórmulas', ClipboardList],
  ['domicilios', 'Domicilios', Truck],
  ['datos', 'Mis datos', UserRound],
  ['historial', 'Historial', History],
];

export const ESTADOS_DOMICILIO = {
  recibido: { texto: 'Solicitud recibida', clase: 'bg-blue-100 text-blue-800' },
  en_preparacion: { texto: 'En preparación', clase: 'bg-amber-100 text-amber-900' },
  en_camino: { texto: 'En camino', clase: 'bg-marca-verde-claro text-marca-verde-oscuro' },
  entregado: { texto: 'Entregado', clase: 'bg-emerald-100 text-emerald-800' },
  cancelado: { texto: 'Cancelado', clase: 'bg-slate-200 text-slate-600' },
};
// Por ahora los domicilios solo se entregan en Cúcuta (el backend también lo valida)
export const CIUDAD_DOMICILIO = 'Cúcuta';
const esCucuta = (c) => /^(san jose de )?cucuta$/.test(
  (c ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());

const PASOS = ['recibido', 'en_preparacion', 'en_camino', 'entregado'];
const ACTIVOS = ['recibido', 'en_preparacion', 'en_camino'];

const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function MiCuenta() {
  useTitulo('Mi cuenta');
  const { cuenta, verificando, cerrarSesion, apiCuenta, recargarCuenta } = useCuenta();
  const { hash, state } = useLocation();
  const navegar = useNavigate();
  const pestana = PESTANAS.some(([id]) => `#${id}` === hash) ? hash.slice(1) : 'formulas';

  const [formulas, setFormulas] = useState(null);
  const [domicilios, setDomicilios] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [f, d] = await Promise.all([apiCuenta('/formulas'), apiCuenta('/domicilios')]);
      setFormulas(f.formulas);
      setDomicilios(d.domicilios);
      setError(null);
    } catch (err) {
      setError({ tipo: 'error', texto: err.message });
    }
  }, [apiCuenta]);

  // Se recargan al cambiar de cuenta, no cada vez que se actualizan sus datos
  const idCuenta = cuenta?.id;
  useEffect(() => {
    if (idCuenta) cargar();
  }, [idCuenta, cargar]);

  // Si confirmó el correo en otra pestaña o en el celular, al volver a esta se actualiza sola
  const sinVerificar = cuenta && !cuenta.correo_verificado;
  useEffect(() => {
    if (!sinVerificar) return undefined;
    const revisar = () => {
      if (document.visibilityState === 'visible') recargarCuenta().catch(() => {});
    };
    window.addEventListener('focus', revisar);
    document.addEventListener('visibilitychange', revisar);
    const cada = setInterval(revisar, 20000);
    return () => {
      window.removeEventListener('focus', revisar);
      document.removeEventListener('visibilitychange', revisar);
      clearInterval(cada);
    };
  }, [sinVerificar, recargarCuenta]);

  // Anuncio cuando el correo pasa de "sin confirmar" a "verificado" mientras la página está abierta
  const estabaSinVerificar = useRef(false);
  const [recienVerificado, setRecienVerificado] = useState(false);
  useEffect(() => {
    if (!cuenta) return;
    if (estabaSinVerificar.current && cuenta.correo_verificado) setRecienVerificado(true);
    estabaSinVerificar.current = !cuenta.correo_verificado;
  }, [cuenta]);
  // También al llegar desde la página de confirmación (una sola vez: se borra de la historia)
  useEffect(() => {
    if (!state?.correoVerificado) return;
    setRecienVerificado(true);
    navegar({ hash }, { replace: true, state: null });
  }, [state, hash, navegar]);
  // El anuncio se va solo después de unos segundos
  useEffect(() => {
    if (!recienVerificado) return undefined;
    const t = setTimeout(() => setRecienVerificado(false), 10000);
    return () => clearTimeout(t);
  }, [recienVerificado]);

  if (verificando) {
    return <SitioPublico><p className="text-center text-slate-500 py-24">Cargando tu cuenta…</p></SitioPublico>;
  }
  if (!cuenta) return <Navigate to="/registro" replace />;

  const salir = () => {
    cerrarSesion();
    navegar('/');
  };

  return (
    <SitioPublico>
      <section className="bg-marca-hielo border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 pt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">
              <Link to="/" className="hover:text-marca-azul">Inicio</Link> <span aria-hidden="true">›</span> Mi cuenta
            </p>
            <h1 className="font-titulo text-3xl font-extrabold text-marca-noche">Hola, {cuenta.nombres.split(' ')[0]}</h1>
            <p className="text-slate-600">{cuenta.tipo_documento} {cuenta.documento}</p>
          </div>
          <button type="button" onClick={salir}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-red-700 px-3 py-2 rounded cursor-pointer">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
        <nav className="max-w-5xl mx-auto px-4 mt-6 flex gap-1 overflow-x-auto" aria-label="Secciones de mi cuenta">
          {PESTANAS.map(([id, texto, Icono]) => (
            <Link key={id} to={`#${id}`} replace
              className={`flex items-center gap-2 px-4 py-3 font-semibold text-[15px] border-b-4 whitespace-nowrap transition ${
                pestana === id ? 'border-marca-azul text-marca-azul bg-white rounded-t' : 'border-transparent text-slate-600 hover:text-marca-azul'}`}>
              <Icono className="w-4 h-4" /> {texto}
            </Link>
          ))}
        </nav>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {!cuenta.correo_verificado && <ConfirmaTuCorreo correo={cuenta.correo} />}
        {recienVerificado && (
          <div role="status" className="bg-emerald-50 border-l-4 border-emerald-600 rounded-r-lg p-4 flex items-start gap-3">
            <BadgeCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-marca-noche">¡Correo verificado!</p>
              <p className="text-sm text-slate-700">{cuenta.correo} quedó confirmado. Ya puedes pedir tus medicamentos a domicilio.</p>
            </div>
            <button type="button" onClick={() => setRecienVerificado(false)} aria-label="Cerrar aviso"
              className="text-slate-500 hover:text-slate-800 cursor-pointer">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
        <Aviso aviso={error} />
        {pestana === 'formulas' && <MisFormulas formulas={formulas} domicilios={domicilios} recargar={cargar} />}
        {pestana === 'domicilios' && <MisDomicilios domicilios={domicilios} recargar={cargar} />}
        {pestana === 'datos' && <MisDatos />}
        {pestana === 'historial' && <Historial />}
      </div>
    </SitioPublico>
  );
}

// Aviso mientras el correo no esté confirmado, con opción de reenviar el enlace
function ConfirmaTuCorreo({ correo }) {
  const { apiCuenta } = useCuenta();
  const { ocupado, aviso, ejecutar } = useAccion();
  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <MailWarning className="w-6 h-6 text-amber-600 shrink-0" />
        <div>
          <p className="font-bold text-marca-noche">Confirma tu correo</p>
          <p className="text-sm text-slate-700">
            Te enviamos un enlace a <strong>{correo}</strong>. Ábrelo para activar los domicilios.
            Si no lo ves, revisa la carpeta de spam.
          </p>
        </div>
      </div>
      <button type="button" disabled={ocupado}
        onClick={() => ejecutar(() => apiCuenta('/reenviar-confirmacion', { metodo: 'POST' }), `Enviamos un enlace nuevo a ${correo}`)}
        className="ml-9 text-sm font-bold text-marca-azul hover:underline cursor-pointer disabled:opacity-50">
        {ocupado ? 'Enviando…' : 'Reenviar el correo'}
      </button>
      <div className="ml-9"><Aviso aviso={aviso} /></div>
    </div>
  );
}

// ============================================================
// Mis fórmulas: agregar con el código, ver disponibilidad y pedir domicilio
// ============================================================
function MisFormulas({ formulas, domicilios, recargar }) {
  const { apiCuenta } = useCuenta();
  const [codigo, setCodigo] = useState('');
  const [pidiendo, setPidiendo] = useState(null); // código de la fórmula con el formulario de domicilio abierto
  const { ocupado, aviso, ejecutar } = useAccion(recargar);

  const agregar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => apiCuenta('/formulas', { metodo: 'POST', cuerpo: { codigo: codigo.trim().toUpperCase() } }),
      (r) => `Fórmula ${r.formula.codigo} agregada a tu cuenta`
    );
    if (ok) setCodigo('');
  };

  return (
    <>
      <form onSubmit={agregar} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <h2 className="font-titulo text-xl font-extrabold text-marca-noche flex items-center gap-2">
          <FilePlus2 className="w-5 h-5 text-marca-verde" /> Agregar una fórmula
        </h2>
        <p className="text-slate-600 text-sm mt-1">
          Escribe el código que te entregó la IPS. Solo se pueden agregar fórmulas a nombre de tu documento.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="F-2026-0001" required
            aria-label="Código de la fórmula" className={`${claseInput} sm:max-w-xs uppercase`} />
          <button type="submit" disabled={ocupado}
            className="bg-marca-azul hover:bg-marca-azul-oscuro disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded cursor-pointer">
            {ocupado ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
        <div className="mt-3"><Aviso aviso={aviso} /></div>
      </form>

      {formulas === null ? (
        <p className="text-slate-500">Cargando tus fórmulas…</p>
      ) : formulas.length === 0 ? (
        <p className="text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg p-8">
          Aún no tienes fórmulas en tu cuenta. Agrega la primera con su código.
        </p>
      ) : (
        formulas.map((f) => {
          const domicilio = domicilios?.find((d) => d.codigo === f.codigo && ACTIVOS.includes(d.estado));
          return (
            <TarjetaFormula key={f.codigo} formula={f} domicilio={domicilio}
              abierto={pidiendo === f.codigo}
              alPedir={() => setPidiendo(pidiendo === f.codigo ? null : f.codigo)}
              alTerminar={async () => { setPidiendo(null); await recargar(); }} />
          );
        })
      )}
    </>
  );
}

function TarjetaFormula({ formula: f, domicilio, abierto, alPedir, alTerminar }) {
  const { cuenta } = useCuenta();
  const pendientes = f.medicamentos.filter((m) => m.cantidad_pendiente > 0);
  const completa = pendientes.length === 0;
  const puedePedir = !f.vencida && !completa && !domicilio && !pendientes.every((m) => m.estado === 'agotado');

  return (
    <article className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="font-titulo text-lg font-extrabold text-marca-noche">Fórmula {f.codigo}</h3>
          <p className="text-sm text-slate-600 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4" />
            {f.vencida ? `Venció el ${fechaLarga(f.fecha_limite)}`
              : `Reclamar hasta el ${fechaLarga(f.fecha_limite)} (${f.dias_restantes === 0 ? 'hoy' : `${f.dias_restantes} días`})`}
          </p>
        </div>
        {completa ? (
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">Entregada completa</span>
        ) : f.vencida ? (
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-red-100 text-red-800">Vencida</span>
        ) : f.alerta ? (
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900">Vence pronto</span>
        ) : null}
      </header>

      <ul className="divide-y divide-slate-100">
        {f.medicamentos.map((m) => {
          const e = ESTADO_MEDICAMENTO[m.estado];
          return (
            <li key={m.medicamento_id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold text-slate-800">{m.nombre}</span>{' '}
                <span className="text-slate-500 text-sm">{m.presentacion}</span>
                <span className="block text-sm text-slate-500">
                  {m.cantidad_pendiente > 0 ? `Pendiente: ${m.cantidad_pendiente} de ${m.cantidad_formulada}` : `${m.cantidad_formulada} entregadas`}
                </span>
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${e.clase}`}>{e.texto}</span>
            </li>
          );
        })}
      </ul>

      {!completa && !f.vencida && (
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 space-y-3">
          <CobroFormula cobro={f.cobro} />
          {domicilio ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-marca-verde-oscuro">
              <Truck className="w-5 h-5" /> Domicilio en curso: {ESTADOS_DOMICILIO[domicilio.estado].texto}.{' '}
              <Link to="#domicilios" className="underline">Ver seguimiento</Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {puedePedir && !cuenta.correo_verificado && (
                <p className="w-full text-sm text-slate-600 flex items-center gap-1.5">
                  <MailWarning className="w-4 h-4 text-amber-600" /> Confirma tu correo para pedir esta fórmula a domicilio.
                </p>
              )}
              {puedePedir && cuenta.correo_verificado && (
                <button type="button" onClick={alPedir}
                  className="flex items-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro text-white font-bold px-4 py-2.5 rounded cursor-pointer">
                  <Bike className="w-5 h-5" /> {abierto ? 'Cerrar' : 'Pedir a domicilio'}
                </button>
              )}
              <Link to={`/paciente?codigo=${encodeURIComponent(f.codigo)}&documento=${encodeURIComponent(cuenta.documento)}`}
                className="flex items-center gap-2 border-2 border-marca-azul text-marca-azul hover:bg-marca-hielo font-bold px-4 py-2 rounded">
                <Ticket className="w-5 h-5" /> Reclamar en la farmacia (turno)
              </Link>
            </div>
          )}
          {abierto && <FormularioDomicilio formula={f} alTerminar={alTerminar} />}
        </div>
      )}
    </article>
  );
}

function FormularioDomicilio({ formula, alTerminar }) {
  const { cuenta, apiCuenta } = useCuenta();
  // Si la dirección de la cuenta es de Cúcuta se propone; si no, se escribe una nueva
  const vivoEnCucuta = esCucuta(cuenta.ciudad);
  const [d, setD] = useState({
    direccion: vivoEnCucuta ? cuenta.direccion ?? '' : '', barrio: vivoEnCucuta ? cuenta.barrio ?? '' : '',
    ciudad: CIUDAD_DOMICILIO, telefono: cuenta.celular ?? '', recibe: '', indicaciones: '',
  });
  const { ocupado, aviso, ejecutar } = useAccion();
  const cambiar = (k) => (e) => setD((v) => ({ ...v, [k]: e.target.value }));
  const cuota = formula.cobro?.valor > 0 && !formula.cobro?.pagado ? formula.cobro.valor : 0;
  const envio = useCostoEnvio();

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => apiCuenta('/domicilios', { metodo: 'POST', cuerpo: { codigo: formula.codigo, ...d } }),
      'Solicitud enviada'
    );
    if (ok) await alTerminar();
  };

  return (
    <form onSubmit={enviar} className="bg-white border border-slate-200 rounded p-4 space-y-4">
      <p className="font-bold text-marca-noche">¿A dónde te llevamos los medicamentos?</p>
      <p className="flex items-start gap-2 text-sm bg-marca-hielo rounded p-3 text-slate-700">
        <MapPin className="w-4 h-4 mt-0.5 text-marca-azul shrink-0" />
        Por ahora hacemos domicilios únicamente en {CIUDAD_DOMICILIO}.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo etiqueta="Dirección" id="dom-direccion" className="sm:col-span-2">
          <input id="dom-direccion" value={d.direccion} onChange={cambiar('direccion')} required className={claseInput} />
        </Campo>
        <Campo etiqueta="Barrio" id="dom-barrio">
          <input id="dom-barrio" value={d.barrio} onChange={cambiar('barrio')} required className={claseInput} />
        </Campo>
        <Campo etiqueta="Ciudad" id="dom-ciudad">
          <input id="dom-ciudad" value={d.ciudad} readOnly className={`${claseInput} bg-slate-100 text-slate-600`} />
        </Campo>
        <Campo etiqueta="Teléfono de contacto" id="dom-telefono">
          <input id="dom-telefono" type="tel" inputMode="numeric" value={d.telefono} onChange={cambiar('telefono')} required className={claseInput} />
        </Campo>
        <Campo etiqueta="¿Quién recibe?" id="dom-recibe" opcional ayuda="Si no eres tú, debe presentar tu documento">
          <input id="dom-recibe" value={d.recibe} onChange={cambiar('recibe')} className={claseInput} />
        </Campo>
        <Campo etiqueta="Indicaciones" id="dom-indicaciones" opcional className="sm:col-span-2">
          <textarea id="dom-indicaciones" value={d.indicaciones} onChange={cambiar('indicaciones')} rows={2} maxLength={300}
            placeholder="Torre, apartamento, punto de referencia…" className={claseInput} />
        </Campo>
      </div>
      {envio !== null && (
        <div className="bg-slate-50 border border-slate-200 rounded p-4 text-sm">
          <p className="font-bold text-marca-noche mb-2">Pagas al recibir</p>
          <dl className="space-y-1">
            {cuota > 0 && (
              <div className="flex justify-between"><dt className="text-slate-600">Cuota moderadora</dt><dd>{pesos(cuota)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-slate-600">Costo de envío</dt><dd>{pesos(envio)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold text-marca-noche">
              <dt>Total</dt><dd>{pesos(cuota + envio)}</dd>
            </div>
          </dl>
          <p className="text-slate-500 mt-2">En efectivo, transferencia o datáfono.</p>
        </div>
      )}
      <p className="text-sm text-slate-600">La farmacia te llamará para confirmar la hora de entrega.</p>
      <Aviso aviso={aviso} />
      <button type="submit" disabled={ocupado}
        className="flex items-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded cursor-pointer">
        <CheckCircle2 className="w-5 h-5" /> {ocupado ? 'Enviando…' : 'Confirmar domicilio'}
      </button>
    </form>
  );
}

// ============================================================
// Domicilios: seguimiento del estado
// ============================================================
function MisDomicilios({ domicilios, recargar }) {
  const { apiCuenta } = useCuenta();
  const { ocupado, aviso, ejecutar } = useAccion(recargar);

  if (domicilios === null) return <p className="text-slate-500">Cargando…</p>;
  if (domicilios.length === 0) {
    return (
      <p className="text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg p-8">
        No has pedido domicilios. Desde <Link to="#formulas" className="text-marca-azul font-semibold underline">Mis fórmulas</Link>{' '}
        elige una fórmula y pulsa “Pedir a domicilio”.
      </p>
    );
  }

  return (
    <>
      <Aviso aviso={aviso} />
      {domicilios.map((d) => {
        const e = ESTADOS_DOMICILIO[d.estado];
        const paso = PASOS.indexOf(d.estado);
        return (
          <article key={d.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-titulo text-lg font-extrabold text-marca-noche">Fórmula {d.codigo}</h3>
                <p className="text-sm text-slate-600">Pedido el {fechaHora(d.creado_en)} · {d.direccion}{d.barrio ? `, ${d.barrio}` : ''}, {d.ciudad}</p>
              </div>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${e.clase}`}>{e.texto}</span>
            </div>

            {d.estado !== 'cancelado' && (
              <ol className="grid grid-cols-4 gap-1" aria-label="Avance del domicilio">
                {PASOS.map((p, i) => (
                  <li key={p} className="text-center">
                    <span className={`block h-2 rounded-full ${i <= paso ? 'bg-marca-verde' : 'bg-slate-200'}`} />
                    <span className={`block text-xs mt-1.5 ${i <= paso ? 'text-marca-noche font-semibold' : 'text-slate-400'}`}>
                      {ESTADOS_DOMICILIO[p].texto}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {!['entregado', 'cancelado'].includes(d.estado) && (
              <p className="text-sm text-slate-700">
                Pagas al recibir: <strong>{pesos(totalDomicilio(d).total)}</strong>
                <span className="text-slate-500">
                  {' '}({totalDomicilio(d).cuota > 0 ? `cuota ${pesos(totalDomicilio(d).cuota)} + ` : ''}envío {pesos(d.costo_envio)})
                </span>
              </p>
            )}

            {d.nota_farmacia && (
              <p className="flex items-start gap-2 bg-marca-hielo rounded p-3 text-sm text-slate-700">
                <Package className="w-4 h-4 mt-0.5 text-marca-azul shrink-0" />
                <span><strong>Mensaje de la farmacia:</strong> {d.nota_farmacia}</span>
              </p>
            )}

            {d.estado === 'recibido' && (
              <button type="button" disabled={ocupado}
                onClick={() => {
                  if (window.confirm('¿Cancelar este domicilio?')) {
                    ejecutar(() => apiCuenta(`/domicilios/${d.id}/cancelar`, { metodo: 'POST' }), 'Domicilio cancelado');
                  }
                }}
                className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline cursor-pointer disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Cancelar domicilio
              </button>
            )}
          </article>
        );
      })}
    </>
  );
}

// ============================================================
// Mis datos: editar datos personales y cambiar la contraseña
// ============================================================
function MisDatos() {
  const { cuenta, setCuenta, apiCuenta } = useCuenta();
  const [datos, setDatos] = useState(() => datosDesdeCuenta(cuenta));
  const [claves, setClaves] = useState({ clave_actual: '', clave_nueva: '' });
  const { ocupado, aviso, ejecutar } = useAccion();
  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  const guardar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(async () => {
      const r = await apiCuenta('/yo', { metodo: 'PUT', cuerpo: { ...datos, ...(claves.clave_nueva ? claves : {}) } });
      setCuenta(r.cuenta);
      return r;
    }, 'Tus datos quedaron guardados');
    if (ok) setClaves({ clave_actual: '', clave_nueva: '' });
  };

  return (
    <form onSubmit={guardar} className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 sm:p-8 space-y-8">
      <p className="text-sm text-slate-600">
        El tipo y número de documento no se pueden cambiar. Si están errados, comunícate con la farmacia.
      </p>
      <CamposPersonales datos={datos} cambiar={cambiar} />
      <Seccion titulo="Cambiar contraseña (opcional)">
        <Campo etiqueta="Contraseña actual" id="clave_actual">
          <CampoClave id="clave_actual" autoComplete="current-password" valor={claves.clave_actual}
            cambiar={(v) => setClaves((c) => ({ ...c, clave_actual: v }))}
            required={Boolean(claves.clave_nueva)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Contraseña nueva" id="clave_nueva" ayuda="Mínimo 8 caracteres, con letras y números">
          <CampoClave id="clave_nueva" autoComplete="new-password" valor={claves.clave_nueva}
            cambiar={(v) => setClaves((c) => ({ ...c, clave_nueva: v }))} className={claseInput} />
        </Campo>
      </Seccion>
      <Aviso aviso={aviso} />
      <button type="submit" disabled={ocupado}
        className="flex items-center gap-2 bg-marca-azul hover:bg-marca-azul-oscuro disabled:opacity-60 text-white font-bold px-6 py-3 rounded cursor-pointer">
        <Save className="w-5 h-5" /> {ocupado ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

// ============================================================
// Historial: actividad de la cuenta
// ============================================================
const ACCIONES = {
  crear_cuenta: 'Creaste tu cuenta',
  iniciar_sesion: 'Iniciaste sesión',
  agregar_formula: 'Agregaste la fórmula',
  solicitar_domicilio: 'Pediste domicilio de la fórmula',
  cancelar_domicilio: 'Cancelaste un domicilio',
  cambiar_datos: 'Actualizaste tus datos',
  cambiar_datos_y_clave: 'Actualizaste tus datos y tu contraseña',
  cambiar_correo: 'Cambiaste tu correo a',
  confirmar_correo: 'Confirmaste tu correo',
  reenviar_confirmacion: 'Pediste un nuevo enlace de confirmación',
};

function Historial() {
  const { apiCuenta } = useCuenta();
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiCuenta('/historial').then((d) => setFilas(d.historial)).catch((e) => setError({ tipo: 'error', texto: e.message }));
  }, [apiCuenta]);

  if (error) return <Aviso aviso={error} />;
  if (!filas) return <p className="text-slate-500">Cargando…</p>;

  return (
    <ul className="bg-white border border-slate-200 rounded-lg shadow-sm divide-y divide-slate-100">
      {filas.map((h, i) => (
        <li key={i} className="px-5 py-3 flex flex-wrap justify-between gap-2">
          <span className="text-slate-800">
            {ACCIONES[h.accion] ?? h.accion}
            {h.detalle && h.accion !== 'cancelar_domicilio' ? <strong> {h.detalle}</strong> : null}
          </span>
          <span className="text-sm text-slate-500">{fechaHora(h.fecha)}</span>
        </li>
      ))}
    </ul>
  );
}
