import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { ver, fisico, llamar, accion } from '../controllers/fila.controller.js';

const router = Router();

// Todas las rutas de la fila exigen sesión de empleado (auxiliar o administrador)
// El rol de domicilios no atiende la fila ni el inventario
router.use(exigirEmpleado('administrador', 'auxiliar'));

router.get('/', ver);
router.post('/fisico', fisico);
router.post('/llamar-siguiente', llamar);
router.post('/:id/:accion', accion);

export default router;