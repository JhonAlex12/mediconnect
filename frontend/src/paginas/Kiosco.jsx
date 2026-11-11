import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Delete, Maximize } from 'lucide-react';
import { api } from '../lib/api';
import { guardarTokenKiosco, leerTokenKiosco } from '../lib/kiosco';
import { useTitulo } from '../components/Encabezado';

// Pantalla de turnos de la entrada (táctil, también sirve con mouse y teclado).
// El paciente escribe su cédula: si tiene turno virtual se registra su llegada; si no, saca un turno
// con su fórmula. También hay turnos de "Otro trámite" sin fórmula. Nunca muestra nombres,
// códigos ni medicamentos, y vuelve sola al inicio para no dejar datos a la vista.
// Estilo de kiosco institucional: encabezado blanco, cuerpo azul liso y botones blancos rectos.

const SEGUNDOS_INACTIVIDAD = 30;
const SEGUNDOS_RESULTADO = 15;

const PRIORIDADES = [
  ['adulto_mayor', 'Adulto mayor'],
  ['embarazada', 'Mujer en embarazo'],
  ['discapacidad', 'Persona con discapacidad'],
];

const fechaLarga = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
};
const horaCorta = (d = new Date()) => d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

// Botón blanco de kiosco: rectangular, texto en mayúsculas
const claseBoton = 'bg-white text-marca-noche font-bold uppercase tracking-wide rounded-md shadow-[0_3px_0_rgba(13,34,89,0.35)] '
  + 'hover:bg-marca-hielo active:translate-y-0.5 active:shadow-none transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const claseBotonVerde = 'bg-marca-verde-oscuro text-white font-bold uppercase tracking-wide rounded-md shadow-[0_3px_0_rgba(0,0,0,0.25)] '
  + 'hover:bg-[#0b6f68] active:translate-y-0.5 active:shadow-none transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export default function Kiosco() {
  useTitulo('Pantalla de turnos');
  const [token, setToken] = useState(leerTokenKiosco);
  // Con sesión guardada se muestra de una vez; si el servidor la rechaza, pasa a "sin activar"
  const [activa, setActiva] = useState(() => Boolean(leerTokenKiosco()));
  const [paso, setPaso] = useState('inicio');  // inicio | documento | formula | prioridad | listo | aviso
  const [modo, setModo] = useState('formula'); // formula | otro
  const [documento, setDocumento] = useState('');
  const [formulas, setFormulas] = useState([]);
  const [formulaId, setFormulaId] = useState(null);
  const [resultado, setResultado] = useState(null); // { numero, titulo, detalle, hora }
  const [aviso, setAviso] = useState(null);         // { titulo, detalle, ofrecerOtro }
  const [ocupado, setOcupado] = useState(false);
  const [toque, setToque] = useState(0);            // cada interacción reinicia la cuenta de inactividad

  const reiniciar = useCallback(() => {
    setPaso('inicio');
    setModo('formula');
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

  const mostrarError = (err) => setAviso({ titulo: 'No pudimos completar la solicitud', detalle: err.message });
  const listo = (numero, titulo, detalle) => {
    setResultado({ numero, titulo, detalle, hora: horaCorta() });
    setPaso('listo');
  };

  // 1. Con la cédula: registrar llegada, elegir fórmula o avisar que no hay nada por reclamar
  const buscar = async () => {
    setOcupado(true);
    try {
      const r = await pedir('buscar', { documento });
      if (r.turno) {
        if (['presente', 'llamado'].includes(r.turno.estado)) {
          listo(r.turno.numero, 'Ya está en la fila', 'Espere a que su turno aparezca en la pantalla de la sala.');
        } else {
          const l = await pedir('llegada', { documento });
          listo(l.turno.numero, 'Llegada registrada', 'Espere a que su turno aparezca en la pantalla de la sala.');
        }
      } else if (r.formulas.length === 0) {
        setAviso({
          titulo: 'No hay fórmulas por reclamar',
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
      const r = modo === 'otro'
        ? await pedir('otro', { prioridad })
        : await pedir('turno', { documento, formula_id: formulaId, prioridad });
      listo(r.turno.numero, 'Su turno es',
        prioridad === 'ninguna'
          ? 'Espere a que su turno aparezca en la pantalla de la sala.'
          : 'Atención preferencial. Espere a que su turno aparezca en la pantalla de la sala.');
    } catch (err) {
      if (err.estado !== 401) { mostrarError(err); setPaso('aviso'); }
    } finally {
      setOcupado(false);
    }
  };

  if (!activa) {
    return (
      <Marco>
        <Panel>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Pantalla de turnos</p>
          <h1 className="text-3xl font-bold text-marca-noche mt-2">Sin activar</h1>
          <p className="text-xl text-slate-600 mt-4">
            Un administrador debe activarla desde el panel de la farmacia, en <strong>Pantalla de turnos</strong>.
          </p>
        </Panel>
      </Marco>
    );
  }

  return (
    <Marco>
      {paso === 'inicio' && (
        <div className="w-full max-w-6xl">
          <Instruccion>Seleccione el trámite</Instruccion>
          <div className="grid md:grid-cols-[3fr_2fr] gap-6 items-stretch">
            {/* Las dos opciones con fórmula van juntas, como en un kiosco de clínica */}
            <div className="bg-white rounded-md shadow-[0_3px_0_rgba(13,34,89,0.35)] flex flex-col">
              <OpcionInicio titulo="Reclamar medicamentos" detalle="Pedir turno con su fórmula"
                onClick={() => { setModo('formula'); setPaso('documento'); }} />
              <div className="mx-10 border-t-2 border-slate-200" />
              <OpcionInicio titulo="Ya tengo turno virtual" detalle="Registrar que ya llegué"
                onClick={() => { setModo('formula'); setPaso('documento'); }} />
            </div>
            <button type="button" onClick={() => { setModo('otro'); setPaso('prioridad'); }}
              className={`${claseBoton} px-10 py-12 text-left flex flex-col justify-center`}>
              <span className="text-3xl lg:text-4xl">Otro trámite</span>
              <span className="block text-lg lg:text-xl font-semibold normal-case tracking-normal text-slate-500 mt-2">
                Preguntas, quejas o información (sin fórmula)
              </span>
            </button>
          </div>
        </div>
      )}

      {paso === 'documento' && (
        <Teclado valor={documento} cambiar={setDocumento} ocupado={ocupado} alContinuar={buscar} alVolver={reiniciar} />
      )}

      {paso === 'formula' && (
        <div className="w-full max-w-2xl">
          <Instruccion>¿Qué fórmula va a reclamar?</Instruccion>
          <div className="space-y-4">
            {formulas.map((f) => (
              <button key={f.id} type="button" onClick={() => { setFormulaId(f.id); setPaso('prioridad'); }}
                className={`${claseBoton} w-full px-8 py-6 text-left flex items-center justify-between gap-4`}>
                <span className="text-2xl">Fórmula del {fechaLarga(f.emitida)}</span>
                <span className="text-lg font-semibold normal-case tracking-normal text-slate-500 shrink-0">
                  {f.medicamentos === 1 ? '1 medicamento' : `${f.medicamentos} medicamentos`}
                </span>
              </button>
            ))}
          </div>
          <Volver alVolver={reiniciar} />
        </div>
      )}

      {paso === 'prioridad' && (
        <div className="w-full max-w-3xl">
          <Instruccion>¿Requiere atención preferencial?</Instruccion>
          <div className="grid sm:grid-cols-3 gap-4">
            {PRIORIDADES.map(([valor, texto]) => (
              <button key={valor} type="button" disabled={ocupado} onClick={() => darTurno(valor)}
                className={`${claseBoton} px-4 py-8 text-xl`}>
                {texto}
              </button>
            ))}
          </div>
          <button type="button" disabled={ocupado} onClick={() => darTurno('ninguna')}
            className={`${claseBotonVerde} w-full mt-4 py-6 text-2xl`}>
            {ocupado ? 'Generando turno…' : 'No, continuar'}
          </button>
          <Volver alVolver={reiniciar} />
        </div>
      )}

      {paso === 'listo' && resultado && (
        <div className="w-full max-w-md text-center">
          {/* Se ve como el tiquete de un dispensador de turnos */}
          <Panel>
            <p className="text-lg font-bold uppercase tracking-widest text-slate-500">{resultado.titulo}</p>
            <p className="font-titulo font-extrabold text-[6.5rem] sm:text-[8rem] leading-none text-marca-noche mt-3 tabular-nums"
              aria-live="polite">
              {resultado.numero}
            </p>
            <div className="border-t-2 border-dashed border-slate-300 my-5" />
            <p className="text-xl text-slate-700">{resultado.detalle}</p>
            <p className="text-base text-slate-500 mt-3">Mediconnect · {resultado.hora}</p>
          </Panel>
          <button type="button" onClick={reiniciar} className={`${claseBoton} mt-6 px-12 py-4 text-xl`}>
            Terminar
          </button>
        </div>
      )}

      {paso === 'aviso' && aviso && (
        <div className="w-full max-w-2xl">
          <Panel>
            <h1 className="text-3xl font-bold text-marca-noche">{aviso.titulo}</h1>
            <p className="text-xl text-slate-600 mt-3">{aviso.detalle}</p>
          </Panel>
          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <button type="button" onClick={() => { setDocumento(''); setPaso(modo === 'otro' ? 'inicio' : 'documento'); }}
              className={`${claseBoton} py-5 text-xl`}>
              Intentar de nuevo
            </button>
            {aviso.ofrecerOtro && (
              <button type="button" onClick={() => { setModo('otro'); setPaso('prioridad'); }}
                className={`${claseBotonVerde} py-5 text-xl`}>
                Turno de otro trámite
              </button>
            )}
          </div>
          <Volver alVolver={reiniciar} />
        </div>
      )}
    </Marco>
  );
}

// Encabezado blanco (logo y hora), cuerpo azul y onda blanca abajo
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

  return (
    <div className="min-h-dvh bg-marca-azul flex flex-col select-none">
      <header className="bg-white px-6 sm:px-10 py-4 flex items-center justify-between gap-4 border-b-[6px] border-marca-verde">
        <div className="flex items-center gap-3">
          <img src="/img/logo-simbolo.png" alt="" className="w-14 h-14 object-contain" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Farmacia</p>
            <p className="font-titulo font-extrabold text-3xl tracking-tight">
              <span className="text-marca-azul">Medi</span><span className="text-marca-verde">connect</span>
            </p>
          </div>
        </div>
        <p className="border-2 border-marca-verde rounded px-5 py-2 text-3xl font-bold text-marca-noche tabular-nums">
          {horaCorta(hora)}
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">{children}</main>

      {/* Onda blanca de cierre */}
      <div className="relative h-20 sm:h-24" aria-hidden="true">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <path d="M0,70 C320,10 640,10 900,50 C1120,85 1300,90 1440,60 L1440,120 L0,120 Z" fill="#ffffff" />
        </svg>
        <p className="absolute bottom-3 left-6 sm:left-10 text-sm text-slate-500">Tu farmacia conectada</p>
        {!enCompleta && document.documentElement.requestFullscreen && (
          <button type="button" onClick={completa}
            className="absolute bottom-2 right-4 flex items-center gap-2 text-sm text-slate-500 hover:text-marca-noche px-3 py-2 cursor-pointer">
            <Maximize className="w-4 h-4" /> Pantalla completa
          </button>
        )}
      </div>
    </div>
  );
}

function Instruccion({ children }) {
  return <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold uppercase tracking-wider text-center mb-8 lg:mb-10">{children}</h1>;
}

function Panel({ children }) {
  return <div className="bg-white rounded-md shadow-[0_3px_0_rgba(13,34,89,0.35)] px-8 py-8">{children}</div>;
}

function OpcionInicio({ titulo, detalle, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 px-10 py-10 text-left hover:bg-marca-hielo active:bg-marca-verde-claro transition cursor-pointer first:rounded-t-md last:rounded-b-md">
      <span className="block text-3xl lg:text-4xl font-bold uppercase tracking-wide text-marca-noche">{titulo}</span>
      <span className="block text-lg lg:text-xl font-semibold text-slate-500 mt-2">{detalle}</span>
    </button>
  );
}

function Volver({ alVolver }) {
  return (
    <div className="mt-8">
      <button type="button" onClick={alVolver}
        className="inline-flex items-center gap-1 text-white font-bold uppercase tracking-wide border-2 border-white/70 rounded px-5 py-3 hover:bg-white/10 cursor-pointer">
        <ChevronLeft className="w-5 h-5" /> Volver al inicio
      </button>
    </div>
  );
}

// Teclado numérico en pantalla; también acepta el teclado físico
function Teclado({ valor, cambiar, ocupado, alContinuar, alVolver }) {
  const valido = /^\d{5,20}$/.test(valor);
  const ref = useRef({ valor, valido, ocupado, alContinuar });
  ref.current = { valor, valido, ocupado, alContinuar };

  const tecla = useCallback((t) => {
    const { valor: v } = ref.current;
    if (t === 'borrar') cambiar(v.slice(0, -1));
    else if (v.length < 15) cambiar(v + t);
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

  const clase = `${claseBoton} h-20 text-4xl`;
  return (
    <div className="w-full max-w-md">
      <Instruccion>Digite su número de documento</Instruccion>
      <div className="bg-white rounded-md h-20 flex items-center justify-center px-4 mb-4 border-4 border-marca-verde" aria-live="polite">
        <span className="font-titulo text-4xl font-extrabold tracking-widest tabular-nums text-marca-noche truncate">
          {valor || <span className="text-slate-300 text-2xl font-semibold tracking-normal">Sin puntos ni espacios</span>}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button key={n} type="button" onClick={() => tecla(n)} className={clase}>{n}</button>
        ))}
        <button type="button" onClick={() => cambiar('')} className={`${claseBoton} h-20 text-base`}>Borrar todo</button>
        <button type="button" onClick={() => tecla('0')} className={clase}>0</button>
        <button type="button" onClick={() => tecla('borrar')} aria-label="Borrar un número"
          className={`${claseBoton} h-20 flex items-center justify-center`}><Delete className="w-9 h-9" /></button>
      </div>
      <button type="button" onClick={alContinuar} disabled={!valido || ocupado}
        className={`${claseBotonVerde} w-full mt-4 h-20 text-2xl`}>
        {ocupado ? 'Buscando…' : 'Continuar'}
      </button>
      <Volver alVolver={alVolver} />
    </div>
  );
}
