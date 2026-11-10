import { Router } from 'express';
import { publicarInventario, publicarCambios } from '../services/tiempoReal.service.js';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { domiciliosFarmacia, cambiarEstadoDomicilio } from '../services/cuentas.service.js';

// Domicilios en el panel: solo el encargado de pedidos (rol "domicilios") y el administrador
const router = Router();
router.use(exigirEmpleado('administrador', 'domicilios'));

router.get('/', async (req, res, next) => {
  try {
    res.json({ ok: true, domicilios: await domiciliosFarmacia({ estado: req.query.estado }) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const resultado = await cambiarEstadoDomicilio(req.empleado.id, Number(req.params.id) || 0, req.body ?? {});
    // Despachar, entregar o cancelar un pedido despachado mueve el inventario
    if (['en_camino', 'entregado', 'cancelado'].includes(req.body?.estado)) {
      publicarInventario();
      await publicarCambios(resultado.turnosAvisados);
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
