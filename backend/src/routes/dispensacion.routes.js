import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { ver, entregar } from '../controllers/dispensacion.controller.js';

const router = Router();
// El rol de domicilios no atiende la fila ni el inventario
router.use(exigirEmpleado('administrador', 'auxiliar'));

router.get('/:turnoId', ver);
router.post('/:turnoId', entregar);

export default router;