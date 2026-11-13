import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import {
  listarPacientes, fichaPaciente, reenviarConfirmacionCuenta, enviarCambioClave, cambiarEstadoCuenta,
} from '../services/pacientesFarmacia.service.js';

// Pacientes en el panel de la farmacia.
// La lista completa y las acciones sobre la cuenta: solo el administrador.
// La ficha de un documento exacto: también el auxiliar (para atender en caja).
const router = Router();

const responder = (accion) => async (req, res, next) => {
  try {
    res.json({ ok: true, ...(await accion(req)) });
  } catch (error) {
    next(error);
  }
};

const soloAdmin = exigirEmpleado('administrador');

router.get('/', soloAdmin, responder((req) => listarPacientes(req.query)));
router.get('/:documento', exigirEmpleado('administrador', 'auxiliar'),
  responder(async (req) => ({ paciente: await fichaPaciente(req.params.documento, req.empleado) })));
router.post('/:documento/cuenta/reenviar-confirmacion', soloAdmin,
  responder((req) => reenviarConfirmacionCuenta(req.params.documento, req.empleado)));
router.post('/:documento/cuenta/cambio-clave', soloAdmin,
  responder((req) => enviarCambioClave(req.params.documento, req.empleado)));
router.patch('/:documento/cuenta', soloAdmin,
  responder((req) => cambiarEstadoCuenta(req.params.documento, req.body?.activa, req.empleado)));

export default router;
