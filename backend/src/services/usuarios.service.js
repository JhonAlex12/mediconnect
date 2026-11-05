import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';

const ROLES = ['administrador', 'auxiliar'];
const FORMATO_USUARIO = /^[a-z0-9._-]{3,40}$/;

// Contraseña mínima: 10 caracteres, con al menos una letra y un número
function validarClave(clave) {
  if (typeof clave !== 'string' || clave.length < 10 || !/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
    throw new ErrorNegocio('clave: mínimo 10 caracteres, con letras y números', 400);
  }
}

// Nunca se devuelve clave_hash
const CAMPOS = 'id, nombre, usuario, rol, activo, creado_en';

export async function listarUsuarios() {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM usuarios_farmacia ORDER BY nombre`);
  return rows;
}

// ============================================================
// CREAR (CU-10 pasos 2 a 4)
// ============================================================
export async function crearUsuario({ nombre, usuario, clave, rol } = {}, admin) {
  if (typeof nombre !== 'string' || nombre.trim().length < 3) {
    throw new ErrorNegocio('nombre: obligatorio', 400);
  }
  const usuarioLimpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  if (!FORMATO_USUARIO.test(usuarioLimpio)) {
    throw new ErrorNegocio('usuario: 3 a 40 caracteres (letras minúsculas, números, punto, guion)', 400);
  }
  if (!ROLES.includes(rol)) throw new ErrorNegocio(`rol: ${ROLES.join(' o ')}`, 400);
  validarClave(clave);

  try {
    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING ${CAMPOS}`,
      [nombre.trim(), usuarioLimpio, await bcrypt.hash(clave, 10), rol]
    );
    await registrarAcceso({ usuarioId: admin.id, accion: 'crear_usuario', detalle: `${u.usuario} (${u.rol})` });
    return u;
  } catch (error) {
    // 4a: usuario duplicado
    if (error.code === '23505') throw new ErrorNegocio('Ese nombre de usuario ya existe', 409);
    throw error;
  }
}

// ============================================================
// EDITAR, CAMBIAR ROL, DESACTIVAR O CAMBIAR CLAVE
// ============================================================
export async function editarUsuario(id, cambios = {}, admin) {
  const { nombre, rol, activo, clave } = cambios;

  if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim().length < 3)) {
    throw new ErrorNegocio('nombre: mínimo 3 caracteres', 400);
  }
  if (rol !== undefined && !ROLES.includes(rol)) throw new ErrorNegocio(`rol: ${ROLES.join(' o ')}`, 400);
  if (activo !== undefined && typeof activo !== 'boolean') throw new ErrorNegocio('activo: true o false', 400);
  if (clave !== undefined) validarClave(clave);
  if ([nombre, rol, activo, clave].every((v) => v === undefined)) {
    throw new ErrorNegocio('No hay cambios', 400);
  }

  // Protección contra quedarse sin acceso
  if (id === admin.id && (activo === false || (rol !== undefined && rol !== 'administrador'))) {
    throw new ErrorNegocio('No puedes desactivarte ni quitarte el rol de administrador', 400);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { rows: [actual] } = await cliente.query(
      `SELECT id, rol, activo FROM usuarios_farmacia WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!actual) throw new ErrorNegocio('Usuario no encontrado', 404);

    // Siempre debe quedar al menos un administrador activo
    const dejaDeSerAdminActivo = actual.rol === 'administrador' && actual.activo
      && (activo === false || (rol !== undefined && rol !== 'administrador'));
    if (dejaDeSerAdminActivo) {
      const { rows: [otros] } = await cliente.query(
        `SELECT COUNT(*)::int AS total FROM usuarios_farmacia
          WHERE rol = 'administrador' AND activo = TRUE AND id <> $1`,
        [id]
      );
      if (otros.total === 0) throw new ErrorNegocio('Debe quedar al menos un administrador activo', 400);
    }

    // COALESCE: si el campo no viene, se deja como estaba
    const { rows: [u] } = await cliente.query(
      `UPDATE usuarios_farmacia
          SET nombre     = COALESCE($2, nombre),
              rol        = COALESCE($3, rol),
              activo     = COALESCE($4, activo),
              clave_hash = COALESCE($5, clave_hash)
        WHERE id = $1
        RETURNING ${CAMPOS}`,
      [id, nombre?.trim() ?? null, rol ?? null, activo ?? null,
       clave !== undefined ? await bcrypt.hash(clave, 10) : null]
    );

    const detalle = Object.keys(cambios)
      .filter((k) => ['nombre', 'rol', 'activo', 'clave'].includes(k))
      .map((k) => (k === 'clave' ? 'clave' : `${k}=${cambios[k]}`))
      .join(', ');
    await registrarAcceso({ usuarioId: admin.id, accion: 'editar_usuario', detalle: `${u.usuario}: ${detalle}` }, cliente);

    await cliente.query('COMMIT');
    return u;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}