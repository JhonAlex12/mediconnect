import React, { useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  Accessibility, ArrowRight, Bell, BookOpen, CalendarCheck, CheckCircle2, ChevronDown, Clock, CreditCard,
  FileText, HeartPulse, IdCard, Mail, MapPin, Phone, Pill, Search, ShieldCheck, Smartphone, Ticket, Wallet,
} from 'lucide-react';
import SitioPublico from '../components/SitioPublico';
import Carrusel from '../components/Carrusel';
import { Logo, useTitulo } from '../components/Encabezado';

// ============================================================
// Propuestas de diseño para la página de inicio (solo para comparar).
// /propuesta/a  Institucional (estructura tipo clínica)
// /propuesta/b  Servicio directo (consulta desde la portada)
// /propuesta/c  Cercana y accesible (adultos mayores)
// ============================================================

const PREGUNTAS = [
  ['¿Dónde encuentro el código de mi fórmula?', 'Te lo entrega tu médico o la IPS al emitir la fórmula. Tiene la forma F-2026-0001.'],
  ['¿Cuánto debo pagar al reclamar?', 'Depende de tu régimen y rango de ingreso. Al consultar tu fórmula verás el valor exacto de la cuota moderadora. Subsidiado y programas especiales no pagan.'],
  ['¿Cuánto tiempo tengo para llegar?', 'Tus medicamentos quedan apartados 2 horas. Puedes pedir 20 minutos más una sola vez.'],
  ['¿Puede reclamar otra persona?', 'Sí. En la ventanilla se registran el nombre y el documento de quien recoge.'],
];

export default function Propuestas() {
  const { id } = useParams();
  useTitulo(`Propuesta ${id?.toUpperCase()}`);
  const Pagina = { a: Institucional, b: ServicioDirecto, c: Cercana }[id] ?? Institucional;
  return (
    <>
      <Pagina />
      <Selector />
    </>
  );
}

// Barra flotante para saltar entre propuestas
function Selector() {
  const opciones = [['a', 'A · Institucional'], ['b', 'B · Servicio directo'], ['c', 'C · Cercana']];
  return (
    <nav aria-label="Propuestas de diseño"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-slate-900/90 backdrop-blur p-1 rounded-full shadow-xl text-sm">
      {opciones.map(([id, texto]) => (
        <NavLink key={id} to={`/propuesta/${id}`}
          className={({ isActive }) => `px-3 sm:px-4 py-2 rounded-full font-semibold whitespace-nowrap ${
            isActive ? 'bg-white text-slate-900' : 'text-white/80 hover:text-white'}`}>
          {texto}
        </NavLink>
      ))}
    </nav>
  );
}

// ============================================================
// A · INSTITUCIONAL
// Franja de accesos, menú amplio, carrusel, accesos rápidos en bloque,
// información al paciente, artículos de salud y pie de página completo.
// ============================================================
function Institucional() {
  const menu = ['Inicio', 'Servicios', 'Pacientes', 'Farmacia', 'Salud al día', 'Contáctenos'];
  return (
    <div className="bg-white min-h-screen">
      {/* Franja superior */}
      <div className="bg-marca-verde-oscuro text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <div className="hidden md:flex items-center gap-5">
            <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> Línea de atención (000) 000 0000</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Lun a sáb · 7:00 a. m. – 7:00 p. m.</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <a href="#pqrs" className="hover:underline">PQRS</a>
            <span className="opacity-40" aria-hidden="true">|</span>
            <Link to="/farmacia" className="hover:underline">Acceso empleados</Link>
          </div>
        </div>
      </div>

      {/* Encabezado */}
      <header className="border-b-4 border-marca-azul sticky top-0 bg-white z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-6">
          <Logo subtitulo="Tu farmacia conectada" />
          <nav className="hidden lg:flex items-center" aria-label="Menú principal">
            {menu.map((m, i) => (
              <a key={m} href="#"
                className={`px-3.5 py-2 font-semibold text-[15px] flex items-center gap-1 ${i === 0 ? 'text-marca-azul' : 'text-slate-700 hover:text-marca-azul'}`}>
                {m}
                {(m === 'Servicios' || m === 'Pacientes') && <ChevronDown className="w-4 h-4 opacity-60" />}
              </a>
            ))}
          </nav>
          <Link to="/paciente" className="hidden sm:block bg-marca-azul hover:bg-marca-azul-oscuro text-white font-bold px-5 py-2.5 rounded">
            Pedir turno
          </Link>
        </div>
      </header>

      <Carrusel />

      {/* Accesos rápidos en bloque de color, pegados al carrusel */}
      <section className="max-w-6xl mx-auto px-4 -mt-10 relative z-20">
        <div className="grid sm:grid-cols-3 shadow-xl rounded-lg overflow-hidden">
          {[
            [Search, 'Consultar fórmula', 'Disponibilidad de tus medicamentos', 'bg-marca-azul'],
            [Ticket, 'Turno virtual', 'Pide tu turno desde el celular', 'bg-marca-verde-oscuro'],
            [Wallet, 'Cuota moderadora', 'Conoce cuánto debes pagar', 'bg-marca-noche'],
          ].map(([Icono, titulo, texto, color]) => (
            <Link key={titulo} to="/paciente" className={`${color} text-white p-6 flex items-center gap-4 hover:brightness-110 transition`}>
              <Icono className="w-10 h-10 shrink-0 opacity-90" strokeWidth={1.5} />
              <span>
                <span className="block font-bold text-lg">{titulo}</span>
                <span className="block text-sm text-white/80">{texto}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Información para pacientes: imagen + lista de enlaces */}
      <section className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div className="rounded-lg bg-gradient-to-br from-marca-azul to-marca-verde p-8 sm:p-10 text-white">
          <p className="font-titulo text-2xl font-extrabold">Para reclamar necesitas</p>
          <ul className="mt-6 space-y-4">
            {[
              [IdCard, 'Documento de identidad', 'Tuyo o de quien recoge por ti'],
              [FileText, 'Fórmula vigente', 'Normalmente 30 días desde que se emite'],
              [Wallet, 'Cuota moderadora', 'La ves al consultar tu fórmula'],
            ].map(([Icono, t, d]) => (
              <li key={t} className="flex items-start gap-4 bg-white/10 rounded-lg p-4">
                <Icono className="w-7 h-7 shrink-0" />
                <span><span className="block font-bold text-lg">{t}</span><span className="block text-white/85">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-marca-verde-oscuro font-bold text-sm uppercase tracking-wider">Pacientes y familiares</p>
          <h2 className="font-titulo text-3xl font-extrabold text-marca-noche mt-2 mb-6">Información para reclamar tus medicamentos</h2>
          <ul className="divide-y divide-slate-200 border-y border-slate-200">
            {['Requisitos para reclamar', 'Cuotas moderadoras y exenciones', 'Entregas pendientes', 'Atención preferencial', 'Derechos y deberes del paciente'].map((t) => (
              <li key={t}>
                <a href="#" className="flex items-center justify-between py-3.5 font-semibold text-slate-800 hover:text-marca-azul group">
                  {t}
                  <ArrowRight className="w-5 h-5 text-marca-verde group-hover:translate-x-1 transition" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Salud al día: artículos */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="flex items-end justify-between gap-4 mb-8">
            <h2 className="font-titulo text-3xl font-extrabold text-marca-noche">Salud al día</h2>
            <a href="#" className="font-semibold text-marca-azul hover:underline">Ver todos los artículos</a>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              [Pill, 'from-marca-azul to-marca-verde', '3 nov 2026', 'Cómo tomar bien tus medicamentos para la presión'],
              [HeartPulse, 'from-marca-verde to-teal-300', '28 oct 2026', 'Control de la diabetes: lo que debes llevar a tu cita'],
              [BookOpen, 'from-marca-noche to-marca-azul', '20 oct 2026', 'Qué significa cada dato de tu fórmula médica'],
            ].map(([Icono, grad, fecha, titulo]) => (
              <article key={titulo} className="bg-white rounded-lg overflow-hidden border border-slate-200 hover:shadow-lg transition">
                <div className={`h-40 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                  <Icono className="w-16 h-16 text-white/80" strokeWidth={1.25} />
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-500">{fecha}</p>
                  <h3 className="font-bold text-lg text-marca-noche mt-1 leading-snug">{titulo}</h3>
                  <a href="#" className="inline-block mt-3 text-sm font-semibold text-marca-azul hover:underline">Leer más</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Institucional + llamado */}
      <section className="max-w-7xl mx-auto px-4 py-16 grid lg:grid-cols-[3fr_2fr] gap-10 items-center">
        <div>
          <h2 className="font-titulo text-3xl font-extrabold text-marca-noche">Quiénes somos</h2>
          <p className="text-lg text-slate-600 mt-4">
            Mediconnect conecta las fórmulas de tu IPS con la farmacia. Sabes qué medicamentos hay antes de salir,
            apartas los tuyos con un turno virtual y conoces desde el principio el valor de tu cuota moderadora.
          </p>
        </div>
        <div className="bg-marca-hielo border-l-4 border-marca-verde rounded p-6">
          <p className="font-bold text-marca-noche text-lg">¿Tienes una fórmula vigente?</p>
          <p className="text-slate-600 mt-1">Consulta disponibilidad y pide tu turno en dos minutos.</p>
          <Link to="/paciente" className="inline-flex items-center gap-2 mt-4 bg-marca-verde hover:bg-marca-verde-oscuro text-white font-bold px-5 py-2.5 rounded">
            Consultar ahora <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Pie de página completo */}
      <footer className="bg-marca-noche text-blue-100 pb-20">
        <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="space-y-3">
            <Logo claro />
            <p className="text-blue-200">Tu fórmula de la IPS, directo a la farmacia.</p>
          </div>
          <PieColumna titulo="Pacientes" enlaces={['Consultar fórmula', 'Turno virtual', 'Cuotas moderadoras', 'Preguntas frecuentes']} />
          <PieColumna titulo="Institucional" enlaces={['Quiénes somos', 'Política de datos', 'Derechos y deberes', 'PQRS']} />
          <div>
            <h2 className="font-bold text-white mb-3">Contacto</h2>
            <ul className="space-y-2 text-blue-200">
              <li className="flex gap-2"><Phone className="w-4 h-4 mt-0.5" /> (000) 000 0000</li>
              <li className="flex gap-2"><Mail className="w-4 h-4 mt-0.5" /> contacto@ejemplo.com</li>
              <li className="flex gap-2"><MapPin className="w-4 h-4 mt-0.5" /> Dirección de la farmacia</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-white/10 max-w-7xl mx-auto px-4 pt-4 text-xs text-blue-300">
          © 2026 Mediconnect · Vigilado Supersalud (ejemplo)
        </p>
      </footer>
    </div>
  );
}

function PieColumna({ titulo, enlaces }) {
  return (
    <div>
      <h2 className="font-bold text-white mb-3">{titulo}</h2>
      <ul className="space-y-2">
        {enlaces.map((e) => <li key={e}><a href="#" className="hover:text-white">{e}</a></li>)}
      </ul>
    </div>
  );
}

// ============================================================
// B · SERVICIO DIRECTO
// La consulta de la fórmula está en la portada: menos lectura, más acción.
// ============================================================
function ServicioDirecto() {
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [documento, setDocumento] = useState('');
  const enviar = (e) => {
    e.preventDefault();
    navegar(`/paciente?codigo=${encodeURIComponent(codigo.trim().toUpperCase())}&documento=${encodeURIComponent(documento.trim())}`);
  };

  return (
    <SitioPublico>
      {/* Portada con el formulario */}
      <section className="bg-marca-noche text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(20,173,162,0.35),transparent_45%)]" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 lg:py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="font-titulo text-4xl sm:text-5xl font-extrabold leading-tight">
              Consulta tu fórmula y <span className="text-marca-verde">evita la fila</span>
            </h1>
            <p className="text-lg text-blue-100 mt-4 max-w-lg">
              Mira si tus medicamentos están disponibles, cuánto vas a pagar y pide tu turno, todo desde aquí.
            </p>
            <ul className="mt-6 space-y-2 text-blue-100">
              {['Disponibilidad en tiempo real', 'Valor de la cuota moderadora antes de salir', 'Aviso cuando te llamen'].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-marca-verde" /> {t}</li>
              ))}
            </ul>
          </div>

          <form onSubmit={enviar} className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
            <p className="font-titulo text-xl font-bold text-marca-noche">Consulta tu fórmula</p>
            <div>
              <label htmlFor="b-codigo" className="block text-sm font-bold mb-1">Código de la fórmula</label>
              <input id="b-codigo" required value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="F-2026-0001"
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-marca-azul" />
            </div>
            <div>
              <label htmlFor="b-documento" className="block text-sm font-bold mb-1">Número de documento</label>
              <input id="b-documento" required inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="1090123456"
                className="w-full border border-slate-300 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-marca-azul" />
            </div>
            <button type="submit" className="w-full bg-marca-verde hover:bg-marca-verde-oscuro text-white font-bold text-lg py-3.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer">
              <Search className="w-5 h-5" /> Consultar
            </button>
            <p className="text-sm text-slate-500 text-center">El código te lo da tu médico o la IPS.</p>
          </form>
        </div>
      </section>

      {/* Qué llevar */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-titulo text-3xl font-extrabold text-marca-noche">Qué debes llevar a la farmacia</h2>
        <div className="grid sm:grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mt-8">
          {[
            [IdCard, 'Tu documento', 'O el de la persona que recoge por ti, con su nombre.'],
            [FileText, 'Fórmula vigente', 'Normalmente tiene validez de 30 días desde que se emite.'],
            [CreditCard, 'El valor de la cuota', 'Lo ves al consultar. Efectivo, transferencia o tarjeta.'],
          ].map(([Icono, titulo, texto]) => (
            <div key={titulo} className="bg-white p-6">
              <Icono className="w-7 h-7 text-marca-azul" />
              <h3 className="font-bold text-lg text-marca-noche mt-3">{titulo}</h3>
              <p className="text-slate-600 mt-1">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pasos en línea */}
      <section className="bg-marca-hielo border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-14 grid md:grid-cols-4 gap-8">
          {[
            [Smartphone, 'Consulta', 'Código y documento.'],
            [Ticket, 'Pide turno', 'Tus medicamentos quedan apartados 2 horas.'],
            [Bell, 'Te avisamos', 'Cuando te llamen a la ventanilla.'],
            [Pill, 'Reclama', 'Pagas la cuota y recibes tus medicamentos.'],
          ].map(([Icono, titulo, texto], i) => (
            <div key={titulo} className="flex gap-4">
              <span className="font-titulo text-3xl font-black text-marca-verde leading-none">{i + 1}</span>
              <div>
                <p className="font-bold text-marca-noche flex items-center gap-2"><Icono className="w-4 h-4 text-marca-azul" /> {titulo}</p>
                <p className="text-slate-600 text-sm mt-1">{texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Faq />
    </SitioPublico>
  );
}

// ============================================================
// C · CERCANA Y ACCESIBLE
// Letra grande, botones grandes y lenguaje simple, pensada para adultos mayores.
// ============================================================
function Cercana() {
  return (
    <SitioPublico>
      <div className="bg-[#fbfaf6]">
        {/* Portada con foto */}
        <section className="max-w-7xl mx-auto px-4 py-10 lg:py-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <p className="inline-flex items-center gap-2 bg-marca-verde-claro text-marca-verde-oscuro font-bold px-3 py-1 rounded-full">
              <ShieldCheck className="w-4 h-4" /> Farmacia de tu IPS
            </p>
            <h1 className="font-titulo text-4xl sm:text-6xl font-extrabold text-marca-noche leading-[1.05] mt-5">
              Tus medicamentos, sin filas y sin vueltas.
            </h1>
            <p className="text-xl text-slate-700 mt-5 max-w-xl leading-relaxed">
              Revisa desde tu casa si ya están listos. Cuando llegues, te llamamos por tu nombre.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/paciente" className="bg-marca-azul hover:bg-marca-azul-oscuro text-white text-xl font-bold px-8 py-4 rounded-2xl">
                Revisar mi fórmula
              </Link>
              <a href="#ayuda" className="bg-white border-2 border-slate-300 text-marca-noche text-xl font-bold px-8 py-4 rounded-2xl hover:border-marca-azul">
                Necesito ayuda
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-[2rem] overflow-hidden aspect-[3/5] max-w-sm mx-auto bg-marca-hielo shadow-xl">
              <img src="/img/banner-familia-1600.webp" alt="Familia sonriendo" className="w-full h-full object-cover object-right" />
            </div>
            <div className="absolute -bottom-6 left-0 right-0 sm:left-auto sm:right-auto sm:-left-4 mx-auto w-fit bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-marca-verde-claro text-marca-verde-oscuro flex items-center justify-center">
                <Bell className="w-6 h-6" />
              </span>
              <span>
                <span className="block font-bold text-marca-noche">Turno V-014, acércate</span>
                <span className="block text-slate-600 text-sm">Ventanilla 2 · ahora</span>
              </span>
            </div>
          </div>
        </section>

        {/* Elige qué necesitas: botones grandes */}
        <section className="max-w-7xl mx-auto px-4 pt-12 pb-16">
          <h2 className="font-titulo text-3xl font-extrabold text-marca-noche">¿Qué necesitas hoy?</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {[
              [Search, 'Saber si mis medicamentos están', '/paciente'],
              [CalendarCheck, 'Pedir un turno para reclamar', '/paciente'],
              [Wallet, 'Saber cuánto debo pagar', '/paciente'],
              [Accessibility, 'Tengo atención preferencial', '#ayuda'],
            ].map(([Icono, texto, a]) => (
              <Link key={texto} to={a}
                className="group flex items-center gap-5 bg-white border-2 border-slate-200 hover:border-marca-azul rounded-2xl p-5 text-xl font-bold text-marca-noche transition">
                <span className="w-14 h-14 rounded-xl bg-marca-hielo text-marca-azul flex items-center justify-center shrink-0 group-hover:bg-marca-azul group-hover:text-white transition">
                  <Icono className="w-7 h-7" />
                </span>
                {texto}
                <ArrowRight className="w-6 h-6 ml-auto text-slate-400 group-hover:text-marca-azul" />
              </Link>
            ))}
          </div>
        </section>

        {/* Horario y ayuda */}
        <section id="ayuda" className="bg-marca-verde-oscuro text-white">
          <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-8 text-lg">
            <div className="flex gap-3"><Clock className="w-7 h-7 shrink-0" /><p><strong className="block">Horario</strong>Lunes a sábado, 7:00 a. m. a 7:00 p. m.</p></div>
            <div className="flex gap-3"><Phone className="w-7 h-7 shrink-0" /><p><strong className="block">¿Te ayudamos?</strong>Llama al (000) 000 0000</p></div>
            <div className="flex gap-3"><Accessibility className="w-7 h-7 shrink-0" /><p><strong className="block">Atención preferencial</strong>Adultos mayores, embarazadas y personas con discapacidad.</p></div>
          </div>
        </section>
      </div>
      <Faq grande />
    </SitioPublico>
  );
}

function Faq({ grande = false }) {
  return (
    <section className="max-w-4xl mx-auto px-4 py-16 pb-24">
      <h2 className="font-titulo text-3xl font-extrabold text-marca-noche mb-6">Preguntas frecuentes</h2>
      <div className="border-t border-slate-200">
        {PREGUNTAS.map(([p, r]) => (
          <details key={p} className="group border-b border-slate-200">
            <summary className={`cursor-pointer list-none flex items-center justify-between gap-6 py-5 font-bold text-marca-noche ${grande ? 'text-xl' : 'text-lg'}`}>
              {p}
              <span className="text-2xl text-marca-verde font-normal group-open:rotate-45 transition" aria-hidden="true">+</span>
            </summary>
            <p className={`pb-5 text-slate-600 ${grande ? 'text-lg' : ''}`}>{r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
