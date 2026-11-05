import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { ver, entregar } from '../controllers/dispensacion.controller.js';

const router = Router();
router.use(exigirEmpleado());

router.get('/:turnoId', ver);
router.post('/:turnoId', entregar);

export default router;