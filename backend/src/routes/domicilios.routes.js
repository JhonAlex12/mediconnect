import { Router } from 'express';
import { publicarInventario, publicarCambios, publicarDomicilio, publicarEsperaDomiciliario } from '../services/tiempoReal.service.js';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import {
  domiciliosFarmacia, cambiarEstadoDomicilio, verificarPagoDomicilio, listarDomiciliarios, rutaDomiciliario,
  reasignarDomiciliario,
} from '../services/cuentas.service.js';

const router = Router();

// Avisa en vivo y, si se movió inventario (despachar, entregar o cancelar algo despachado), al panel y a los turnos
async function publicar(resultado, estado) {
  publicarDomicilio(resultado.cuentaId);   // el paciente ve el seguimiento al instante
  if (['en_camino', 'entregado', 'cancelado'].includes(estado)) {
    publicarInventario();
    publicarEsperaDomiciliario();   // cambió quién está en ruta
    await publicarCambios(resultado.turnosAvisados);
  }
}

// ---------- Domiciliario: solo sus entregas ----------

router.get('/ruta', exigirEmpleado('domiciliario'), async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await rutaDomiciliario(req.empleado.id)) });
  } catch (error) {
    next(error);
  }
});

// Marca entregado un pedido que lleva él: unidades recibidas y, si es contraentrega, el cobro
router.post('/:id/entregado', exigirEmpleado('domiciliario'), async (req, res, next) => {
  try {
    const resultado = await cambiarEstadoDomicilio(req.empleado.id, Number(req.params.id) || 0,
      { estado: 'entregado', items: req.body?.items, pago: req.body?.pago }, { soloDomiciliario: true });
    await publicar(resultado, 'entregado');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------- Encargado de pedidos (rol "domicilios") y administrador ----------
router.use(exigirEmpleado('administrador', 'domicilios'));

router.get('/', async (req, res, next) => {
  try {
    res.json({ ok: true, domicilios: await domiciliosFarmacia({ estado: req.query.estado }) });
  } catch (error) {
    next(error);
  }
});

// Domiciliarios activos, para elegir quién lleva el pedido
router.get('/domiciliarios', async (req, res, next) => {
  try {
    res.json({ ok: true, domiciliarios: await listarDomiciliarios() });
  } catch (error) {
    next(error);
  }
});

// Pasa un pedido en camino a otro domiciliario  { "domiciliario_id": 7 }
router.post('/:id/domiciliario', async (req, res, next) => {
  try {
    const { cuentaId } = await reasignarDomiciliario(req.empleado.id, Number(req.params.id) || 0, req.body?.domiciliario_id);
    publicarDomicilio(cuentaId);   // los dos domiciliarios y el paciente lo ven al instante
    publicarEsperaDomiciliario();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// La transferencia del paciente llegó (se revisó en el banco): ya se puede despachar
router.post('/:id/pago-verificado', async (req, res, next) => {
  try {
    const { cuentaId } = await verificarPagoDomicilio(req.empleado.id, Number(req.params.id) || 0);
    publicarDomicilio(cuentaId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const resultado = await cambiarEstadoDomicilio(req.empleado.id, Number(req.params.id) || 0, req.body ?? {});
    await publicar(resultado, req.body?.estado);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
