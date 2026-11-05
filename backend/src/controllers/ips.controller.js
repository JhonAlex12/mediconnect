import { crearFormula } from '../services/formulas.service.js';

export async function registrarFormula(req, res, next) {
  try {
    const formula = await crearFormula(req.body);
    res.status(201).json({ ok: true, formula });
  } catch (error) {
    next(error);   // lo atiende el manejador de errores de app.js
  }
}