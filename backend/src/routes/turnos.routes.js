import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirTokenPaciente } from '../middleware/tokenPaciente.js';
import { tomar, miTurno, accion, notificaciones, leidas } from '../controllers/turnos.controller.js';

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
router.post('/mio/:accion', exigirTokenPaciente, accion);

export default router;