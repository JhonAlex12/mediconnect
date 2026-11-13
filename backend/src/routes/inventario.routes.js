import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { ver, crear, movimiento, demo, minimo } from '../controllers/inventario.controller.js';

const router = Router();
// El rol de domicilios no atiende la fila ni el inventario
router.use(exigirEmpleado('administrador', 'auxiliar'));

router.get('/', ver);
router.post('/', crear);
router.post('/:id/movimiento', movimiento);
// El punto de reposición lo define el administrador
router.patch('/:id/minimo', exigirEmpleado('administrador'), minimo);
router.post('/:id/demo/:accion', demo);

export default router;