import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { listarTarifas, guardarTarifas } from '../services/cobros.service.js';

const router = Router();

// Solo administradores: valores de la cuota moderadora por año
router.use(exigirEmpleado('administrador'));

// GET /api/tarifas
router.get('/', async (req, res, next) => {
  try {
    res.json({ ok: true, tarifas: await listarTarifas() });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tarifas/2026  { "A": 5000, "B": 20100, "C": 52800 }
router.put('/:anio', async (req, res, next) => {
  try {
    const tarifas = await guardarTarifas(Number(req.params.anio), req.body, req.empleado);
    res.json({ ok: true, tarifas });
  } catch (error) {
    next(error);
  }
});

export default router;
