import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { listar, crear, editar } from '../controllers/admin.controller.js';

const router = Router();

// Solo administradores (supuesto del documento, CU-10)
router.use(exigirEmpleado('administrador'));
router.get('/', listar);
router.post('/', crear);
router.patch('/:id', editar);

export default router;