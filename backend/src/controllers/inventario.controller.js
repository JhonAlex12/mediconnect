import { verInventario, crearMedicamento, registrarMovimiento, accionDemo } from '../services/inventario.service.js';
import { ErrorNegocio } from '../services/formulas.service.js';
import { publicarCambios, publicarInventario } from '../services/tiempoReal.service.js';

const idValido = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('Medicamento no válido', 400);
  return id;
};

// GET /api/inventario
export async function ver(req, res, next) {
  try {
    res.json({ ok: true, ...(await verInventario()) });
  } catch (error) {
    next(error);
  }
}

// POST /api/inventario
export async function crear(req, res, next) {
  try {
    const medicamento = await crearMedicamento(req.body, req.empleado);
    publicarInventario();
    res.status(201).json({ ok: true, medicamento });
  } catch (error) {
    next(error);
  }
}

// POST /api/inventario/:id/movimiento
export async function movimiento(req, res, next) {
  try {
    const r = await registrarMovimiento(idValido(req.params.id), req.body ?? {}, req.empleado);
    publicarInventario();
    publicarCambios(r.turnosAvisados);
    res.json({ ok: true, ...r });
  } catch (error) {
    next(error);
  }
}

// POST /api/inventario/:id/demo/:accion   (reducir, vaciar, reponer)
export async function demo(req, res, next) {
  try {
    const r = await accionDemo(idValido(req.params.id), req.params.accion, req.empleado);
    publicarInventario();
    publicarCambios(r.turnosAvisados);
    res.json({ ok: true, ...r });
  } catch (error) {
    next(error);
  }
}