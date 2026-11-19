import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { motivoSesionCerrada } from '../services/sesionEmpleado.js';

export async function autorizarConexion({ tipo, token } = {}) {
  const datos = jwt.verify(token, process.env.JWT_SECRET);
  if (!Number.isFinite(datos.exp)) throw new Error('Sesión sin vencimiento');
  if (datos.tipo === 'empleado') {
    const { rows: [u] } = await pool.query(
      'SELECT id, rol, activo, equipo_sesion, version_sesion FROM usuarios_farmacia WHERE id = $1', [datos.id]);
    if (!u?.activo) throw new Error('Usuario desactivado');
    const motivo = motivoSesionCerrada(datos, u);
    if (motivo) throw new Error(`Sesión cerrada: ${motivo}`);
    const atiendeFila = ['administrador', 'auxiliar'].includes(u.rol);
    if (tipo === 'pantalla' && !atiendeFila) throw new Error('Sin permiso para la pantalla');
    if (!atiendeFila && u.rol !== 'domicilios') throw new Error('Rol inválido');
    return {
      empleadoId: u.id, equipo: datos.eq, exp: datos.exp,
      salas: tipo === 'pantalla' ? ['pantalla'] : atiendeFila ? ['farmacia', 'fila_publica'] : [],
    };
  }
  if (datos.tipo === 'paciente_turno' && datos.turno_id) {
    return { exp: datos.exp, salas: [`turno:${datos.turno_id}`, 'fila_publica'] };
  }
  throw new Error('Tipo inválido');
}
