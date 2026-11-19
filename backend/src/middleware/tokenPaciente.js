import jwt from 'jsonwebtoken';

export function exigirTokenPaciente(req, res, next) {
  // El token llega en la cabecera:  Authorization: Bearer <token>
  const [tipo, token] = (req.get('authorization') ?? '').split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, mensaje: 'Falta el token del turno' });
  }

  try {
    // verify comprueba la firma y que no esté vencido
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    if (datos.tipo !== 'paciente_turno') throw new Error('tipo inválido');
    req.turnoId = datos.turno_id;
    req.turnoVence = datos.exp;   // segundos desde 1970: hasta cuándo sirve esta sesión del turno
    next();
  } catch {
    res.status(401).json({ ok: false, mensaje: 'Sesión de turno no válida o vencida' });
  }
}