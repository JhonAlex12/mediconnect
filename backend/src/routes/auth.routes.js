import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { login, yo } from '../controllers/auth.controller.js';

const router = Router();

// 10 intentos FALLIDOS cada 15 minutos; los exitosos no cuentan
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos fallidos. Espera 15 minutos.' },
});

router.post('/login', limitadorLogin, login);
router.get('/yo', exigirEmpleado(), yo);

export default router;