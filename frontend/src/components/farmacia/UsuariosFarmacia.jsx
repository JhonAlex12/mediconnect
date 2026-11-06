import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Pencil, Power, UserPlus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useSesion } from '../../lib/sesion';
import { Aviso, BotonAccion, useAccion } from './comunes';
import {
  Boton, Campo, Cargando, Cuerpo, Encabezado, Entrada, EstadoBadge, EstadoVacio, Fila, Panel, Selector, Tabla, Td,
  Th, TituloPantalla,
} from '../ui';

const ROLES = { auxiliar: 'Auxiliar', administrador: 'Administrador' };

// Misma regla que el backend
const claveValida = (c) => c.length >= 10 && /[a-zA-Z]/.test(c) && /\d/.test(c);
const AYUDA_CLAVE = 'Mínimo 10 caracteres, con letras y números.';

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function UsuariosFarmacia() {
  const { usuario: yo } = useSesion();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null); // { id, modo: 'datos' | 'clave' }

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

  const enEdicion = usuarios.find((u) => u.id === editando?.id);

  return (
    <div>
      <TituloPantalla
        titulo="Usuarios"
        descripcion="Empleados con acceso al panel de la farmacia"
        acciones={
          <Boton variante="primario" icono={UserPlus} onClick={() => setCreando((v) => !v)} aria-expanded={creando}>
            Nuevo usuario
          </Boton>
        }
      />

      <div className="space-y-5">
        <Aviso aviso={aviso} />

        {creando && <NuevoUsuario ocupado={ocupado} ejecutar={ejecutar} alCerrar={() => setCreando(false)} />}

        {enEdicion && (
          <EditarUsuario
            key={`${enEdicion.id}-${editando.modo}`}
            u={enEdicion}
            modo={editando.modo}
            esYo={enEdicion.id === yo.id}
            ocupado={ocupado}
            ejecutar={ejecutar}
            alCerrar={() => setEditando(null)}
          />
        )}

        <Panel sinRelleno>
          {cargando ? (
            <Cargando texto="Cargando usuarios…" />
          ) : usuarios.length === 0 ? (
            <EstadoVacio titulo="No hay usuarios" />
          ) : (
            <Tabla etiqueta="Usuarios de la farmacia">
              <Encabezado>
                <Th>Nombre</Th>
                <Th>Usuario</Th>
                <Th>Rol</Th>
                <Th>Estado</Th>
                <Th numero>Creado</Th>
                <Th oculto>Acciones</Th>
              </Encabezado>
              <Cuerpo>
                {usuarios.map((u) => {
                  const esYo = u.id === yo.id;
                  return (
                    <Fila key={u.id} tenue={!u.activo}>
                      <Td className={`font-bold ${u.activo ? 'text-tinta' : ''}`}>
                        {u.nombre}
                        {esYo && <span className="ml-2 font-normal text-tinta-suave">(tú)</span>}
                      </Td>
                      <Td className="cifras">{u.usuario}</Td>
                      <Td>{ROLES[u.rol] ?? u.rol}</Td>
                      <Td>
                        <EstadoBadge tono={u.activo ? 'ok' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</EstadoBadge>
                      </Td>
                      <Td numero>{fecha(u.creado_en)}</Td>
                      <Td>
                        <div className="flex gap-2 justify-end flex-wrap">
                          <BotonAccion color="gris" icono={Pencil} ocupado={ocupado}
                            onClick={() => setEditando({ id: u.id, modo: 'datos' })}>
                            Editar
                          </BotonAccion>
                          <BotonAccion color="gris" icono={KeyRound} ocupado={ocupado}
                            onClick={() => setEditando({ id: u.id, modo: 'clave' })}>
                            Clave
                          </BotonAccion>
                          {!esYo && (
                            <BotonAccion color={u.activo ? 'rojo' : 'gris'} icono={Power} ocupado={ocupado}
                              onClick={() => cambiarEstado(u)}>
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </BotonAccion>
                          )}
                        </div>
                      </Td>
                    </Fila>
                  );
                })}
              </Cuerpo>
            </Tabla>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Tarjeta({ titulo, alCerrar, children }) {
  return (
    <Panel titulo={titulo} acciones={<Boton variante="fantasma" tamano="sm" icono={X} onClick={alCerrar}>Cerrar</Boton>}>
      {children}
    </Panel>
  );
}

function SelectorRol({ valor, onChange, disabled }) {
  return (
    <Selector value={valor} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {Object.entries(ROLES).map(([v, t]) => (
        <option key={v} value={v}>{t}</option>
      ))}
    </Selector>
  );
}

function NuevoUsuario({ ocupado, ejecutar, alCerrar }) {
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [rol, setRol] = useState('auxiliar');

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api('/usuarios', { metodo: 'POST', cuerpo: { nombre, usuario, clave, rol } }),
      (r) => `Usuario ${r.usuario.usuario} creado`
    );
    if (ok) alCerrar();
  };

  return (
    <Tarjeta titulo="Nuevo usuario" alCerrar={alCerrar}>
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_1fr_10rem_auto] lg:items-start">
        <Campo id="nu-nombre" etiqueta="Nombre completo">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} />
        </Campo>
        <Campo id="nu-usuario" etiqueta="Usuario" ayuda="Minúsculas, números, punto o guion">
          <Entrada value={usuario} required pattern="[a-z0-9._\-]{3,40}"
            onChange={(e) => setUsuario(e.target.value.toLowerCase())} autoComplete="off" className="cifras" />
        </Campo>
        <Campo id="nu-clave" etiqueta="Contraseña inicial"
          ayuda={!clave || claveValida(clave) ? AYUDA_CLAVE : undefined}
          error={clave && !claveValida(clave) ? AYUDA_CLAVE : undefined}>
          <Entrada type="password" value={clave} onChange={(e) => setClave(e.target.value)} required
            autoComplete="new-password" />
        </Campo>
        <Campo id="nu-rol" etiqueta="Rol">
          <SelectorRol valor={rol} onChange={setRol} />
        </Campo>
        <div className="lg:pt-6">
          <Boton type="submit" variante="primario" disabled={ocupado || !claveValida(clave)}>
            Crear
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

function EditarUsuario({ u, modo, esYo, ocupado, ejecutar, alCerrar }) {
  const [nombre, setNombre] = useState(u.nombre);
  const [rol, setRol] = useState(u.rol);
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
      exito = `${nombre.trim()} actualizado`;
    }
    const ok = await ejecutar(() => api(`/usuarios/${u.id}`, { metodo: 'PATCH', cuerpo }), exito);
    if (ok) alCerrar();
  };

  if (modo === 'clave') {
    const coinciden = clave === confirmacion;
    return (
      <Tarjeta titulo={`Cambiar contraseña: ${u.nombre}`} alCerrar={alCerrar}>
        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <Campo id="ec-clave" etiqueta="Nueva contraseña"
            ayuda={!clave || claveValida(clave) ? AYUDA_CLAVE : undefined}
            error={clave && !claveValida(clave) ? AYUDA_CLAVE : undefined}>
            <Entrada type="password" value={clave} onChange={(e) => setClave(e.target.value)} required
              autoComplete="new-password" />
          </Campo>
          <Campo id="ec-confirmar" etiqueta="Repetir contraseña"
            error={confirmacion && !coinciden ? 'No coinciden.' : undefined}>
            <Entrada type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)}
              required autoComplete="new-password" />
          </Campo>
          <div className="sm:pt-6">
            <Boton type="submit" variante="primario" disabled={ocupado || !claveValida(clave) || !coinciden}>
              Guardar
            </Boton>
          </div>
        </form>
      </Tarjeta>
    );
  }

  const sinCambios = nombre.trim() === u.nombre && rol === u.rol;
  return (
    <Tarjeta titulo={`Editar: ${u.nombre}`} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-start">
        <Campo id="eu-nombre" etiqueta="Nombre completo">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} />
        </Campo>
        <Campo id="eu-rol" etiqueta="Rol" ayuda={esYo ? 'No puedes quitarte el rol de administrador.' : undefined}>
          <SelectorRol valor={rol} onChange={setRol} disabled={esYo} />
        </Campo>
        <div className="sm:pt-6">
          <Boton type="submit" variante="primario" disabled={ocupado || sinCambios || nombre.trim().length < 3}>
            Guardar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
