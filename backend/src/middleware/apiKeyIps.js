import { timingSafeEqual } from 'node:crypto';

export function exigirApiKeyIps(req, res, next) {
  const esperada = process.env.IPS_API_KEY;
  const recibida = req.get('x-api-key') ?? '';

  // Si no hay clave configurada en el servidor, nadie entra
  if (!esperada) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
  }

  // Comparación de tiempo constante: evita adivinar la clave midiendo tiempos
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado' });
  }

  next();
}