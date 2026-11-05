import { listarCatalogo, formulasRecientes, siguienteCodigo, emitirFormula } from '../services/simulador.service.js';

// GET /api/simulador/medicamentos
export async function catalogo(req, res, next) {
  try {
    res.json({ ok: true, medicamentos: await listarCatalogo() });
  } catch (error) {
    next(error);
  }
}

// GET /api/simulador/formulas
export async function recientes(req, res, next) {
  try {
    res.json({ ok: true, siguiente_codigo: await siguienteCodigo(), formulas: await formulasRecientes() });
  } catch (error) {
    next(error);
  }
}

// POST /api/simulador/formulas
export async function emitir(req, res, next) {
  try {
    const formula = await emitirFormula(req.body ?? {});
    res.status(201).json({ ok: true, formula, siguiente_codigo: await siguienteCodigo() });
  } catch (error) {
    next(error);
  }
}
