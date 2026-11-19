import { cerrarSesionEmpleado, iniciarSesion } from '../services/auth.service.js';

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const { usuario, clave, equipo } = req.body ?? {};
    res.json({ ok: true, ...(await iniciarSesion(usuario, clave, equipo)) });
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/yo  → quién soy (lo usará el panel al cargar)
export function yo(req, res) {
  const { id, nombre, usuario, rol, caja } = req.empleado;
  res.json({ ok: true, usuario: { id, nombre, usuario, rol, caja } });
}

// POST /api/auth/salir  → cierra la sesión y libera la cuenta para otro equipo
export async function salir(req, res, next) {
  try {
    await cerrarSesionEmpleado(req.empleado.id, req.equipoSesion);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
