import { crearFormula } from '../services/formulas.service.js';
import { publicarFormulaNueva } from '../services/tiempoReal.service.js';

export async function registrarFormula(req, res, next) {
  try {
    const { cuentas, ...formula } = await crearFormula(req.body);
    publicarFormulaNueva(cuentas);   // aparece al instante en la cuenta del paciente
    res.status(201).json({ ok: true, formula });
  } catch (error) {
    next(error);   // lo atiende el manejador de errores de app.js
  }
}