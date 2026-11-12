import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirTokenPaciente } from '../middleware/tokenPaciente.js';
import { tomar, miTurno, accion, notificaciones, leidas } from '../controllers/turnos.controller.js';
import { clavePublica, guardarSuscripcion, quitarSuscripcion } from '../services/push.service.js';

const router = Router();

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos. Espera unos minutos.' },
});

router.post('/', limitador, tomar);
router.get('/mio', exigirTokenPaciente, miTurno);
router.get('/mio/notificaciones', exigirTokenPaciente, notificaciones);
router.post('/mio/notificaciones/leidas', exigirTokenPaciente, leidas);
// Avisos al celular: clave pública del servidor y el celular del paciente (antes de "/mio/:accion")
router.get('/push/clave', (req, res) => res.json({ ok: true, clave: clavePublica() }));
router.post('/mio/push', exigirTokenPaciente, async (req, res, next) => {
  try {
    await guardarSuscripcion(req.turnoId, req.body?.suscripcion);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
router.delete('/mio/push', exigirTokenPaciente, async (req, res, next) => {
  try {
    await quitarSuscripcion(req.turnoId, req.body?.endpoint);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
router.post('/mio/:accion', exigirTokenPaciente, accion);

export default router;