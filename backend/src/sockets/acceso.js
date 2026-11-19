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
    const atiendeDomicilios = ['administrador', 'domicilios', 'domiciliario'].includes(u.rol);
    if (!atiendeFila && !atiendeDomicilios) throw new Error('Rol inválido');
    // "domicilios": solo el aviso de que cambió un pedido (sin datos), para quien los atiende o los lleva
    return {
      empleadoId: u.id, equipo: datos.eq, exp: datos.exp,
      salas: tipo === 'pantalla' ? ['pantalla']
        : [...(atiendeFila ? ['farmacia', 'fila_publica'] : []), ...(atiendeDomicilios ? ['domicilios'] : [])],
    };
  }
  // Paciente con cuenta: el seguimiento de sus domicilios (con el correo confirmado, como en la API)
  if (datos.tipo === 'paciente_cuenta') {
    const { rows: [c] } = await pool.query(
      'SELECT id FROM cuentas_pacientes WHERE id = $1 AND activa AND correo_verificado_en IS NOT NULL', [datos.id]);
    if (!c) throw new Error('Cuenta no disponible');
    return { exp: datos.exp, salas: [`cuenta:${c.id}`] };
  }
  if (datos.tipo === 'paciente_turno' && datos.turno_id) {
    return { exp: datos.exp, salas: [`turno:${datos.turno_id}`, 'fila_publica'] };
  }
  throw new Error('Tipo inválido');
}
