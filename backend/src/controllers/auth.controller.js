import { iniciarSesion } from '../services/auth.service.js';

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const { usuario, clave } = req.body ?? {};
    res.json({ ok: true, ...(await iniciarSesion(usuario, clave)) });
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/yo  → quién soy (lo usará el panel al cargar)
export function yo(req, res) {
  const { id, nombre, usuario, rol } = req.empleado;
  res.json({ ok: true, usuario: { id, nombre, usuario, rol } });
}