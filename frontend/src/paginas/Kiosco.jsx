import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accessibility, AlertCircle, ArrowRight, Baby, CalendarDays, ChevronLeft, CircleCheck, Clock, Delete, FileText,
  IdCard, Maximize, MessageCircleQuestion, PersonStanding, Pill, Smartphone, Ticket, Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { guardarTokenKiosco, leerTokenKiosco } from '../lib/kiosco';
import { useTitulo } from '../components/Encabezado';

// Pantalla de turnos de la entrada (táctil, también sirve con mouse y teclado).
// El paciente escribe su cédula: si tiene turno virtual se registra su llegada; si no, saca un turno
// con su fórmula. También hay turnos de "Otro trámite" sin fórmula. Nunca muestra nombres,
// códigos ni medicamentos, y vuelve sola al inicio para no dejar datos a la vista.

const SEGUNDOS_INACTIVIDAD = 30;
const SEGUNDOS_RESULTADO = 20;

const TRAMITES = {
  reclamar: { texto: 'Reclamar medicamentos', icono: Pill },
  virtual: { texto: 'Ya tengo turno virtual', icono: Smartphone },
  otro: { texto: 'Otro trámite', icono: MessageCircleQuestion },
};

const PRIORIDADES = [
  ['adulto_mayor', 'Adulto mayor', PersonStanding],
  ['embarazada', 'Mujer en embarazo', Baby],
  ['discapacidad', 'Persona con discapacidad', Accessibility],
];
const TEXTO_PRIORIDAD = Object.fromEntries(PRIORIDADES.map(([v, t]) => [v, t]));

const fechaLarga = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
};
const horaCorta = (d = new Date()) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
const fechaCorta = (d = new Date()) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

// Botones: principal azul, principal verde y suave (azul muy claro)
const base = 'rounded-2xl transition active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const claseAzul = `${base} bg-gradient-to-br from-marca-azul to-marca-azul-oscuro text-white shadow-lg shadow-marca-azul/25 hover:brightness-110`;
const claseVerde = `${base} bg-gradient-to-br from-[#11a196] to-[#0b7a72] text-white shadow-lg shadow-marca-verde/25 hover:brightness-110`;
const claseSuave = `${base} bg-[#e8f2fb] text-marca-noche border border-[#cfe2f3] shadow-sm hover:bg-[#dcebf8]`;

export default function Kiosco() {
  useTitulo('Pantalla de turnos');
  const [token, setToken] = useState(leerTokenKiosco);
  // Con sesión guardada se muestra de una vez; si el servidor la rechaza, pasa a "sin activar"
  const [activa, setActiva] = useState(() => Boolean(leerTokenKiosco()));
  const [paso, setPaso] = useState('inicio');   // inicio | documento | formula | prioridad | listo | aviso
  const [tramite, setTramite] = useState(null); // reclamar | virtual | otro
  const [documento, setDocumento] = useState('');
  const [formulas, setFormulas] = useState([]);
  const [formulaId, setFormulaId] = useState(null);
  const [resultado, setResultado] = useState(null); // { numero, titulo, detalle, tramite, prioridad, fecha }
  const [aviso, setAviso] = useState(null);         // { titulo, detalle, ofrecerOtro }
  const [ocupado, setOcupado] = useState(false);
  const [toque, setToque] = useState(0);            // cada interacción reinicia la cuenta de inactividad

  const reiniciar = useCallback(() => {
    setPaso('inicio');
    setTramite(null);
    setDocumento('');
    setFormulas([]);
    setFormulaId(null);
    setResultado(null);
    setAviso(null);
  }, []);

  const pedir = useCallback(async (ruta, cuerpo) => {
    try {
      return await api(`/kiosco/${ruta}`, { metodo: cuerpo ? 'POST' : 'GET', cuerpo, token });
    } catch (err) {
      if (err.estado === 401) {
        guardarTokenKiosco(null);
        setToken(null);
        setActiva(false);
      }
      throw err;
    }
  }, [token]);

  // ¿La pantalla sigue activada?
  useEffect(() => {
    if (!token) { setActiva(false); return; }
    pedir('estado').then(() => setActiva(true)).catch(() => {});
  }, [token, pedir]);

  // Vuelve sola al inicio si nadie la usa
  useEffect(() => {
    if (paso === 'inicio') return;
    const segundos = paso === 'listo' ? SEGUNDOS_RESULTADO : SEGUNDOS_INACTIVIDAD;
    const t = setTimeout(reiniciar, segundos * 1000);
    return () => clearTimeout(t);
  }, [paso, toque, reiniciar]);

  useEffect(() => {
    const tocar = () => setToque((n) => n + 1);
    window.addEventListener('pointerdown', tocar);
    window.addEventListener('keydown', tocar);
    return () => {
      window.removeEventListener('pointerdown', tocar);
      window.removeEventListener('keydown', tocar);
    };
  }, []);

  const elegir = (t) => {
    setTramite(t);
    setPaso(t === 'otro' ? 'prioridad' : 'documento');
  };
  const mostrarError = (err) => setAviso({ titulo: 'No pudimos completar la solicitud', detalle: err.message });
  const listo = (datos) => {
    setResultado({ fecha: new Date(), prioridad: 'ninguna', ...datos });
    setPaso('listo');
  };

  // 1. Con la cédula: registrar llegada, elegir fórmula o avisar que no hay nada por reclamar
  const buscar = async () => {
    setOcupado(true);
    try {
      const r = await pedir('buscar', { documento });
      if (r.turno) {
        const yaEstaba = ['presente', 'llamado'].includes(r.turno.estado);
        const l = yaEstaba ? { turno: r.turno } : await pedir('llegada', { documento });
        listo({
          numero: l.turno.numero,
          titulo: yaEstaba ? 'Ya está en la fila' : 'Llegada registrada',
          detalle: 'Espere a que su turno aparezca en la pantalla de la sala.',
          tramite: 'virtual',
        });
      } else if (r.formulas.length === 0) {
        setAviso({
          titulo: tramite === 'virtual' ? 'No encontramos un turno virtual' : 'No hay fórmulas por reclamar',
          detalle: 'Revise que el número esté bien escrito. Si su fórmula es nueva, puede que la IPS aún no la haya enviado.',
          ofrecerOtro: true,
        });
        setPaso('aviso');
      } else if (r.formulas.length === 1) {
        setFormulaId(r.formulas[0].id);
        setPaso('prioridad');
      } else {
        setFormulas(r.formulas);
        setPaso('formula');
      }
    } catch (err) {
      if (err.estado !== 401) { mostrarError(err); setPaso('aviso'); }
    } finally {
      setOcupado(false);
    }
  };

  // 2. Sacar el turno (con fórmula u otro trámite)
  const darTurno = async (prioridad) => {
    setOcupado(true);
    try {
      const r = tramite === 'otro'
        ? await pedir('otro', { prioridad })
        : await pedir('turno', { documento, formula_id: formulaId, prioridad });
      listo({
        numero: r.turno.numero,
        titulo: 'Turno generado',
        detalle: 'Su turno ha sido generado correctamente. Espere a que aparezca en la pantalla de la sala.',
        tramite: tramite === 'otro' ? 'otro' : 'reclamar',
        prioridad,
      });
    } catch (err) {
      if (err.estado !== 401) { mostrarError(err); setPaso('aviso'); }
    } finally {
      setOcupado(false);
    }
  };

  if (!activa) {
    return (
      <Marco>
        <Encabezado grande />
        <div className={`${claseSuave} cursor-default mt-10 p-8 text-center max-w-xl mx-auto`}>
          <p className="text-2xl font-bold">Pantalla de turnos sin activar</p>
          <p className="text-lg text-slate-600 mt-3">
            Un administrador debe activarla desde el panel de la farmacia, en <strong>Pantalla de turnos</strong>.
          </p>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      {paso === 'inicio' && (
        <>
          <Encabezado grande />
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mt-8">
            <BotonTramite clase={claseAzul} icono={Pill} titulo="Reclamar medicamentos" detalle="Pedir turno con su fórmula"
              onClick={() => elegir('reclamar')} />
            <BotonTramite clase={claseVerde} icono={Smartphone} titulo="Ya tengo turno virtual" detalle="Registrar que ya llegué"
              onClick={() => elegir('virtual')} />
            <BotonTramite clase={`${claseSuave} sm:col-span-2`} icono={MessageCircleQuestion} centrado
              titulo="Otro trámite" detalle="Preguntas, quejas o información (sin fórmula)" onClick={() => elegir('otro')} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mt-6">
            <Nota icono={IdCard} titulo="Tenga a mano su documento" color="azul">
              Para reclamar medicamentos solo necesita su número de documento.
            </Nota>
            <Nota icono={Accessibility} titulo="Atención preferencial" color="verde">
              Adultos mayores, mujeres en embarazo y personas con discapacidad tienen prioridad.
            </Nota>
          </div>
        </>
      )}

      {paso === 'documento' && (
        <>
          <Encabezado />
          <Teclado tramite={tramite} valor={documento} cambiar={setDocumento} ocupado={ocupado}
            alContinuar={buscar} alVolver={reiniciar} />
        </>
      )}

      {paso === 'formula' && (
        <>
          <Encabezado />
          <Titulo icono={FileText}>¿Qué fórmula va a reclamar?</Titulo>
          <div className="space-y-4 max-w-2xl mx-auto">
            {formulas.map((f) => (
              <button key={f.id} type="button" onClick={() => { setFormulaId(f.id); setPaso('prioridad'); }}
                className={`${claseSuave} w-full px-7 py-6 text-left flex items-center gap-5`}>
                <FileText className="w-10 h-10 text-marca-azul shrink-0" strokeWidth={1.75} />
                <span className="flex-1 font-titulo text-2xl font-bold">Fórmula del {fechaLarga(f.emitida)}</span>
                <span className="text-lg text-slate-600 shrink-0">
                  {f.medicamentos === 1 ? '1 medicamento' : `${f.medicamentos} medicamentos`}
                </span>
              </button>
            ))}
          </div>
          <Volver alVolver={reiniciar} />
        </>
      )}

      {paso === 'prioridad' && (
        <>
          <Encabezado />
          <Titulo icono={Users}>¿Requiere atención preferencial?</Titulo>
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {PRIORIDADES.map(([valor, texto, Icono]) => (
              <button key={valor} type="button" disabled={ocupado} onClick={() => darTurno(valor)}
                className={`${claseSuave} px-5 py-7 flex flex-col items-center gap-3`}>
                <Icono className="w-12 h-12 text-marca-azul" strokeWidth={1.75} />
                <span className="font-titulo text-xl font-bold text-center">{texto}</span>
              </button>
            ))}
          </div>
          <div className="max-w-4xl mx-auto">
            <button type="button" disabled={ocupado} onClick={() => darTurno('ninguna')}
              className={`${claseAzul} w-full mt-5 py-6 font-titulo text-2xl font-bold flex items-center justify-center gap-3`}>
              {ocupado ? 'Generando turno…' : <>No, continuar <ArrowRight className="w-7 h-7" /></>}
            </button>
          </div>
          <Volver alVolver={reiniciar} />
        </>
      )}

      {paso === 'listo' && resultado && (
        <>
          <Encabezado />
          <div className="max-w-3xl mx-auto mt-6 rounded-3xl bg-[#e3f5f2] border border-[#bfe6e0] p-6 sm:p-8">
            <p className="flex items-center justify-center gap-3 font-titulo text-3xl font-bold text-marca-noche">
              <CircleCheck className="w-10 h-10 text-white fill-marca-verde-oscuro" /> {resultado.titulo}
            </p>
            <div className="grid sm:grid-cols-[1fr_1fr] gap-8 items-center mt-6">
              <Tiquete resultado={resultado} />
              <div className="text-center sm:text-left">
                <p className="text-2xl text-slate-700">{resultado.detalle}</p>
                <button type="button" onClick={reiniciar}
                  className={`${claseAzul} mt-6 px-10 py-4 font-titulo text-xl font-bold`}>
                  Terminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {paso === 'aviso' && aviso && (
        <>
          <Encabezado />
          <div className="max-w-2xl mx-auto mt-6 rounded-3xl bg-amber-50 border border-amber-200 p-8 text-center">
            <AlertCircle className="w-14 h-14 mx-auto text-amber-600" />
            <p className="font-titulo text-3xl font-bold text-marca-noche mt-3">{aviso.titulo}</p>
            <p className="text-xl text-slate-700 mt-3">{aviso.detalle}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mt-6">
            <button type="button" onClick={() => { setDocumento(''); setPaso(tramite === 'otro' ? 'inicio' : 'documento'); }}
              className={`${claseSuave} py-5 font-titulo text-xl font-bold`}>
              Intentar de nuevo
            </button>
            {aviso.ofrecerOtro && (
              <button type="button" onClick={() => elegir('otro')} className={`${claseVerde} py-5 font-titulo text-xl font-bold`}>
                Turno de otro trámite
              </button>
            )}
          </div>
          <Volver alVolver={reiniciar} />
        </>
      )}
    </Marco>
  );
}

// Fondo claro con la foto de la sede desvanecida arriba a la derecha y una onda de la marca
function Marco({ children }) {
  const [hora, setHora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const [enCompleta, setEnCompleta] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const cambio = () => setEnCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);
  const completa = () => document.documentElement.requestFullscreen?.().catch(() => {});
  const desvanecer = 'radial-gradient(ellipse 100% 100% at top right, #000 25%, rgba(0,0,0,0.4) 55%, transparent 80%)';

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-white via-[#f2f8fc] to-[#e4f3f6] select-none">
      <img src="/img/pantalla-sede.webp" alt="" aria-hidden="true"
        className="absolute top-0 right-0 w-[55%] max-w-3xl h-[45%] object-cover object-top opacity-30 pointer-events-none"
        style={{ WebkitMaskImage: desvanecer, maskImage: desvanecer }} />
      <svg viewBox="0 0 400 300" aria-hidden="true" className="absolute -top-6 -left-10 w-80 sm:w-[28rem] pointer-events-none">
        <path d="M0,0 H400 C330,40 300,120 210,150 C120,180 60,240 0,300 Z" fill="#14ada2" opacity="0.18" />
        <path d="M0,0 H260 C200,50 150,90 90,120 C50,140 20,170 0,200 Z" fill="#2257c5" opacity="0.12" />
      </svg>
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true"
        className="absolute bottom-0 left-0 w-full h-24 sm:h-32 pointer-events-none">
        <path d="M0,160 L0,70 C240,140 520,150 760,110 C1000,70 1220,40 1440,90 L1440,160 Z" fill="#2257c5" opacity="0.10" />
        <path d="M0,160 L0,120 C300,160 640,150 900,130 C1140,110 1300,100 1440,120 L1440,160 Z" fill="#14ada2" opacity="0.16" />
      </svg>

      <p className="absolute top-5 right-6 z-10 rounded-full bg-white/85 border border-slate-200 px-4 py-1.5 text-xl font-bold text-marca-noche tabular-nums shadow-sm">
        {horaCorta(hora)}
      </p>

      <main className="relative z-10 min-h-dvh flex flex-col justify-center px-5 sm:px-10 py-10">
        <div className="w-full max-w-5xl mx-auto">{children}</div>
      </main>

      {!enCompleta && document.documentElement.requestFullscreen && (
        <button type="button" onClick={completa}
          className="absolute bottom-3 right-4 z-10 flex items-center gap-2 text-sm text-slate-500 hover:text-marca-noche px-3 py-2 cursor-pointer">
          <Maximize className="w-4 h-4" /> Pantalla completa
        </button>
      )}
    </div>
  );
}

// Logo y saludo. "grande" en el inicio; compacto en los demás pasos.
function Encabezado({ grande = false }) {
  const logo = (
    <span className="flex items-center justify-center gap-3">
      <img src="/img/logo-simbolo.png" alt="" className={grande ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-12 h-12'} />
      <span className={`font-titulo font-extrabold tracking-tight ${grande ? 'text-5xl sm:text-6xl' : 'text-3xl'}`}>
        <span className="text-marca-azul">Medi</span><span className="text-marca-verde">connect</span>
      </span>
    </span>
  );
  if (!grande) return <div className="mb-6">{logo}</div>;
  return (
    <div className="text-center">
      {logo}
      <p className="font-titulo text-2xl sm:text-3xl font-bold text-marca-noche mt-5 flex items-center justify-center gap-3">
        <Rayitas /> Bienvenido a Mediconnect <Rayitas espejo />
      </p>
      <div className="flex items-center justify-center gap-5 mt-4">
        <span className="relative shrink-0 hidden sm:block" aria-hidden="true">
          <Users className="w-16 h-16 text-marca-azul" strokeWidth={1.5} />
          <Ticket className="w-9 h-9 text-marca-verde-oscuro absolute -bottom-2 -right-3 bg-[#f2f8fc] rounded" strokeWidth={1.75} />
        </span>
        <h1 className="font-titulo text-5xl sm:text-6xl font-extrabold text-marca-noche">Saque su turno</h1>
      </div>
      <div className="w-24 h-1.5 rounded-full bg-marca-verde mx-auto mt-4" />
    </div>
  );
}

// Tres trazos cortos de adorno junto al saludo
function Rayitas({ espejo = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`w-7 h-7 text-marca-verde ${espejo ? '-scale-x-100' : ''}`}>
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M14 3 L16 8" /><path d="M5 9 L10 12" /><path d="M4 18 L9 18" />
      </g>
    </svg>
  );
}

function Titulo({ icono: Icono, children }) {
  return (
    <h1 className="font-titulo text-3xl sm:text-4xl font-extrabold text-marca-noche text-center mb-8 flex items-center justify-center gap-3">
      <Icono className="w-10 h-10 text-marca-azul shrink-0" strokeWidth={1.75} /> {children}
    </h1>
  );
}

function BotonTramite({ clase, icono: Icono, titulo, detalle, onClick, centrado = false }) {
  return (
    <button type="button" onClick={onClick}
      className={`${clase} px-7 py-6 sm:py-7 flex items-center gap-5 text-left ${centrado ? 'justify-center' : ''}`}>
      <Icono className="w-14 h-14 shrink-0" strokeWidth={1.5} />
      <span>
        <span className="block font-titulo text-2xl sm:text-3xl font-bold leading-tight">{titulo}</span>
        <span className="block text-lg opacity-85 mt-1">{detalle}</span>
      </span>
    </button>
  );
}

function Nota({ icono: Icono, titulo, color, children }) {
  const estilos = color === 'verde' ? 'bg-[#e3f5f2] border-[#bfe6e0]' : 'bg-[#e8f2fb] border-[#cfe2f3]';
  return (
    <div className={`rounded-2xl border p-5 flex gap-4 ${estilos}`}>
      <Icono className={`w-10 h-10 shrink-0 ${color === 'verde' ? 'text-marca-verde-oscuro' : 'text-marca-azul'}`} strokeWidth={1.75} />
      <div>
        <p className="font-titulo text-lg font-bold text-marca-noche">{titulo}</p>
        <p className="text-base text-slate-600 mt-0.5">{children}</p>
      </div>
    </div>
  );
}

function Volver({ alVolver }) {
  return (
    <div className="text-center mt-8">
      <button type="button" onClick={alVolver}
        className="inline-flex items-center gap-1 text-lg font-semibold text-marca-azul hover:text-marca-noche px-4 py-2 cursor-pointer">
        <ChevronLeft className="w-5 h-5" /> Volver al inicio
      </button>
    </div>
  );
}

// Tiquete del turno, con el borde de abajo dentado como el papel de un dispensador
function Tiquete({ resultado }) {
  const dientes = 'conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% / 18px 100%';
  const { icono: Icono, texto } = TRAMITES[resultado.tramite] ?? TRAMITES.reclamar;
  return (
    <div className="mx-auto w-full max-w-xs" style={{ filter: 'drop-shadow(0 6px 10px rgba(13,34,89,0.18))' }}>
      <div className="bg-white px-6 pt-5 pb-8 text-center" style={{ WebkitMask: dientes, mask: dientes }}>
        <p className="flex items-center justify-center gap-2 pb-3 border-b border-slate-200">
          <img src="/img/logo-simbolo.png" alt="" className="w-7 h-7" />
          <span className="font-titulo font-extrabold text-marca-noche">Mediconnect</span>
        </p>
        <p className="font-titulo text-xl font-bold text-marca-noche mt-3">Turno</p>
        <p className="font-titulo text-6xl font-extrabold text-marca-noche leading-none mt-1 tabular-nums" aria-live="polite">
          {resultado.numero}
        </p>
        <p className="inline-flex items-center gap-1.5 mt-3 rounded-md bg-[#e8f2fb] px-3 py-1 text-sm font-bold text-marca-azul">
          <Icono className="w-4 h-4" /> {texto}
        </p>
        {resultado.prioridad !== 'ninguna' && (
          <p className="mt-2 text-sm font-bold text-marca-verde-oscuro">Preferencial · {TEXTO_PRIORIDAD[resultado.prioridad]}</p>
        )}
        <div className="mt-4 space-y-1 text-sm text-slate-600 inline-block text-left">
          <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> {fechaCorta(resultado.fecha)}</p>
          <p className="flex items-center gap-2"><Clock className="w-4 h-4" /> {horaCorta(resultado.fecha)}</p>
        </div>
      </div>
    </div>
  );
}

// Teclado numérico en pantalla; también acepta el teclado físico
function Teclado({ tramite, valor, cambiar, ocupado, alContinuar, alVolver }) {
  const valido = /^\d{5,20}$/.test(valor);
  const ref = useRef({ valido, ocupado, alContinuar });
  ref.current = { valido, ocupado, alContinuar };
  const { icono: IconoTramite, texto } = TRAMITES[tramite] ?? TRAMITES.reclamar;

  // Actualización en función del valor anterior: no se pierden dígitos aunque se teclee muy rápido
  const tecla = useCallback((t) => {
    cambiar((v) => (t === 'borrar' ? v.slice(0, -1) : v.length < 15 ? v + t : v));
  }, [cambiar]);

  useEffect(() => {
    const alPresionar = (e) => {
      if (/^\d$/.test(e.key)) tecla(e.key);
      else if (e.key === 'Backspace') tecla('borrar');
      else if (e.key === 'Enter' && ref.current.valido && !ref.current.ocupado) ref.current.alContinuar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [tecla]);

  const claseTecla = 'h-[4.5rem] rounded-xl bg-white border border-[#cfe2f3] text-marca-noche font-titulo text-3xl font-bold shadow-sm '
    + 'hover:bg-[#f2f8fc] active:scale-95 transition cursor-pointer';
  return (
    <div className="max-w-lg mx-auto rounded-3xl bg-[#e8f2fb]/80 border border-[#cfe2f3] p-6 sm:p-8">
      <p className="inline-flex items-center gap-2 rounded-full bg-white border border-[#cfe2f3] px-4 py-1.5 text-base font-semibold text-marca-azul">
        <IconoTramite className="w-5 h-5" /> {texto}
      </p>
      <p className="flex items-center gap-3 font-titulo text-2xl font-bold text-marca-noche mt-4">
        <IdCard className="w-9 h-9 text-marca-azul" strokeWidth={1.75} /> Número de documento
      </p>
      <div className="mt-3 bg-white rounded-xl border-2 border-[#cfe2f3] h-16 flex items-center gap-3 px-4" aria-live="polite">
        <IdCard className="w-6 h-6 text-slate-400 shrink-0" />
        <span className="font-titulo text-3xl font-bold tracking-widest tabular-nums text-marca-noche truncate">
          {valor || <span className="text-slate-400 text-lg font-normal tracking-normal font-sans">Ingrese su número de documento</span>}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button key={n} type="button" onClick={() => tecla(n)} className={claseTecla}>{n}</button>
        ))}
        <button type="button" onClick={() => cambiar('')} className={`${claseTecla} text-base`}>Borrar todo</button>
        <button type="button" onClick={() => tecla('0')} className={claseTecla}>0</button>
        <button type="button" onClick={() => tecla('borrar')} aria-label="Borrar un número"
          className={`${claseTecla} flex items-center justify-center`}><Delete className="w-8 h-8" /></button>
      </div>
      <button type="button" onClick={alContinuar} disabled={!valido || ocupado}
        className={`${claseAzul} w-full mt-5 h-16 font-titulo text-2xl font-bold flex items-center justify-center gap-3`}>
        {ocupado ? 'Buscando…' : <>Continuar <ArrowRight className="w-7 h-7" /></>}
      </button>
      <Volver alVolver={alVolver} />
    </div>
  );
}
