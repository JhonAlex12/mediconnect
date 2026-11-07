import { Router } from 'express';
import { exigirEmpleado } from '../middleware/autenticacion.js';
import { listarTarifas, guardarTarifas } from '../services/cobros.service.js';

const router = Router();

// Pública: valores del año más reciente, para la página de información al paciente
router.get('/vigentes', async (req, res, next) => {
  try {
    const [vigente] = await listarTarifas();
    res.json({ ok: true, tarifa: vigente ?? null });
  } catch (error) {
    next(error);
  }
});

// Lo demás, solo administradores: valores de la cuota moderadora por año
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
