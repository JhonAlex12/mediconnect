import { generarReporte } from '../services/reportes.service.js';
import { listarUsuarios, crearUsuario, editarUsuario } from '../services/usuarios.service.js';
import { ErrorNegocio } from '../services/formulas.service.js';

// GET /api/reportes/:tipo?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
export async function reporte(req, res, next) {
  try {
    const { desde, hasta } = req.query;
    res.json({ ok: true, ...(await generarReporte(req.params.tipo, { desde, hasta }, req.empleado)) });
  } catch (error) {
    next(error);
  }
}

// GET /api/usuarios
export async function listar(req, res, next) {
  try {
    res.json({ ok: true, usuarios: await listarUsuarios() });
  } catch (error) {
    next(error);
  }
}

// POST /api/usuarios
export async function crear(req, res, next) {
  try {
    res.status(201).json({ ok: true, usuario: await crearUsuario(req.body, req.empleado) });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/usuarios/:id
export async function editar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('Usuario no válido', 400);
    res.json({ ok: true, usuario: await editarUsuario(id, req.body ?? {}, req.empleado) });
  } catch (error) {
    next(error);
  }
}