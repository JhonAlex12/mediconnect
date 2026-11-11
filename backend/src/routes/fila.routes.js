import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { ver, fisico, llamar, accion } from '../controllers/fila.controller.js';

const router = Router();

// Todas las rutas de la fila exigen sesión de empleado (auxiliar o administrador)
// El rol de domicilios no atiende la fila ni el inventario
router.use(exigirEmpleado('administrador', 'auxiliar'));

router.get('/', ver);
// Los pacientes sacan su turno en la pantalla de la entrada; este registro manual queda
// solo para el administrador, como respaldo si esa pantalla falla
router.post('/fisico', exigirEmpleado('administrador'), fisico);
router.post('/llamar-siguiente', llamar);
router.post('/:id/:accion', accion);

export default router;