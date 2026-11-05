import {
  tomarTurno, obtenerMiTurno, accionPaciente, listarNotificaciones, marcarLeidas,
} from '../services/turnos.service.js';
import { publicarCambios } from '../services/tiempoReal.service.js';

// POST /api/turnos
export async function tomar(req, res, next) {
  try {
    const { codigo, documento, confirmar, prioridad } = req.body ?? {};
    const resultado = await tomarTurno({ codigo, documento, confirmar: confirmar === true, prioridad });
    if (!resultado.requiere_confirmacion) publicarCambios([resultado.turno.id]);
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
    const turno = await accionPaciente(req.turnoId, req.params.accion);
    publicarCambios([req.turnoId]);
    res.json({ ok: true, turno });
  } catch (error) {
    next(error);
  }
}

// GET /api/turnos/mio/notificaciones
export async function notificaciones(req, res, next) {
  try {
    res.json({ ok: true, notificaciones: await listarNotificaciones(req.turnoId) });
  } catch (error) {
    next(error);
  }
}

// POST /api/turnos/mio/notificaciones/leidas
export async function leidas(req, res, next) {
  try {
    await marcarLeidas(req.turnoId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}