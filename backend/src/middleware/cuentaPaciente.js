import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

// Exige la sesión de un paciente con cuenta (token tipo "paciente_cuenta")
export function exigirCuenta(req, res, next) {
  const [tipo, token] = (req.get('authorization') ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, mensaje: 'Debes iniciar sesión' });
  }
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    if (datos.tipo !== 'paciente_cuenta') throw new Error('tipo inválido');
    req.cuentaId = datos.id;
    next();
  } catch {
    res.status(401).json({ ok: false, mensaje: 'Tu sesión venció. Vuelve a iniciar sesión.' });
  }
}

// Fórmulas, domicilios e historial solo con el correo confirmado (va después de exigirCuenta)
export async function exigirCorreoVerificado(req, res, next) {
  try {
    const { rows: [c] } = await pool.query(
      'SELECT correo_verificado_en IS NOT NULL AS verificado FROM cuentas_pacientes WHERE id = $1 AND activa',
      [req.cuentaId]
    );
    if (!c) return res.status(401).json({ ok: false, mensaje: 'Tu sesión venció. Vuelve a iniciar sesión.' });
    if (!c.verificado) {
      return res.status(403).json({ ok: false, codigo: 'correo_sin_confirmar', mensaje: 'Primero confirma tu correo' });
    }
    next();
  } catch (error) {
    next(error);
  }
}
