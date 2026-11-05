import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { reporte } from '../controllers/admin.controller.js';

const router = Router();

// Solo administradores (supuesto del documento, CU-09)
router.use(exigirEmpleado('administrador'));
router.get('/:tipo', reporte);

export default router;