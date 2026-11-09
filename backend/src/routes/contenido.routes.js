import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import * as c from '../services/contenido.service.js';

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

// ---------- Público ----------

// Lo que necesitan todas las páginas: contacto, carrusel e información al paciente
router.get('/sitio', responder(async () => {
  const [contacto, slides, secciones] = await Promise.all([c.verContacto(), c.listarSlides(), c.listarSecciones()]);
  return { contacto, slides, secciones };
}));
router.get('/articulos', responder(async () => ({ articulos: await c.listarArticulos() })));
router.get('/articulos/:slug', responder(async (req) => ({ articulo: await c.verArticulo(String(req.params.slug)) })));

// Imágenes subidas: /api/contenido/imagenes/12 (grande) o ?movil=1 (celular)
router.get('/imagenes/:id', async (req, res, next) => {
  try {
    const img = await c.leerImagen(id(req), req.query.movil === '1');
    if (!img) return res.status(404).end();
    // Una imagen nunca cambia (se sube otra con otro número): se puede guardar en caché
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(img.tipo).send(img.datos);
  } catch (error) {
    next(error);
  }
});

// ---------- Administración (solo administradores) ----------

const admin = Router();
admin.use(exigirEmpleado('administrador'));
const e = (req) => req.empleado.id;

admin.post('/imagenes', responder(async (req) => ({ imagen: await c.subirImagen(e(req), req.body?.imagen) })));

admin.get('/slides', responder(async () => ({ slides: await c.listarSlides({ todos: true }) })));
admin.post('/slides', responder(async (req) => ({ slide: await c.crearSlide(e(req), req.body) })));
admin.put('/slides/orden', responder(async (req) => ({ slides: await c.ordenarSlides(e(req), req.body?.ids) })));
admin.put('/slides/:id', responder(async (req) => ({ slide: await c.editarSlide(e(req), id(req), req.body) })));
admin.delete('/slides/:id', responder(async (req) => (await c.eliminarSlide(e(req), id(req)), {})));

admin.get('/articulos', responder(async () => ({ articulos: await c.listarArticulos({ todos: true }) })));
admin.get('/articulos/:id', responder(async (req) => ({ articulo: await c.verArticulo(id(req), { todos: true }) })));
admin.post('/articulos', responder(async (req) => ({ articulo: await c.crearArticulo(e(req), req.body) })));
admin.put('/articulos/:id', responder(async (req) => ({ articulo: await c.editarArticulo(e(req), id(req), req.body) })));
admin.delete('/articulos/:id', responder(async (req) => (await c.eliminarArticulo(e(req), id(req)), {})));

admin.get('/secciones', responder(async () => ({ secciones: await c.listarSecciones({ todas: true }) })));
admin.post('/secciones', responder(async (req) => ({ seccion: await c.crearSeccion(e(req), req.body) })));
admin.put('/secciones/orden', responder(async (req) => ({ secciones: await c.ordenarSecciones(e(req), req.body?.ids) })));
admin.put('/secciones/:id', responder(async (req) => (await c.editarSeccion(e(req), id(req), req.body), {})));
admin.delete('/secciones/:id', responder(async (req) => (await c.eliminarSeccion(e(req), id(req)), {})));

admin.put('/contacto', responder(async (req) => ({ contacto: await c.guardarContacto(e(req), req.body) })));

router.use('/admin', admin);

export default router;
