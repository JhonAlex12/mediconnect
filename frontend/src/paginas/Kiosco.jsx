import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accessibility, Baby, CheckCircle2, Delete, FileText, HelpCircle, Maximize, MonitorOff, PersonStanding, UserRound,
} from 'lucide-react';
import { api } from '../lib/api';
import { guardarTokenKiosco, leerTokenKiosco } from '../lib/kiosco';
import { useTitulo } from '../components/Encabezado';

// Pantalla de turnos de la entrada (táctil, también sirve con mouse y teclado).
// El paciente escribe su cédula: si tiene turno virtual se registra su llegada; si no, saca un turno
// con su fórmula. También hay turnos de "Otro trámite" sin fórmula. Nunca muestra nombres,
// códigos ni medicamentos, y vuelve sola al inicio para no dejar datos a la vista.

const SEGUNDOS_INACTIVIDAD = 30;
const SEGUNDOS_RESULTADO = 15;

const PRIORIDADES = [
  ['ninguna', 'No', null],
  ['adulto_mayor', 'Adulto mayor', PersonStanding],
  ['embarazada', 'En embarazo', Baby],
  ['discapacidad', 'Con discapacidad', Accessibility],
];

const fechaLarga = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
};

export default function Kiosco() {
  useTitulo('Pantalla de turnos');
  const [token, setToken] = useState(leerTokenKiosco);
  const [activa, setActiva] = useState(null); // null mientras se confirma con el servidor
  const [paso, setPaso] = useState('inicio');  // inicio | documento | formula | prioridad | listo | aviso
  const [modo, setModo] = useState('formula'); // formula | otro
  const [documento, setDocumento] = useState('');
  const [formulas, setFormulas] = useState([]);
  const [formulaId, setFormulaId] = useState(null);
  const [resultado, setResultado] = useState(null); // { numero, titulo, detalle }
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

  const mostrarError = (err) => setAviso({ titulo: 'No pudimos completar tu solicitud', detalle: err.message });

  // 1. Con la cédula: registrar llegada, elegir fórmula o avisar que no hay nada por reclamar
  const buscar = async () => {
    setOcupado(true);
    try {
      const r = await pedir('buscar', { documento });
      if (r.turno) {
        if (['presente', 'llamado'].includes(r.turno.estado)) {
          setResultado({ numero: r.turno.numero, titulo: 'Ya estás en la fila', detalle: 'Espera a que te llamen en la pantalla de la sala.' });
        } else {
          const l = await pedir('llegada', { documento });
          setResultado({ numero: l.turno.numero, titulo: 'Registramos tu llegada', detalle: 'Ya estás en la fila. Espera a que te llamen en la pantalla de la sala.' });
        }
        setPaso('listo');
      } else if (r.formulas.length === 0) {
        setAviso({
          titulo: 'No encontramos fórmulas por reclamar',
          detalle: 'Revisa que el número esté bien escrito. Si tu fórmula es nueva, puede que la IPS aún no la haya enviado.',
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
      setResultado({
        numero: r.turno.numero,
        titulo: 'Este es tu turno',
        detalle: prioridad === 'ninguna'
          ? 'Espera a que te llamen en la pantalla de la sala.'
          : 'Tienes atención preferencial. Espera a que te llamen en la pantalla de la sala.',
      });
      setPaso('listo');
    } catch (err) {
      if (err.estado !== 401) { mostrarError(err); setPaso('aviso'); }
    } finally {
      setOcupado(false);
    }
  };

  if (activa === null) return <Fondo><p className="text-2xl text-slate-600">Cargando…</p></Fondo>;
  if (!activa) {
    return (
      <Fondo>
        <div className="text-center max-w-xl">
          <MonitorOff className="w-20 h-20 mx-auto text-slate-400" strokeWidth={1.5} />
          <h1 className="font-titulo text-3xl font-extrabold mt-6">Pantalla de turnos sin activar</h1>
          <p className="text-xl text-slate-600 mt-4">
            Un administrador debe activarla desde el panel de la farmacia, en <strong>Pantalla de turnos</strong>.
          </p>
        </div>
      </Fondo>
    );
  }

  return (
    <Fondo>
      <div className="w-full max-w-3xl">
        {paso === 'inicio' && (
          <div className="text-center">
            <h1 className="font-titulo text-4xl sm:text-5xl font-extrabold text-marca-noche">¡Bienvenido!</h1>
            <p className="text-2xl text-slate-600 mt-3">Toca una opción para tomar tu turno</p>
            <div className="grid sm:grid-cols-2 gap-5 mt-10">
              <BotonGrande icono={FileText} titulo="Tengo una fórmula" detalle="Pedir turno o registrar que ya llegué"
                onClick={() => { setModo('formula'); setPaso('documento'); }} />
              <BotonGrande icono={HelpCircle} titulo="Otro trámite" detalle="Preguntas, quejas u otros (sin fórmula)" secundario
                onClick={() => { setModo('otro'); setPaso('prioridad'); }} />
            </div>
          </div>
        )}

        {paso === 'documento' && (
          <Teclado valor={documento} cambiar={setDocumento} ocupado={ocupado} alContinuar={buscar} alVolver={reiniciar} />
        )}

        {paso === 'formula' && (
          <Tarjeta titulo="¿Qué fórmula vas a reclamar?" alVolver={reiniciar}>
            <div className="space-y-3">
              {formulas.map((f) => (
                <button key={f.id} type="button" onClick={() => { setFormulaId(f.id); setPaso('prioridad'); }}
                  className="w-full flex items-center gap-4 text-left bg-white text-marca-noche rounded-2xl px-6 py-5 text-2xl font-bold shadow-md ring-2 ring-slate-200 hover:ring-4 hover:ring-marca-verde active:scale-[0.99] transition cursor-pointer">
                  <FileText className="w-9 h-9 text-marca-verde shrink-0" />
                  <span>
                    Fórmula del {fechaLarga(f.emitida)}
                    <span className="block text-lg font-semibold text-slate-500">
                      {f.medicamentos === 1 ? '1 medicamento' : `${f.medicamentos} medicamentos`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Tarjeta>
        )}

        {paso === 'prioridad' && (
          <Tarjeta titulo="¿Necesitas atención preferencial?" alVolver={reiniciar}>
            <div className="grid sm:grid-cols-2 gap-4">
              {PRIORIDADES.map(([valor, texto, Icono]) => (
                <button key={valor} type="button" disabled={ocupado} onClick={() => darTurno(valor)}
                  className={`flex items-center justify-center gap-3 rounded-2xl px-6 py-6 text-2xl font-bold transition cursor-pointer active:scale-[0.99] disabled:opacity-50 ${
                    valor === 'ninguna' ? 'bg-marca-verde-oscuro hover:bg-[#0b6f68] text-white sm:col-span-2' : 'bg-white text-marca-noche shadow-md ring-2 ring-slate-200 hover:ring-4 hover:ring-marca-verde'}`}>
                  {Icono && <Icono className="w-9 h-9 text-marca-azul" />}
                  {valor === 'ninguna' ? 'No, continuar' : texto}
                </button>
              ))}
            </div>
            {ocupado && <p className="text-center text-xl text-slate-600 mt-6">Generando tu turno…</p>}
          </Tarjeta>
        )}

        {paso === 'listo' && resultado && (
          <div className="text-center">
            <CheckCircle2 className="w-20 h-20 mx-auto text-marca-verde" />
            <p className="text-3xl font-bold mt-4">{resultado.titulo}</p>
            <p className="font-titulo font-extrabold text-[7rem] sm:text-[9rem] leading-none mt-4 tracking-tight text-marca-azul" aria-live="polite">
              {resultado.numero}
            </p>
            <p className="text-2xl text-slate-600 mt-6 max-w-xl mx-auto">{resultado.detalle}</p>
            <button type="button" onClick={reiniciar}
              className="mt-10 bg-marca-noche hover:bg-marca-azul text-white font-bold text-2xl rounded-2xl px-10 py-4 shadow-md cursor-pointer">
              Terminar
            </button>
          </div>
        )}

        {paso === 'aviso' && aviso && (
          <Tarjeta titulo={aviso.titulo} alVolver={reiniciar}>
            <p className="text-2xl text-slate-600">{aviso.detalle}</p>
            <div className="flex flex-wrap gap-4 mt-8">
              {aviso.ofrecerOtro && (
                <button type="button" onClick={() => { setModo('otro'); setPaso('prioridad'); }}
                  className="bg-marca-verde-oscuro hover:bg-[#0b6f68] text-white font-bold text-xl rounded-2xl px-6 py-4 cursor-pointer">
                  Pedir turno de otro trámite
                </button>
              )}
              <button type="button" onClick={() => { setDocumento(''); setPaso(modo === 'otro' ? 'inicio' : 'documento'); }}
                className="bg-white text-marca-noche font-bold text-xl rounded-2xl px-6 py-4 ring-2 ring-marca-azul hover:bg-marca-hielo shadow-md cursor-pointer">
                Intentar de nuevo
              </button>
            </div>
          </Tarjeta>
        )}
      </div>
    </Fondo>
  );
}

// Fondo de toda la pantalla, con la marca arriba y el botón de pantalla completa abajo
function Fondo({ children }) {
  const [hora, setHora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 30_000);
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
    <div className="min-h-dvh bg-gradient-to-b from-white via-marca-hielo to-marca-verde-claro text-marca-noche flex flex-col select-none">
      <header className="bg-white border-b-4 border-marca-azul shadow-sm px-6 sm:px-10 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/img/logo-simbolo.png" alt="" className="w-14 h-14 object-contain" />
          <p className="font-titulo font-extrabold text-2xl tracking-tight">
            <span className="text-marca-azul">Medi</span><span className="text-marca-verde">connect</span>
          </p>
        </div>
        <p className="text-2xl font-bold text-marca-azul tabular-nums">
          {hora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-10">{children}</main>
      {!enCompleta && document.documentElement.requestFullscreen && (
        <button type="button" onClick={completa}
          className="fixed bottom-3 right-3 flex items-center gap-2 text-sm text-slate-500 hover:text-marca-noche px-3 py-2 cursor-pointer">
          <Maximize className="w-4 h-4" /> Pantalla completa
        </button>
      )}
    </div>
  );
}

function BotonGrande({ icono: Icono, titulo, detalle, onClick, secundario = false }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-3xl p-8 text-left transition active:scale-[0.99] cursor-pointer ${
        secundario
          ? 'bg-white hover:bg-marca-hielo ring-2 ring-marca-azul text-marca-noche shadow-md'
          : 'bg-marca-verde-oscuro hover:bg-[#0b6f68] text-white shadow-lg shadow-marca-verde/30'}`}>
      <Icono className={`w-14 h-14 ${secundario ? 'text-marca-azul' : ''}`} strokeWidth={1.75} />
      <span className="block font-titulo text-3xl font-extrabold mt-5">{titulo}</span>
      <span className={`block text-xl mt-2 ${secundario ? 'text-slate-600' : 'text-white/90'}`}>{detalle}</span>
    </button>
  );
}

function Tarjeta({ titulo, alVolver, children }) {
  return (
    <div>
      <h1 className="font-titulo text-3xl sm:text-4xl font-extrabold text-center text-marca-noche mb-8">{titulo}</h1>
      {children}
      <div className="text-center mt-8">
        <button type="button" onClick={alVolver} className="text-xl font-semibold text-marca-azul hover:text-marca-noche underline cursor-pointer">
          Volver al inicio
        </button>
      </div>
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

  const clase = 'h-20 rounded-2xl text-4xl font-bold transition active:scale-95 cursor-pointer';
  const numero = 'bg-white text-marca-noche shadow-sm ring-1 ring-slate-300 hover:bg-marca-hielo hover:ring-marca-azul';
  const gris = 'bg-slate-100 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-200';
  return (
    <Tarjeta titulo="Escribe tu número de documento" alVolver={alVolver}>
      <div className="max-w-md mx-auto">
        <div className="bg-white text-marca-noche rounded-2xl h-20 flex items-center justify-center gap-3 px-4 mb-5 ring-2 ring-marca-azul shadow-md" aria-live="polite">
          <UserRound className="w-8 h-8 text-slate-400 shrink-0" />
          <span className="font-titulo text-4xl font-extrabold tracking-wider tabular-nums truncate">
            {valor || <span className="text-slate-300 font-semibold text-3xl tracking-normal">Sin puntos ni espacios</span>}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button key={n} type="button" onClick={() => tecla(n)} className={`${clase} ${numero}`}>{n}</button>
          ))}
          <button type="button" onClick={() => cambiar('')} className={`${clase} ${gris} text-xl`}>Borrar todo</button>
          <button type="button" onClick={() => tecla('0')} className={`${clase} ${numero}`}>0</button>
          <button type="button" onClick={() => tecla('borrar')} aria-label="Borrar un número"
            className={`${clase} ${gris} flex items-center justify-center`}><Delete className="w-9 h-9" /></button>
        </div>
        <button type="button" onClick={alContinuar} disabled={!valido || ocupado}
          className="w-full mt-5 h-20 rounded-2xl bg-marca-verde-oscuro hover:bg-[#0b6f68] text-white shadow-lg text-3xl font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
          {ocupado ? 'Buscando…' : 'Continuar'}
        </button>
      </div>
    </Tarjeta>
  );
}
