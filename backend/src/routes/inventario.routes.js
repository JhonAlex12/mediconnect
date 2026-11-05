import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { ver, crear, movimiento, demo } from '../controllers/inventario.controller.js';

const router = Router();
router.use(exigirEmpleado());

router.get('/', ver);
router.post('/', crear);
router.post('/:id/movimiento', movimiento);
router.post('/:id/demo/:accion', demo);

export default router;