import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export function exigirEmpleado(...rolesPermitidos) {
  return async (req, res, next) => {
    const [tipo, token] = (req.get('authorization') ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      return res.status(401).json({ ok: false, mensaje: 'Debes iniciar sesión' });
    }

    // 1. ¿El token es auténtico, vigente y de un empleado?
    let datos;
    try {
      datos = jwt.verify(token, process.env.JWT_SECRET);
      if (datos.tipo !== 'empleado') throw new Error('tipo inválido');
    } catch {
      return res.status(401).json({ ok: false, mensaje: 'Sesión no válida o vencida' });
    }

    // 2. ¿El usuario sigue activo y qué rol tiene hoy? (se lee de la base de datos)
    try {
      const { rows: [u] } = await pool.query(
        `SELECT id, nombre, usuario, rol, activo FROM usuarios_farmacia WHERE id = $1`,
        [datos.id]
      );
      if (!u || !u.activo) {
        return res.status(401).json({ ok: false, mensaje: 'Usuario desactivado' });
      }
      if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(u.rol)) {
        return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para esta acción' });
      }
      req.empleado = u;   // disponible para los controladores
      next();
    } catch (error) {
      next(error);
    }
  };
}