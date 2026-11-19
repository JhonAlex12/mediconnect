import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { FORMATO_EQUIPO, MENSAJE_SESION_ABIERTA, MINUTOS_SESION_INACTIVA } from './sesionEmpleado.js';
import { avisarEmpleado, desconectarEmpleado } from '../sockets/emisor.js';

// Hash de relleno: se compara cuando el usuario no existe, para que la
// respuesta tarde lo mismo y no se pueda saber qué usuarios existen
const HASH_RELLENO = await bcrypt.hash('relleno-sin-uso', 10);

export async function iniciarSesion(usuario, clave, equipo) {
  if (typeof usuario !== 'string' || typeof clave !== 'string' || !usuario.trim() || !clave) {
    throw new ErrorNegocio('Ingresa usuario y contraseña', 400);
  }

  const { rows: [u] } = await pool.query(
    `SELECT id, nombre, usuario, clave_hash, rol, caja, activo
       FROM usuarios_farmacia
      WHERE usuario = $1`,
    [usuario.trim().toLowerCase()]
  );

  // bcrypt.compare cifra la clave recibida y la compara con la guardada
  const coincide = await bcrypt.compare(clave, u?.clave_hash ?? HASH_RELLENO);

  if (!u || !u.activo || !coincide) {
    throw new ErrorNegocio('Usuario o contraseña incorrectos', 401);
  }

  // Una sola sesión por cuenta (ver sesionEmpleado.js): si está abierta y en uso en otro equipo,
  // no se deja entrar. Sin identificador válido, el ingreso cuenta como un equipo nuevo.
  // Se comprueba y se toma en una sola orden, para que dos ingresos a la vez no entren ambos.
  const eq = typeof equipo === 'string' && FORMATO_EQUIPO.test(equipo) ? equipo : randomUUID();
  const { rows: [sesion] } = await pool.query(
    `UPDATE usuarios_farmacia SET equipo_sesion = $2, ultima_actividad = now()
      WHERE id = $1
        AND (equipo_sesion IS NULL OR equipo_sesion = $2 OR ultima_actividad IS NULL
             OR ultima_actividad < now() - make_interval(mins => $3))
      RETURNING version_sesion`,
    [u.id, eq, MINUTOS_SESION_INACTIVA]
  );
  if (!sesion) {
    // La contraseña era correcta: se registra y se le avisa a quien tiene la sesión abierta
    await registrarAcceso({ usuarioId: u.id, accion: 'ingreso_bloqueado', detalle: 'ya tenía una sesión abierta en otro equipo' });
    avisarEmpleado(u.id, 'intento_ingreso', { hora: new Date().toISOString() });
    throw new ErrorNegocio(MENSAJE_SESION_ABIERTA, 409);
  }
  await registrarAcceso({ usuarioId: u.id, accion: 'iniciar_sesion' });
  desconectarEmpleado(u.id, { exceptoEquipo: eq });   // conexiones que quedaron de una sesión abandonada

  // Token de sesión de 8 horas (una jornada)
  const token = jwt.sign(
    { tipo: 'empleado', id: u.id, eq, v: sesion.version_sesion },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    usuario: { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, caja: u.caja },
  };
}

// «Salir»: libera la cuenta al instante para entrar desde otro equipo
export async function cerrarSesionEmpleado(id, equipo) {
  await pool.query(
    `UPDATE usuarios_farmacia SET equipo_sesion = NULL WHERE id = $1 AND equipo_sesion = $2`,
    [id, equipo]
  );
  await registrarAcceso({ usuarioId: id, accion: 'cerrar_sesion' });
  desconectarEmpleado(id);
}
