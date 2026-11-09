import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirCuenta } from '../middleware/cuentaPaciente.js';
import {
  registrarCuenta, iniciarSesionCuenta, verCuenta, actualizarCuenta,
  agregarFormula, listarFormulas, confirmarCorreo, reenviarConfirmacion, listarDomicilios, solicitarDomicilio, cancelarDomicilio, historial,
} from '../services/cuentas.service.js';

const router = Router();

const limitar = (limit, mensaje, extra = {}) => rateLimit({
  windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, mensaje }, ...extra,
});
// Ingreso: 10 intentos fallidos cada 15 min; registro: 5 cuentas cada 15 min por dirección
const limitadorLogin = limitar(10, 'Demasiados intentos fallidos. Espera 15 minutos.', { skipSuccessfulRequests: true });
const limitadorRegistro = limitar(5, 'Demasiados registros desde esta conexión. Espera unos minutos.');
// Agregar fórmulas exige adivinar códigos: mismo límite que la consulta pública
const limitadorFormulas = limitar(20, 'Demasiados intentos. Espera unos minutos.');

// Envuelve un servicio y responde { ok: true, ...resultado }
const responder = (fn) => async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await fn(req)) });
  } catch (error) {
    next(error);
  }
};

router.post('/registro', limitadorRegistro, responder((req) => registrarCuenta(req.body ?? {})));
router.post('/login', limitadorLogin, responder((req) => iniciarSesionCuenta(req.body?.documento, req.body?.clave)));

// Enlace del correo de confirmación (no necesita sesión: puede abrirse en otro dispositivo)
router.post('/confirmar-correo', limitadorFormulas, responder((req) => confirmarCorreo(req.body?.token)));

router.use(exigirCuenta);
// Reenviar el correo: máximo 5 cada 15 minutos
router.post('/reenviar-confirmacion', limitar(5, 'Ya te enviamos varios correos. Espera unos minutos.'),
  responder(async (req) => {
    await reenviarConfirmacion(req.cuentaId);
    return {};
  }));
router.get('/yo', responder(async (req) => ({ cuenta: await verCuenta(req.cuentaId) })));
router.put('/yo', responder(async (req) => ({ cuenta: await actualizarCuenta(req.cuentaId, req.body ?? {}) })));
router.get('/formulas', responder(async (req) => ({ formulas: await listarFormulas(req.cuentaId) })));
router.post('/formulas', limitadorFormulas,
  responder(async (req) => ({ formula: await agregarFormula(req.cuentaId, req.body?.codigo) })));
router.get('/domicilios', responder(async (req) => ({ domicilios: await listarDomicilios(req.cuentaId) })));
router.post('/domicilios', responder(async (req) => ({ domicilio: await solicitarDomicilio(req.cuentaId, req.body ?? {}) })));
router.post('/domicilios/:id/cancelar', responder(async (req) => {
  await cancelarDomicilio(req.cuentaId, Number(req.params.id) || 0);
  return {};
}));
router.get('/historial', responder(async (req) => ({ historial: await historial(req.cuentaId) })));

export default router;
