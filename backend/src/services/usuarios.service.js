import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { desconectarEmpleado } from '../sockets/emisor.js';

const ROLES = ['administrador', 'auxiliar', 'domicilios'];
const CAJAS = [1, 2, 3, 4, 5, 6];

// Solo los auxiliares tienen caja; null = elige la caja en su equipo
function validarCaja(caja, rol) {
  if (caja === null || caja === undefined) return null;
  if (!CAJAS.includes(caja)) throw new ErrorNegocio('caja: de 1 a 6 (la 6 es la preferencial)', 400);
  if (rol !== 'auxiliar') throw new ErrorNegocio('Solo los auxiliares tienen una caja asignada', 400);
  return caja;
}

const cajaOcupada = (error) => {
  if (error.code === '23505' && error.constraint === 'una_persona_por_caja') {
    throw new ErrorNegocio('Esa caja ya está asignada a otro trabajador activo', 409);
  }
  throw error;
};
const FORMATO_USUARIO = /^[a-z0-9._-]{3,40}$/;

// Contraseña mínima: 10 caracteres, con al menos una letra y un número
function validarClave(clave) {
  if (typeof clave !== 'string' || clave.length < 10 || !/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
    throw new ErrorNegocio('clave: mínimo 10 caracteres, con letras y números', 400);
  }
}

// Nunca se devuelve clave_hash
const CAMPOS = 'id, nombre, usuario, rol, caja, activo, creado_en';

export async function listarUsuarios() {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM usuarios_farmacia ORDER BY nombre`);
  return rows;
}

// ============================================================
// CREAR (CU-10 pasos 2 a 4)
// ============================================================
export async function crearUsuario({ nombre, usuario, clave, rol, caja } = {}, admin) {
  if (typeof nombre !== 'string' || nombre.trim().length < 3) {
    throw new ErrorNegocio('nombre: obligatorio', 400);
  }
  const usuarioLimpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  if (!FORMATO_USUARIO.test(usuarioLimpio)) {
    throw new ErrorNegocio('usuario: 3 a 40 caracteres (letras minúsculas, números, punto, guion)', 400);
  }
  if (!ROLES.includes(rol)) throw new ErrorNegocio(`rol: ${ROLES.join(' o ')}`, 400);
  validarClave(clave);
  const cajaAsignada = validarCaja(caja, rol);

  try {
    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol, caja)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CAMPOS}`,
      [nombre.trim(), usuarioLimpio, await bcrypt.hash(clave, 10), rol, cajaAsignada]
    );
    await registrarAcceso({
      usuarioId: admin.id, accion: 'crear_usuario',
      detalle: `${u.usuario} (${u.rol}${u.caja ? `, caja ${u.caja}` : ''})`,
    });
    return u;
  } catch (error) {
    if (error.constraint === 'una_persona_por_caja') cajaOcupada(error);
    // 4a: usuario duplicado
    if (error.code === '23505') throw new ErrorNegocio('Ese nombre de usuario ya existe', 409);
    throw error;
  }
}

// ============================================================
// EDITAR, CAMBIAR ROL, DESACTIVAR O CAMBIAR CLAVE
// ============================================================
export async function editarUsuario(id, cambios = {}, admin) {
  const { nombre, rol, activo, clave, caja } = cambios;

  if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim().length < 3)) {
    throw new ErrorNegocio('nombre: mínimo 3 caracteres', 400);
  }
  if (rol !== undefined && !ROLES.includes(rol)) throw new ErrorNegocio(`rol: ${ROLES.join(' o ')}`, 400);
  if (activo !== undefined && typeof activo !== 'boolean') throw new ErrorNegocio('activo: true o false', 400);
  if (clave !== undefined) validarClave(clave);
  if (caja !== undefined && caja !== null && !CAJAS.includes(caja)) {
    throw new ErrorNegocio('caja: de 1 a 6 (la 6 es la preferencial)', 400);
  }
  if ([nombre, rol, activo, clave, caja].every((v) => v === undefined)) {
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

    // Solo los auxiliares tienen caja: al cambiar a otro rol se le quita
    const rolFinal = rol ?? actual.rol;
    let cajaFinal = caja === undefined ? undefined : caja;
    if (rolFinal !== 'auxiliar') {
      if (caja) throw new ErrorNegocio('Solo los auxiliares tienen una caja asignada', 400);
      cajaFinal = null;
    }

    // COALESCE: si el campo no viene, se deja como estaba
    const { rows: [u] } = await cliente.query(
      `UPDATE usuarios_farmacia
          SET nombre     = COALESCE($2, nombre),
              rol        = COALESCE($3, rol),
              activo     = COALESCE($4, activo),
              clave_hash = COALESCE($5, clave_hash),
              caja       = CASE WHEN $6 THEN $7::smallint ELSE caja END
        WHERE id = $1
        RETURNING ${CAMPOS}`,
      [id, nombre?.trim() ?? null, rol ?? null, activo ?? null,
       clave !== undefined ? await bcrypt.hash(clave, 10) : null,
       cajaFinal !== undefined, cajaFinal ?? null]
    ).catch(cajaOcupada);

    const detalle = Object.keys(cambios)
      .filter((k) => ['nombre', 'rol', 'activo', 'clave', 'caja'].includes(k))
      .map((k) => (k === 'clave' ? 'clave' : `${k}=${cambios[k]}`))
      .join(', ');
    await registrarAcceso({ usuarioId: admin.id, accion: 'editar_usuario', detalle: `${u.usuario}: ${detalle}` }, cliente);

    await cliente.query('COMMIT');
    if (rol !== undefined || activo !== undefined || clave !== undefined) desconectarEmpleado(id);
    return u;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
