import { consultarFormula } from '../services/disponibilidad.service.js';

export async function consultar(req, res, next) {
  try {
    const { codigo, documento } = req.body ?? {};
    const formula = await consultarFormula(codigo, documento);
    res.json({ ok: true, formula });
  } catch (error) {
    next(error);
  }
}