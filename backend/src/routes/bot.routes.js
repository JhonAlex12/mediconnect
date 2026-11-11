import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import * as bot from '../services/bot.service.js';

const router = Router();

// Envuelve un servicio y responde { ok: true, ...resultado }
const responder = (fn) => async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await fn(req)) });
  } catch (error) {
    next(error);
  }
};
const id = (req) => Number(req.params.id) || 0;

// ---------- Público (el chat del sitio) ----------

// 40 mensajes cada 5 minutos por conexión: suficiente para conversar, no para abusar
const limitador = rateLimit({
  windowMs: 5 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, mensaje: 'Me has escrito muchos mensajes seguidos. Espera unos minutos, por favor.' },
});

router.get('/temas', responder(async () => ({ temas: await bot.temasSugeridos() })));
router.post('/preguntar', limitador, responder((req) => bot.preguntar(req.body ?? {})));

// ---------- Administración (solo administradores) ----------

const admin = Router();
admin.use(exigirEmpleado('administrador'));
const e = (req) => req.empleado.id;

admin.get('/preguntas', responder(async () => ({ preguntas: await bot.listarPreguntas() })));
admin.post('/preguntas', responder(async (req) => ({ pregunta: await bot.crearPregunta(e(req), req.body) })));
admin.put('/preguntas/orden', responder(async (req) => ({ preguntas: await bot.ordenarPreguntas(e(req), req.body?.ids) })));
admin.put('/preguntas/:id', responder(async (req) => ({ pregunta: await bot.editarPregunta(e(req), id(req), req.body) })));
admin.delete('/preguntas/:id', responder(async (req) => (await bot.eliminarPregunta(e(req), id(req)), {})));

admin.get('/sin-respuesta', responder(async () => ({ preguntas: await bot.listarSinRespuesta() })));
admin.post('/sin-respuesta/descartar', responder(async (req) => (await bot.descartarSinRespuesta(e(req), req.body?.texto), {})));

router.use('/admin', admin);

export default router;
