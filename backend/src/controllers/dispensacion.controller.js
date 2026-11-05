import { verParaDispensar, dispensar } from '../services/dispensacion.service.js';
import { ErrorNegocio } from '../services/formulas.service.js';
import { publicarCambios, publicarInventario } from '../services/tiempoReal.service.js';

const idValido = (valor) => {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorNegocio('Turno no válido', 400);
  return id;
};

// GET /api/dispensacion/:turnoId
export async function ver(req, res, next) {
  try {
    res.json({ ok: true, ...(await verParaDispensar(idValido(req.params.turnoId))) });
  } catch (error) {
    next(error);
  }
}

// POST /api/dispensacion/:turnoId
export async function entregar(req, res, next) {
  try {
    const turnoId = idValido(req.params.turnoId);
    const r = await dispensar(turnoId, req.body ?? {}, req.empleado);
    publicarInventario();
    publicarCambios([turnoId, ...r.turnosAvisados]);
    res.json({ ok: true, ...r });
  } catch (error) {
    next(error);
  }
}