import { tomarTurno, obtenerMiTurno, accionPaciente } from '../services/turnos.service.js';

// POST /api/turnos
export async function tomar(req, res, next) {
  try {
    const { codigo, documento, confirmar, prioridad } = req.body ?? {};
    const resultado = await tomarTurno({
      codigo,
      documento,
      confirmar: confirmar === true,
      prioridad,
    });
    // 201 si se creó el turno; 200 si solo se piden confirmaciones
    res.status(resultado.requiere_confirmacion ? 200 : 201).json({ ok: true, ...resultado });
  } catch (error) {
    next(error);
  }
}

// GET /api/turnos/mio
export async function miTurno(req, res, next) {
  try {
    res.json({ ok: true, turno: await obtenerMiTurno(req.turnoId) });
  } catch (error) {
    next(error);
  }
}

// POST /api/turnos/mio/:accion   (en-camino, llegue, retrasado, cancelar)
export async function accion(req, res, next) {
  try {
    res.json({ ok: true, turno: await accionPaciente(req.turnoId, req.params.accion) });
  } catch (error) {
    next(error);
  }
}