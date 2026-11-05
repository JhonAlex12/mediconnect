import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { ver, fisico, llamar, accion } from '../controllers/fila.controller.js';

const router = Router();

// Todas las rutas de la fila exigen sesión de empleado (auxiliar o administrador)
router.use(exigirEmpleado());

router.get('/', ver);
router.post('/fisico', fisico);
router.post('/llamar-siguiente', llamar);
router.post('/:id/:accion', accion);

export default router;