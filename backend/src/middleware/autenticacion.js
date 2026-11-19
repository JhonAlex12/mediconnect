import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { MENSAJES_SESION_CERRADA, motivoSesionCerrada } from '../services/sesionEmpleado.js';

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
        `SELECT id, nombre, usuario, rol, caja, activo, equipo_sesion, version_sesion,
                ultima_actividad IS NULL OR ultima_actividad < now() - interval '1 minute' AS marcar_actividad
           FROM usuarios_farmacia WHERE id = $1`,
        [datos.id]
      );
      if (!u || !u.activo) {
        return res.status(401).json({ ok: false, mensaje: 'Usuario desactivado' });
      }
      // 3. ¿Es la sesión vigente de la cuenta? (una sola por cuenta; se cierran al cambiar la contraseña)
      const motivo = motivoSesionCerrada(datos, u);
      if (motivo) {
        return res.status(401).json({ ok: false, mensaje: MENSAJES_SESION_CERRADA[motivo], sesion_cerrada: motivo });
      }
      if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(u.rol)) {
        return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para esta acción' });
      }
      // La sesión sigue en uso: mientras haya actividad nadie más entra con la cuenta (a lo sumo una escritura por minuto)
      if (u.marcar_actividad) {
        await pool.query(`UPDATE usuarios_farmacia SET ultima_actividad = now() WHERE id = $1`, [u.id]);
      }
      const { equipo_sesion, version_sesion, marcar_actividad, ...empleado } = u;
      req.empleado = empleado;   // disponible para los controladores
      req.equipoSesion = datos.eq;
      next();
    } catch (error) {
      next(error);
    }
  };
}