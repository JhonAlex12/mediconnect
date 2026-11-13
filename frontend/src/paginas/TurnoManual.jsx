import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, CircleCheck, ClipboardPen, FileText, LogOut, MessageCircleQuestion, Plus, Printer, Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { useTitulo } from '../components/Encabezado';
import { TiqueteImpresion, imprimirTiquete } from '../components/TiqueteImpresion';
import {
  BotonTramite, Encabezado, Marco, PRIORIDADES, Tiquete, Titulo, Volver, claseAzul, claseSuave, claseVerde,
} from './Kiosco';

// Respaldo de la pantalla de la entrada: el administrador registra el turno a mano.
// Se abre en una página aparte (desde Panel → Pantalla de turnos) con el mismo estilo de la pantalla de turnos.
// Usa la sesión del panel: solo administradores (el backend también lo exige en /fila/fisico).

const campo = 'w-full bg-white border-2 border-[#cfe2f3] focus:border-marca-azul focus:outline-none rounded-2xl px-5 py-4 '
  + 'text-2xl text-marca-noche placeholder:text-slate-400';

export default function TurnoManual() {
  useTitulo('Registro manual de turnos');
  const { usuario, verificando } = useSesion();
  const [paso, setPaso] = useState('inicio');   // inicio | datos | prioridad | listo
  const [modo, setModo] = useState('formula');  // formula | nombre
  const [codigo, setCodigo] = useState('');
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [papel, setPapel] = useState(80);

  const esAdmin = usuario?.rol === 'administrador';
  const navegar = useNavigate();

  // Salir: cierra la pestaña (se abrió desde el panel); si el navegador no lo permite, vuelve al panel
  const salir = () => {
    window.close();
    setTimeout(() => navegar('/farmacia/pantalla-turnos', { replace: true }), 200);
  };

  // Ancho del papel del tiquete, el mismo de las pantallas de la entrada
  useEffect(() => {
    if (!esAdmin) return;
    api('/kiosco/ajustes').then((r) => setPapel(r.ajustes?.papel ?? 80)).catch(() => {});
  }, [esAdmin]);

  const reiniciar = () => {
    setPaso('inicio');
    setCodigo('');
    setDocumento('');
    setNombre('');
    setError('');
    setResultado(null);
  };

  const elegir = (m) => {
    setModo(m);
    setError('');
    setPaso('datos');
  };

  const datosListos = modo === 'formula'
    ? codigo.trim().length >= 6 && /^\d{5,20}$/.test(documento.trim())
    : nombre.trim().length >= 2;

  const registrar = async (prioridad) => {
    setOcupado(true);
    setError('');
    try {
      const cuerpo = modo === 'formula'
        ? { codigo: codigo.trim().toUpperCase(), documento: documento.trim(), prioridad }
        : { nombre: nombre.trim(), prioridad };
      const r = await api('/fila/fisico', { metodo: 'POST', cuerpo });
      setResultado({
        numero: r.turno.numero,
        tramite: modo === 'formula' ? 'reclamar' : 'otro',
        prioridad,
        fecha: new Date(),
      });
      setPaso('listo');
    } catch (err) {
      setError(err.message);
      setPaso('datos');
    } finally {
      setOcupado(false);
    }
  };

  if (verificando) {
    return <Marco><p className="text-center text-2xl text-slate-600">Verificando la sesión…</p></Marco>;
  }
  if (!esAdmin) {
    return (
      <Marco>
        <Encabezado />
        <div className={`${claseSuave} cursor-default p-8 text-center max-w-xl mx-auto`}>
          <p className="text-2xl font-bold">Solo para administradores</p>
          <p className="text-lg text-slate-600 mt-3">
            Inicia sesión como administrador en el panel de la farmacia y vuelve a abrir esta página desde
            <strong> Pantalla de turnos</strong>.
          </p>
          <Link to="/farmacia" className={`${claseAzul} inline-block mt-6 px-7 py-4 font-titulo text-xl font-bold`}>
            Ir al panel de la farmacia
          </Link>
        </div>
      </Marco>
    );
  }

  return (
    <Marco>
      <button type="button" onClick={salir}
        className="fixed top-5 left-6 z-20 flex items-center gap-2 rounded-full bg-white/85 border border-slate-200 px-4 py-1.5 text-lg font-bold text-marca-noche shadow-sm hover:bg-white cursor-pointer">
        <LogOut className="w-5 h-5 text-marca-azul" /> Salir
      </button>
      {paso === 'inicio' && (
        <>
          <Encabezado />
          <Titulo icono={ClipboardPen}>Registro manual de turnos</Titulo>
          <p className="text-center text-xl text-slate-600 -mt-4 mb-8">
            Respaldo para cuando la pantalla de la entrada no funciona.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            <BotonTramite clase={claseAzul} icono={FileText} titulo="Con fórmula"
              detalle="Código de la fórmula y documento del paciente" onClick={() => elegir('formula')} />
            <BotonTramite clase={claseSuave} icono={MessageCircleQuestion} titulo="Sin fórmula"
              detalle="Otro trámite: solo el nombre del paciente" onClick={() => elegir('nombre')} />
          </div>
        </>
      )}

      {paso === 'datos' && (
        <>
          <Encabezado />
          <Titulo icono={modo === 'formula' ? FileText : MessageCircleQuestion}>
            {modo === 'formula' ? 'Datos de la fórmula' : 'Nombre del paciente'}
          </Titulo>
          <form className="max-w-2xl mx-auto space-y-5"
            onSubmit={(e) => { e.preventDefault(); if (datosListos) setPaso('prioridad'); }}>
            {error && (
              <div role="alert" className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
                <AlertCircle className="w-7 h-7 text-amber-600 shrink-0" />
                <p className="text-xl text-marca-noche">{error}</p>
              </div>
            )}
            {modo === 'formula' ? (
              <>
                <div>
                  <label htmlFor="tm-codigo" className="block font-titulo text-xl font-bold text-marca-noche mb-2">Código de la fórmula</label>
                  <input id="tm-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus
                    placeholder="F-2026-0001" autoComplete="off" className={`${campo} uppercase font-mono`} />
                </div>
                <div>
                  <label htmlFor="tm-documento" className="block font-titulo text-xl font-bold text-marca-noche mb-2">Documento del paciente</label>
                  <input id="tm-documento" value={documento} onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric" placeholder="Solo números" autoComplete="off" className={campo} />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="tm-nombre" className="block font-titulo text-xl font-bold text-marca-noche mb-2">Nombre completo</label>
                <input id="tm-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus
                  placeholder="Nombres y apellidos" autoComplete="off" className={campo} />
              </div>
            )}
            <button type="submit" disabled={!datosListos}
              className={`${claseAzul} w-full py-6 font-titulo text-2xl font-bold flex items-center justify-center gap-3`}>
              Continuar <ArrowRight className="w-7 h-7" />
            </button>
          </form>
          <Volver alVolver={reiniciar} />
        </>
      )}

      {paso === 'prioridad' && (
        <>
          <Encabezado />
          <Titulo icono={Users}>¿Requiere atención preferencial?</Titulo>
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {PRIORIDADES.map(([valor, texto, Icono]) => (
              <button key={valor} type="button" disabled={ocupado} onClick={() => registrar(valor)}
                className={`${claseSuave} px-5 py-7 flex flex-col items-center gap-3`}>
                <Icono className="w-12 h-12 text-marca-azul" strokeWidth={1.75} />
                <span className="font-titulo text-xl font-bold text-center">{texto}</span>
              </button>
            ))}
          </div>
          <div className="max-w-4xl mx-auto">
            <button type="button" disabled={ocupado} onClick={() => registrar('ninguna')}
              className={`${claseAzul} w-full mt-5 py-6 font-titulo text-2xl font-bold flex items-center justify-center gap-3`}>
              {ocupado ? 'Registrando turno…' : <>No, registrar el turno <ArrowRight className="w-7 h-7" /></>}
            </button>
          </div>
          <Volver alVolver={() => setPaso('datos')} texto="Volver" />
        </>
      )}

      {paso === 'listo' && resultado && (
        <>
          <Encabezado />
          <div className="max-w-3xl mx-auto mt-6 rounded-3xl bg-[#e3f5f2] border border-[#bfe6e0] p-6 sm:p-8">
            <p className="flex items-center justify-center gap-3 font-titulo text-3xl font-bold text-marca-noche">
              <CircleCheck className="w-10 h-10 text-white fill-marca-verde-oscuro" /> Turno registrado
            </p>
            <div className="grid sm:grid-cols-[1fr_1fr] gap-8 items-center mt-6">
              <Tiquete resultado={resultado} />
              <div className="text-center sm:text-left">
                <p className="text-2xl text-slate-700">
                  Entréguele el número al paciente. Ya está en la fila de la sala.
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-6">
                  <button type="button" onClick={imprimirTiquete}
                    className={`${claseVerde} px-7 py-4 font-titulo text-xl font-bold flex items-center gap-2`}>
                    <Printer className="w-6 h-6" /> Imprimir tiquete
                  </button>
                  <button type="button" onClick={reiniciar}
                    className={`${claseSuave} px-7 py-4 font-titulo text-xl font-bold flex items-center gap-2`}>
                    <Plus className="w-6 h-6" /> Registrar otro
                  </button>
                </div>
              </div>
            </div>
          </div>
          <TiqueteImpresion papel={papel} datos={resultado} />
        </>
      )}
    </Marco>
  );
}
