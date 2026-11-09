import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';

// Hash de relleno: se compara cuando el usuario no existe, para que la
// respuesta tarde lo mismo y no se pueda saber qué usuarios existen
const HASH_RELLENO = await bcrypt.hash('relleno-sin-uso', 10);

export async function iniciarSesion(usuario, clave) {
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

  await registrarAcceso({ usuarioId: u.id, accion: 'iniciar_sesion' });

  // Token de sesión de 8 horas (una jornada)
  const token = jwt.sign(
    { tipo: 'empleado', id: u.id },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    token,
    usuario: { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, caja: u.caja },
  };
}