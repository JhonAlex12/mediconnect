import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { consultar } from '../controllers/formulas.controller.js';

const router = Router();

// Máximo 20 consultas cada 15 minutos por dirección: frena los intentos
// de adivinar combinaciones de código y documento
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiados intentos. Espera unos minutos.' },
});

// POST /api/formulas/consulta
router.post('/consulta', limitador, consultar);

export default router;