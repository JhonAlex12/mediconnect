import jwt from 'jsonwebtoken';

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
