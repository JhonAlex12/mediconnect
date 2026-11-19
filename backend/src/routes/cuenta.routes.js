import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirCuenta, exigirCorreoVerificado } from '../middleware/cuentaPaciente.js';
import { publicarDomicilio } from '../services/tiempoReal.service.js';
import {
  registrarCuenta, iniciarSesionCuenta, verCuenta, actualizarCuenta,
  agregarFormula, listarFormulas, confirmarCorreo, reenviarConfirmacion, solicitarRestablecer, restablecerClave, listarDomicilios, solicitarDomicilio, cancelarDomicilio, pagarDomicilioEnLinea, historial,
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

// Recuperar la contraseña: 5 solicitudes cada 15 minutos por conexión
const MENSAJE_RESTABLECER = 'Si los datos corresponden a una cuenta, te enviamos un enlace al correo registrado. Revisa también la carpeta de spam.';
router.post('/olvide-clave', limitar(5, 'Ya pediste varios enlaces. Espera unos minutos.'),
  responder(async (req) => {
    await solicitarRestablecer(req.body?.documento);
    return { mensaje: MENSAJE_RESTABLECER };
  }));
router.post('/restablecer-clave', limitadorFormulas,
  responder(async (req) => (await restablecerClave(req.body?.token, req.body?.clave), {})));

router.use(exigirCuenta);
// Reenviar el correo: máximo 5 cada 15 minutos
router.post('/reenviar-confirmacion', limitar(5, 'Ya te enviamos varios correos. Espera unos minutos.'),
  responder(async (req) => {
    await reenviarConfirmacion(req.cuentaId);
    return {};
  }));
router.get('/yo', responder(async (req) => ({ cuenta: await verCuenta(req.cuentaId) })));
router.put('/yo', responder(async (req) => ({ cuenta: await actualizarCuenta(req.cuentaId, req.body ?? {}) })));

// Lo demás exige el correo confirmado (antes solo se puede reenviar el enlace o corregir los datos)
router.use(exigirCorreoVerificado);
router.get('/formulas', responder(async (req) => ({ formulas: await listarFormulas(req.cuentaId) })));
router.post('/formulas', limitadorFormulas,
  responder(async (req) => ({ formula: await agregarFormula(req.cuentaId, req.body?.codigo) })));
router.get('/domicilios', responder(async (req) => ({ domicilios: await listarDomicilios(req.cuentaId) })));
router.post('/domicilios', responder(async (req) => {
  const domicilio = await solicitarDomicilio(req.cuentaId, req.body ?? {});
  publicarDomicilio(req.cuentaId);   // el pedido nuevo aparece en el panel de pedidos al instante
  return { domicilio };
}));
router.post('/domicilios/:id/pagar', responder(async (req) => {
  await pagarDomicilioEnLinea(req.cuentaId, Number(req.params.id) || 0, req.body ?? {});
  publicarDomicilio(req.cuentaId);   // la farmacia y el domiciliario lo ven al instante
  return {};
}));
router.post('/domicilios/:id/cancelar', responder(async (req) => {
  await cancelarDomicilio(req.cuentaId, Number(req.params.id) || 0);
  publicarDomicilio(req.cuentaId);
  return {};
}));
router.get('/historial', responder(async (req) => ({ historial: await historial(req.cuentaId) })));

export default router;
