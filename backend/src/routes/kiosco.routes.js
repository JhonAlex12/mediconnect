import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { publicarCambios } from '../services/tiempoReal.service.js';
import * as kiosco from '../services/kiosco.service.js';

const router = Router();

const responder = (fn, estado = 200) => async (req, res, next) => {
  try {
    res.status(estado).json({ ok: true, ...(await fn(req)) });
  } catch (error) {
    next(error);
  }
};

// ---------- Administración: activar o desactivar pantallas ----------

router.post('/activar', exigirEmpleado('administrador'),
  responder(async (req) => ({ token: await kiosco.activarPantalla(req.empleado) })));
router.post('/desactivar', exigirEmpleado('administrador'),
  responder(async (req) => (await kiosco.desactivarPantallas(req.empleado), {})));
router.get('/ajustes', exigirEmpleado('administrador'), responder(async () => ({ ajustes: await kiosco.leerAjustes() })));
router.put('/ajustes', exigirEmpleado('administrador'),
  responder(async (req) => ({ ajustes: await kiosco.guardarAjustes(req.empleado, req.body ?? {}) })));

// ---------- La pantalla de la entrada (con su sesión propia) ----------

async function exigirPantalla(req, res, next) {
  const [tipo, token] = (req.get('authorization') ?? '').split(' ');
  if (tipo !== 'Bearer' || !token || !(await kiosco.sesionValida(token))) {
    return res.status(401).json({ ok: false, mensaje: 'Esta pantalla no está activada' });
  }
  next();
}

// Varias pantallas pueden compartir la misma conexión: límite amplio, solo contra abusos
const limitador = rateLimit({
  windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Espera un momento.' },
});

const pantalla = Router();
pantalla.use(exigirPantalla, limitador);

// La pantalla consulta aquí si sigue activada y cómo imprimir el tiquete
pantalla.get('/estado', responder(async () => ({ ajustes: await kiosco.leerAjustes() })));
pantalla.post('/buscar', responder((req) => kiosco.buscar(req.body?.documento, req.body?.codigo)));
pantalla.post('/llegada', responder(async (req) => {
  const turno = await kiosco.registrarLlegada(req.body?.documento);
  if (!turno.yaEstaba) publicarCambios([turno.id]);
  return { turno };
}));
pantalla.post('/turno', responder(async (req) => {
  const turno = await kiosco.pedirTurno(req.body ?? {});
  publicarCambios([turno.id]);
  return { turno };
}, 201));
pantalla.post('/otro', responder(async (req) => {
  const turno = await kiosco.otroTramite(req.body ?? {});
  publicarCambios([turno.id]);
  return { turno };
}, 201));

router.use(pantalla);

export default router;
