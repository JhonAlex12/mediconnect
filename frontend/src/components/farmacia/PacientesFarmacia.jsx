import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Bike, ChevronLeft, ChevronRight, ClipboardList, KeyRound, Mail, MailCheck, Power,
  Search, ShieldCheck, Ticket, UserRound, Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSesion } from '../../lib/sesion';
import { Aviso, BotonAccion, claseCampo, useAccion } from './comunes';

// Pacientes: el administrador ve la lista y gestiona las cuentas; el auxiliar busca por documento.
// La farmacia nunca ve ni cambia la contraseña ni los datos personales (los corrige el paciente).

const FILTROS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'con_cuenta', texto: 'Con cuenta' },
  { valor: 'sin_cuenta', texto: 'Sin cuenta' },
  { valor: 'con_pendientes', texto: 'Con fórmulas pendientes' },
  { valor: 'cuenta_inactiva', texto: 'Cuenta desactivada' },
];

const ESTADOS_FORMULA = {
  pendiente: { texto: 'Pendiente', clase: 'bg-amber-100 text-amber-900' },
  parcial: { texto: 'Entrega parcial', clase: 'bg-sky-100 text-sky-900' },
  entregada: { texto: 'Entregada', clase: 'bg-emerald-100 text-emerald-900' },
  vencida: { texto: 'Vencida', clase: 'bg-slate-200 text-slate-600' },
};
const ESTADOS_TURNO = {
  reservado: 'Reservado', en_camino: 'En camino', presente: 'En la sala', llamado: 'Llamado', atendido: 'Atendido',
  en_pausa: 'En pausa', vencido: 'Vencido', cancelado: 'Cancelado',
};
const ESTADOS_DOMICILIO = {
  recibido: 'Recibido', en_preparacion: 'En preparación', en_camino: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado',
};
const EXENCIONES = {
  promocion_prevencion: 'Promoción y prevención', control_prenatal: 'Control prenatal', alto_costo: 'Alto costo', urgencia: 'Urgencia',
};
const SEXOS = { F: 'Femenino', M: 'Masculino', O: 'Otro' };

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;
// Las fechas sin hora (AAAA-MM-DD) se leen al mediodía para que no se corran un día
const fecha = (v) => {
  if (!v) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fechaHora = (v) =>
  v ? new Date(v).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const afiliacionTexto = (a) => {
  if (!a?.regimen) return 'Sin registrar';
  const regimen = a.regimen === 'contributivo' ? 'Contributivo' : 'Subsidiado';
  return `${regimen}${a.rango_ingreso ? ` · Rango ${a.rango_ingreso}` : ''}`;
};

function Etiqueta({ clase, children }) {
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${clase}`}>{children}</span>;
}

function EtiquetaCuenta({ tiene, activa, verificado }) {
  if (!tiene) return <Etiqueta clase="bg-slate-100 text-slate-600">Sin cuenta</Etiqueta>;
  if (!activa) return <Etiqueta clase="bg-red-100 text-red-800">Cuenta desactivada</Etiqueta>;
  if (!verificado) return <Etiqueta clase="bg-amber-100 text-amber-900">Correo sin confirmar</Etiqueta>;
  return <Etiqueta clase="bg-marca-hielo text-marca-azul-oscuro ring-1 ring-marca-azul/25">Con cuenta</Etiqueta>;
}

export default function PacientesFarmacia() {
  const { usuario } = useSesion();
  const esAdmin = usuario.rol === 'administrador';
  const [abierto, setAbierto] = useState(null); // documento de la ficha abierta

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Users className="w-6 h-6 text-slate-600" />
        Pacientes
      </h2>
      {abierto ? (
        <Ficha documento={abierto} esAdmin={esAdmin} alVolver={() => setAbierto(null)} />
      ) : esAdmin ? (
        <Lista alAbrir={setAbierto} />
      ) : (
        <BuscarDocumento alAbrir={setAbierto} />
      )}
    </div>
  );
}

// ---------- Auxiliar: solo el documento exacto ----------

function BuscarDocumento({ alAbrir }) {
  const [documento, setDocumento] = useState('');
  return (
    <section className="bg-white rounded-xl shadow-md border border-slate-300 p-5 max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (documento.trim()) alAbrir(documento.trim());
        }}
        className="space-y-3"
      >
        <label htmlFor="buscar-documento" className="block font-semibold text-slate-700">Documento del paciente</label>
        <div className="flex gap-2">
          <input id="buscar-documento" autoFocus inputMode="numeric" autoComplete="off" value={documento}
            onChange={(e) => setDocumento(e.target.value.replace(/\s/g, ''))} className={`${claseCampo} font-mono`} />
          <BotonAccion type="submit" color="azul" icono={Search}>Buscar</BotonAccion>
        </div>
        <p className="text-sm text-slate-500">Escriba el número completo. Cada consulta queda registrada.</p>
      </form>
    </section>
  );
}

// ---------- Administrador: lista con búsqueda y filtros ----------

function Lista({ alAbrir }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  // Espera a que deje de escribir antes de buscar
  useEffect(() => {
    let vigente = true;
    const espera = setTimeout(() => {
      const params = new URLSearchParams({ q: busqueda.trim(), filtro, pagina: String(pagina) });
      api(`/pacientes?${params}`)
        .then((d) => vigente && (setDatos(d), setError(null)))
        .catch((e) => vigente && setError({ tipo: 'error', texto: e.message }));
    }, busqueda ? 300 : 0);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [busqueda, filtro, pagina]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;

  return (
    <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56 max-w-md">
          <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="Buscar por nombre, documento, celular o correo" aria-label="Buscar pacientes"
            className={`${claseCampo} pl-10`} />
        </div>
        <select value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1); }} aria-label="Filtrar pacientes"
          className={claseCampo.replace('w-full ', '')}>
          {FILTROS.map((f) => <option key={f.valor} value={f.valor}>{f.texto}</option>)}
        </select>
        {datos && <span className="ml-auto text-sm text-slate-500">{datos.total} pacientes</span>}
      </div>

      {error && <div className="p-4"><Aviso aviso={error} /></div>}

      {!datos ? (
        <p className="p-6 text-slate-500">Cargando pacientes…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-5 py-2 font-semibold">Paciente</th>
                <th className="px-3 py-2 font-semibold">Celular</th>
                <th className="px-3 py-2 font-semibold">Afiliación</th>
                <th className="px-3 py-2 font-semibold">Cuenta</th>
                <th className="px-3 py-2 font-semibold text-center">Pendientes</th>
                <th className="px-5 py-2 font-semibold">Última fórmula</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {datos.pacientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">Ningún paciente coincide con la búsqueda.</td>
                </tr>
              )}
              {datos.pacientes.map((p) => (
                <tr key={p.documento} onClick={() => alAbrir(p.documento)}
                  className="hover:bg-marca-hielo cursor-pointer transition-colors">
                  <td className="px-5 py-3">
                    <button type="button" onClick={(e) => { e.stopPropagation(); alAbrir(p.documento); }}
                      className="font-semibold text-slate-900 hover:text-marca-azul hover:underline text-left cursor-pointer">
                      {p.nombre}
                    </button>
                    <p className="text-sm text-slate-500 font-mono">{p.documento}</p>
                  </td>
                  <td className="px-3 py-3 font-mono text-sm">{p.celular ?? '—'}</td>
                  <td className="px-3 py-3 text-sm">
                    {afiliacionTexto(p)}
                    {p.eps && <span className="block text-slate-500">{p.eps}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <EtiquetaCuenta tiene={p.tiene_cuenta} activa={p.cuenta_activa} verificado={p.correo_verificado} />
                  </td>
                  <td className="px-3 py-3 text-center font-semibold">{p.pendientes || <span className="text-slate-400">0</span>}</td>
                  <td className="px-5 py-3 text-sm">{fecha(p.ultima_formula)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {datos && paginas > 1 && (
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-3 text-sm">
          <span className="text-slate-600">Página {pagina} de {paginas}</span>
          <BotonAccion color="contorno" icono={ChevronLeft} ocupado={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
            Anterior
          </BotonAccion>
          <BotonAccion color="contorno" icono={ChevronRight} ocupado={pagina >= paginas} onClick={() => setPagina((n) => n + 1)}>
            Siguiente
          </BotonAccion>
        </div>
      )}
    </section>
  );
}

// ---------- Ficha del paciente ----------

function Dato({ titulo, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{titulo}</dt>
      <dd className="text-slate-900">{children ?? '—'}</dd>
    </div>
  );
}

function Bloque({ titulo, icono: Icono, extra, children }) {
  return (
    <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Icono className="w-5 h-5 text-marca-azul" />
          {titulo}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Ficha({ documento, esAdmin, alVolver }) {
  const [p, setP] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const arriba = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const d = await api(`/pacientes/${encodeURIComponent(documento)}`);
      setP(d.paciente);
      setErrorCarga(null);
    } catch (e) {
      setErrorCarga(e.message);
    }
  }, [documento]);

  const { ocupado, aviso, ejecutar } = useAccion(cargar);

  useEffect(() => {
    cargar();
    arriba.current?.scrollIntoView({ block: 'start' });
  }, [cargar]);

  const volver = (
    <button type="button" onClick={alVolver}
      className="flex items-center gap-1.5 text-sm font-semibold text-marca-azul hover:underline cursor-pointer">
      <ArrowLeft className="w-4 h-4" /> {esAdmin ? 'Volver a la lista' : 'Buscar otro paciente'}
    </button>
  );

  if (errorCarga) {
    return (
      <div ref={arriba} className="space-y-4">
        {volver}
        <Aviso aviso={{ tipo: 'error', texto: errorCarga }} />
      </div>
    );
  }
  if (!p) return <p ref={arriba} className="text-slate-500">Cargando ficha…</p>;

  const c = p.cuenta;
  const accion = (ruta, metodo, cuerpo, exito) =>
    ejecutar(() => api(`/pacientes/${encodeURIComponent(p.documento)}/cuenta${ruta}`, { metodo, cuerpo }), exito);

  return (
    <div ref={arriba} className="space-y-5">
      {volver}
      <Aviso aviso={aviso} />

      {/* Encabezado */}
      <section className="bg-white rounded-xl shadow-md border border-slate-300 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="w-12 h-12 rounded-full bg-marca-hielo text-marca-azul flex items-center justify-center shrink-0">
              <UserRound className="w-6 h-6" />
            </span>
            <div>
              <p className="text-xl font-bold text-slate-900">{p.nombre}</p>
              <p className="text-slate-600 font-mono">{c?.tipo_documento ?? 'CC'} {p.documento}</p>
            </div>
          </div>
          <EtiquetaCuenta tiene={!!c} activa={c?.activa} verificado={c?.correo_verificado} />
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <Dato titulo="Celular"><span className="font-mono">{p.celular ?? '—'}</span></Dato>
          <Dato titulo="Afiliación">{afiliacionTexto(p.afiliacion)}</Dato>
          <Dato titulo="EPS">{p.afiliacion.eps}</Dato>
          <Dato titulo="Faltas seguidas a turnos">{p.faltas_seguidas}</Dato>
        </dl>
      </section>

      {/* Cuenta */}
      {c && (
        <Bloque titulo="Cuenta en Mediconnect" icono={ShieldCheck}>
          <div className="p-5 space-y-4">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Dato titulo="Correo">
                <span className="break-all">{c.correo}</span>
                <span className={`block text-xs font-semibold ${c.correo_verificado ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {c.correo_verificado ? 'Confirmado' : 'Sin confirmar'}
                </span>
              </Dato>
              {esAdmin && (
                <>
                  <Dato titulo="Nacimiento">{fecha(c.fecha_nacimiento)}</Dato>
                  <Dato titulo="Sexo">{SEXOS[c.sexo]}</Dato>
                  <Dato titulo="Dirección">
                    {c.direccion}
                    <span className="block text-sm text-slate-500">{[c.barrio, c.ciudad].filter(Boolean).join(', ')}</span>
                  </Dato>
                  <Dato titulo="Último ingreso">{fechaHora(c.ultimo_ingreso)}</Dato>
                </>
              )}
              <Dato titulo="Cuenta creada">{fecha(c.creado_en)}</Dato>
            </dl>

            {esAdmin && (
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {c.activa && !c.correo_verificado && (
                    <BotonAccion color="azulSuave" icono={MailCheck} ocupado={ocupado}
                      onClick={() => accion('/reenviar-confirmacion', 'POST', undefined, (r) => `Enlace de confirmación enviado a ${r.correo}`)}>
                      Reenviar confirmación del correo
                    </BotonAccion>
                  )}
                  {c.activa && (
                    <BotonAccion color="azulSuave" icono={KeyRound} ocupado={ocupado}
                      onClick={() => accion('/cambio-clave', 'POST', undefined, (r) => `Enlace para cambiar la contraseña enviado a ${r.correo}`)}>
                      Enviar enlace para cambiar la contraseña
                    </BotonAccion>
                  )}
                  <BotonAccion color={c.activa ? 'contorno' : 'azul'} icono={Power} ocupado={ocupado}
                    onClick={() => {
                      if (c.activa && !window.confirm(`¿Desactivar la cuenta de ${p.nombre}? No podrá iniciar sesión hasta que la active de nuevo.`)) return;
                      accion('', 'PATCH', { activa: !c.activa },
                        c.activa ? 'Cuenta desactivada: el paciente ya no puede iniciar sesión' : 'Cuenta activada');
                    }}>
                    {c.activa ? 'Desactivar cuenta' : 'Activar cuenta'}
                  </BotonAccion>
                </div>
                <p className="text-sm text-slate-500 flex items-start gap-1.5">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                  La farmacia no ve ni cambia la contraseña ni los datos personales: el paciente los corrige en «Mi cuenta».
                  Cada acción queda registrada y el paciente la ve en su historial.
                </p>
              </div>
            )}
          </div>
        </Bloque>
      )}

      {/* Fórmulas */}
      <Bloque titulo="Fórmulas" icono={ClipboardList} extra={<span className="text-sm text-slate-500">{p.formulas.length}</span>}>
        {p.formulas.length === 0 ? (
          <p className="p-5 text-slate-500">Este paciente aún no tiene fórmulas.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {p.formulas.map((f) => {
              const e = ESTADOS_FORMULA[f.estado];
              return (
                <li key={f.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-mono font-bold text-slate-900">{f.codigo}</p>
                      <p className="text-sm text-slate-500">
                        Emitida {fecha(f.fecha_emision)} · Reclamar hasta {fecha(f.fecha_limite)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Etiqueta clase={e.clase}>{e.texto}</Etiqueta>
                      <span className="text-sm text-slate-700">
                        {f.cuota_moderadora > 0 ? `Cuota ${pesos(f.cuota_moderadora)}` : f.exencion ? `Exento: ${EXENCIONES[f.exencion]}` : 'Sin cuota'}
                        {f.pago_valor ? <span className="text-emerald-700 font-semibold"> · pagada</span> : null}
                      </span>
                    </div>
                  </div>
                  {f.indicaciones && (
                    <p className="mt-2 text-sm bg-slate-50 border border-slate-200 rounded-md px-3 py-2 whitespace-pre-wrap">
                      <span className="font-semibold text-slate-700">Indicaciones: </span>{f.indicaciones}
                    </p>
                  )}
                  <ul className="mt-2 text-sm space-y-0.5">
                    {f.items.map((i, n) => (
                      <li key={n} className="flex justify-between gap-3">
                        <span className="text-slate-800">{i.nombre} <span className="text-slate-500">{i.presentacion}</span></span>
                        <span className={`font-mono ${i.entregada >= i.formulada ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {i.entregada}/{i.formulada}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Bloque>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Bloque titulo="Turnos recientes" icono={Ticket}>
          {p.turnos.length === 0 ? (
            <p className="p-5 text-slate-500">Sin turnos.</p>
          ) : (
            <ul className="divide-y divide-slate-200 text-sm">
              {p.turnos.map((t, n) => (
                <li key={n} className="px-5 py-2.5 flex justify-between gap-3">
                  <span>
                    <span className="font-mono font-bold">{t.numero}</span>{' '}
                    <span className="text-slate-500">{fecha(t.fecha)}{t.formula ? ` · ${t.formula}` : ''}</span>
                  </span>
                  <span className="text-slate-700">{ESTADOS_TURNO[t.estado] ?? t.estado}{t.caja ? ` · Caja ${t.caja}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloque>
        <Bloque titulo="Domicilios" icono={Bike}>
          {!c ? (
            <p className="p-5 text-slate-500">Solo los pacientes con cuenta piden domicilios.</p>
          ) : p.domicilios.length === 0 ? (
            <p className="p-5 text-slate-500">Sin domicilios.</p>
          ) : (
            <ul className="divide-y divide-slate-200 text-sm">
              {p.domicilios.map((d) => (
                <li key={d.id} className="px-5 py-2.5 flex justify-between gap-3">
                  <span>
                    <span className="font-mono font-bold">{d.formula}</span>{' '}
                    <span className="text-slate-500">{fecha(d.creado_en)}{d.barrio ? ` · ${d.barrio}` : ''}</span>
                  </span>
                  <span className="text-slate-700">{ESTADOS_DOMICILIO[d.estado] ?? d.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloque>
      </div>
    </div>
  );
}
