import { verFila, registrarFisico, llamarSiguiente, accionFila } from '../services/fila.service.js';
import { ErrorNegocio } from '../services/formulas.service.js';
import { publicarCambios } from '../services/tiempoReal.service.js';

// GET /api/fila
export async function ver(req, res, next) {
  try {
    res.json({ ok: true, ...(await verFila()) });
  } catch (error) {
    next(error);
  }
}

// POST /api/fila/fisico
export async function fisico(req, res, next) {
  try {
    const turno = await registrarFisico(req.body ?? {}, req.empleado);
    publicarCambios([turno.id]);
    res.status(201).json({ ok: true, turno });
  } catch (error) {
    next(error);
  }
}

// POST /api/fila/llamar-siguiente
export async function llamar(req, res, next) {
  try {
    const turno = await llamarSiguiente(req.empleado, Number(req.body?.caja));
    publicarCambios([turno.id]);
    res.json({ ok: true, turno });
  } catch (error) {
    next(error);
  }
}

// POST /api/fila/:id/:accion   (pausar, reubicar, saltar, atender)
export async function accion(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('Turno no válido', 400);
    const resultado = await accionFila(id, req.params.accion, req.empleado);
    publicarCambios([id]);
    res.json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}