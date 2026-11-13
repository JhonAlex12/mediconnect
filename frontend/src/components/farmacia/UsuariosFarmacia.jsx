import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, Pencil, Power, Search, UserPlus, Users, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useSesion } from '../../lib/sesion';
import { Aviso, BotonAccion, claseCampo, useAccion } from './comunes';

const ROLES = { auxiliar: 'Auxiliar', domicilios: 'Pedidos y domicilios', administrador: 'Administrador', medico: 'Médico (sistema IPS)' };
const CAJAS = [1, 2, 3, 4, 5, 6];
const nombreCaja = (c) => (c ? (c === 6 ? 'Caja 6 · Preferencial' : `Caja ${c}`) : '—');

// Misma regla que el backend
const claveValida = (c) => c.length >= 10 && /[a-zA-Z]/.test(c) && /\d/.test(c);
const AYUDA_CLAVE = 'Mínimo 10 caracteres, con letras y números.';

// Sin tildes ni mayúsculas, para que "maria" encuentre a "María"
const normalizar = (t) => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function UsuariosFarmacia() {
  const { usuario: yo } = useSesion();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null); // { id, modo: 'datos' | 'clave' }
  const [resaltado, setResaltado] = useState(null); // fila recién guardada, se ilumina un momento
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const cargar = useCallback(async () => {
    try {
      const d = await api('/usuarios');
      setUsuarios(d.usuarios);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }, []);

  const { ocupado, aviso, setAviso, ejecutar } = useAccion(cargar);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarEstado = (u) =>
    ejecutar(
      () => api(`/usuarios/${u.id}`, { metodo: 'PATCH', cuerpo: { activo: !u.activo } }),
      `${u.nombre} ${u.activo ? 'desactivado: ya no puede iniciar sesión' : 'activado'}`
    );

  // Búsqueda por nombre, usuario, rol o caja, más los filtros de rol y estado
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  const visibles = usuarios.filter((u) => {
    if (filtroRol && u.rol !== filtroRol) return false;
    if (filtroEstado && u.activo !== (filtroEstado === 'activos')) return false;
    const texto = normalizar(`${u.nombre} ${u.usuario} ${ROLES[u.rol] ?? u.rol} ${nombreCaja(u.caja)}`);
    return palabras.every((p) => texto.includes(p));
  });
  const hayFiltros = busqueda || filtroRol || filtroEstado;
  const limpiarFiltros = () => { setBusqueda(''); setFiltroRol(''); setFiltroEstado(''); };

  // Abre el formulario debajo de la fila; si ya estaba abierto en el mismo modo, lo cierra
  const alternar = (id, modo) =>
    setEditando((e) => (e?.id === id && e.modo === modo ? null : { id, modo }));

  const alGuardar = (id) => {
    setEditando(null);
    setResaltado(id);
  };
  useEffect(() => {
    if (!resaltado) return;
    const t = setTimeout(() => setResaltado(null), 2500);
    return () => clearTimeout(t);
  }, [resaltado]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-slate-600" />
          Usuarios
        </h2>
        <BotonAccion color="azul" icono={UserPlus} onClick={() => setCreando((v) => !v)}>
          Nuevo usuario
        </BotonAccion>
      </div>

      <Aviso aviso={aviso} />

      {creando && <NuevoUsuario ocupado={ocupado} ejecutar={ejecutar} alCerrar={() => setCreando(false)} />}

      <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-56 max-w-md">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, usuario o caja" aria-label="Buscar usuarios"
              className={`${claseCampo} pl-10`} />
          </div>
          <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} aria-label="Filtrar por rol"
            className={claseCampo.replace('w-full ', '')}>
            <option value="">Todos los roles</option>
            {Object.entries(ROLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado"
            className={claseCampo.replace('w-full ', '')}>
            <option value="">Activos e inactivos</option>
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
          </select>
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className="text-sm font-semibold text-marca-azul hover:underline cursor-pointer">
              Limpiar filtros
            </button>
          )}
          {!cargando && (
            <span className="ml-auto text-sm text-slate-500">
              {hayFiltros ? `${visibles.length} de ${usuarios.length}` : usuarios.length} usuarios
            </span>
          )}
        </div>
        {cargando ? (
          <p className="p-6 text-slate-500">Cargando usuarios…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-5 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Usuario</th>
                  <th className="px-3 py-2 font-semibold">Rol</th>
                  <th className="px-3 py-2 font-semibold">Caja</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold">Creado</th>
                  <th className="px-5 py-2 font-semibold sr-only">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                      Ningún usuario coincide con la búsqueda.
                    </td>
                  </tr>
                )}
                {visibles.map((u) => {
                  const esYo = u.id === yo.id;
                  const abierto = editando?.id === u.id;
                  const fondo = abierto ? 'bg-marca-hielo' : resaltado === u.id ? 'bg-[#dcebf8]' : '';
                  return (
                    <Fragment key={u.id}>
                    <tr className={`transition-colors duration-700 ${fondo} ${u.activo ? '' : 'text-slate-400'}`}>
                      <td className="px-5 py-3 font-semibold">
                        <span className={u.activo ? 'text-slate-900' : ''}>{u.nombre}</span>
                        {esYo && <span className="ml-2 text-xs font-bold bg-marca-azul text-white px-2 py-0.5 rounded-full">Tú</span>}
                      </td>
                      <td className="px-3 py-3 font-mono text-sm">{u.usuario}</td>
                      <td className="px-3 py-3">{ROLES[u.rol] ?? u.rol}</td>
                      <td className="px-3 py-3 text-sm">{nombreCaja(u.caja)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          u.activo ? 'bg-marca-hielo text-marca-azul-oscuro ring-1 ring-marca-azul/25' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm">{fecha(u.creado_en)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <BotonAccion color="azulSuave" icono={Pencil} ocupado={ocupado}
                            onClick={() => alternar(u.id, 'datos')}>
                            Editar
                          </BotonAccion>
                          <BotonAccion color="azulSuave" icono={KeyRound} ocupado={ocupado}
                            onClick={() => alternar(u.id, 'clave')}>
                            Clave
                          </BotonAccion>
                          {!esYo && (
                            <BotonAccion color={u.activo ? 'contorno' : 'azul'} icono={Power} ocupado={ocupado}
                              onClick={() => cambiarEstado(u)}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </BotonAccion>
                          )}
                        </div>
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="bg-marca-hielo">
                        <td colSpan={7} className="px-5 pb-4">
                          <EditarUsuario
                            key={editando.modo}
                            u={u}
                            modo={editando.modo}
                            esYo={esYo}
                            ocupado={ocupado}
                            ejecutar={ejecutar}
                            alCerrar={() => setEditando(null)}
                            alGuardar={() => alGuardar(u.id)}
                          />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tarjeta({ titulo, icono: Icono, alCerrar, embebida = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (embebida) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [embebida]);
  return (
    <section ref={ref} onKeyDown={(e) => e.key === 'Escape' && alCerrar()}
      className={`bg-white overflow-hidden ${embebida
        ? 'rounded-lg border-2 border-marca-azul/40 shadow-sm'
        : 'rounded-xl shadow-md border border-slate-300'}`}>
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Icono className="w-5 h-5 text-marca-azul" />
          {titulo}
        </h3>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="p-1 rounded hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      {children}
    </section>
  );
}

function SelectorRol({ id, valor, onChange, disabled }) {
  return (
    <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      className={`${claseCampo} disabled:bg-slate-100`}>
      {Object.entries(ROLES).map(([v, t]) => (
        <option key={v} value={v}>{t}</option>
      ))}
    </select>
  );
}

// Caja fija del auxiliar ("" = elige la caja en su equipo)
function SelectorCaja({ id, valor, onChange, disabled }) {
  return (
    <select id={id} value={valor ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled} className={`${claseCampo} disabled:bg-slate-100`}>
      <option value="">Sin caja fija</option>
      {CAJAS.map((c) => <option key={c} value={c}>{nombreCaja(c)}</option>)}
    </select>
  );
}

function NuevoUsuario({ ocupado, ejecutar, alCerrar }) {
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [rol, setRol] = useState('auxiliar');
  const [caja, setCaja] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api('/usuarios', { metodo: 'POST', cuerpo: { nombre, usuario, clave, rol, caja: rol === 'auxiliar' ? caja : null } }),
      (r) => `Usuario ${r.usuario.usuario} creado`
    );
    if (ok) alCerrar();
  };

  return (
    <Tarjeta titulo="Nuevo usuario" icono={UserPlus} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_1fr_11rem_11rem_auto] lg:items-start">
        <div>
          <label htmlFor="nu-nombre" className="block text-sm font-bold text-slate-800 mb-1">Nombre completo</label>
          <input id="nu-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3}
            className={claseCampo} />
        </div>
        <div>
          <label htmlFor="nu-usuario" className="block text-sm font-bold text-slate-800 mb-1">Usuario</label>
          <input id="nu-usuario" value={usuario} required pattern="[a-z0-9._\-]{3,40}"
            title="3 a 40 caracteres: letras minúsculas, números, punto o guion"
            onChange={(e) => setUsuario(e.target.value.toLowerCase())} autoComplete="off"
            className={`${claseCampo} font-mono`} />
        </div>
        <div>
          <label htmlFor="nu-clave" className="block text-sm font-bold text-slate-800 mb-1">Contraseña inicial</label>
          <input id="nu-clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} required
            autoComplete="new-password" className={claseCampo} />
          <p className={`text-xs mt-1 ${clave && !claveValida(clave) ? 'text-red-700' : 'text-slate-500'}`}>{AYUDA_CLAVE}</p>
        </div>
        <div>
          <label htmlFor="nu-rol" className="block text-sm font-bold text-slate-800 mb-1">Rol</label>
          <SelectorRol id="nu-rol" valor={rol} onChange={setRol} />
        </div>
        <div>
          <label htmlFor="nu-caja" className="block text-sm font-bold text-slate-800 mb-1">Caja</label>
          <SelectorCaja id="nu-caja" valor={rol === 'auxiliar' ? caja : null} onChange={setCaja} disabled={rol !== 'auxiliar'} />
        </div>
        <div className="lg:pt-6">
          <BotonAccion type="submit" color="azul" ocupado={ocupado || !claveValida(clave)}>
            Crear
          </BotonAccion>
        </div>
      </form>
    </Tarjeta>
  );
}

function EditarUsuario({ u, modo, esYo, ocupado, ejecutar, alCerrar, alGuardar }) {
  const [nombre, setNombre] = useState(u.nombre);
  const [rol, setRol] = useState(u.rol);
  const [caja, setCaja] = useState(u.caja);
  const [clave, setClave] = useState('');
  const [confirmacion, setConfirmacion] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    let cuerpo;
    let exito;
    if (modo === 'clave') {
      cuerpo = { clave };
      exito = `Contraseña de ${u.nombre} cambiada`;
    } else {
      cuerpo = {};
      if (nombre.trim() !== u.nombre) cuerpo.nombre = nombre.trim();
      if (rol !== u.rol) cuerpo.rol = rol;
      const cajaFinal = rol === 'auxiliar' ? caja : null;
      if (cajaFinal !== u.caja) cuerpo.caja = cajaFinal;
      exito = `${nombre.trim()} actualizado`;
    }
    const ok = await ejecutar(() => api(`/usuarios/${u.id}`, { metodo: 'PATCH', cuerpo }), exito);
    if (ok) alGuardar();
  };

  if (modo === 'clave') {
    const coinciden = clave === confirmacion;
    return (
      <Tarjeta titulo={`Cambiar contraseña: ${u.nombre}`} icono={KeyRound} alCerrar={alCerrar} embebida>
        <form onSubmit={enviar} className="p-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <div>
            <label htmlFor="ec-clave" className="block text-sm font-bold text-slate-800 mb-1">Nueva contraseña</label>
            <input id="ec-clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} required
              autoComplete="new-password" autoFocus className={claseCampo} />
            <p className={`text-xs mt-1 ${clave && !claveValida(clave) ? 'text-red-700' : 'text-slate-500'}`}>{AYUDA_CLAVE}</p>
          </div>
          <div>
            <label htmlFor="ec-confirmar" className="block text-sm font-bold text-slate-800 mb-1">Repetir contraseña</label>
            <input id="ec-confirmar" type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)}
              required autoComplete="new-password" className={claseCampo} />
            {confirmacion && !coinciden && <p className="text-xs mt-1 text-red-700">No coinciden.</p>}
          </div>
          <div className="sm:pt-6">
            <BotonAccion type="submit" color="azul" ocupado={ocupado || !claveValida(clave) || !coinciden}>
              Guardar
            </BotonAccion>
          </div>
        </form>
      </Tarjeta>
    );
  }

  const sinCambios = nombre.trim() === u.nombre && rol === u.rol && (rol === 'auxiliar' ? caja : null) === u.caja;
  return (
    <Tarjeta titulo={`Editar: ${u.nombre}`} icono={Pencil} alCerrar={alCerrar} embebida>
      <form onSubmit={enviar} className="p-5 grid gap-4 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-start">
        <div>
          <label htmlFor="eu-nombre" className="block text-sm font-bold text-slate-800 mb-1">Nombre completo</label>
          <input id="eu-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3}
            autoFocus className={claseCampo} />
        </div>
        <div>
          <label htmlFor="eu-rol" className="block text-sm font-bold text-slate-800 mb-1">Rol</label>
          <SelectorRol id="eu-rol" valor={rol} onChange={setRol} disabled={esYo} />
          {esYo && <p className="text-xs mt-1 text-slate-500">No puedes quitarte el rol de administrador.</p>}
        </div>
        <div>
          <label htmlFor="eu-caja" className="block text-sm font-bold text-slate-800 mb-1">Caja</label>
          <SelectorCaja id="eu-caja" valor={rol === 'auxiliar' ? caja : null} onChange={setCaja} disabled={rol !== 'auxiliar'} />
        </div>
        <div className="sm:pt-6">
          <BotonAccion type="submit" color="azul" ocupado={ocupado || sinCambios || nombre.trim().length < 3}>
            Guardar
          </BotonAccion>
        </div>
      </form>
    </Tarjeta>
  );
}
