import { consultarFormula, formulasPendientes } from '../services/disponibilidad.service.js';

// Con el código (y el documento, si lo escribió): el detalle de esa fórmula.
// Solo con el documento: la lista de fórmulas que tiene pendientes.
export async function consultar(req, res, next) {
  try {
    const { codigo, documento } = req.body ?? {};
    const conCodigo = typeof codigo === 'string' && codigo.trim() !== '';
    if (conCodigo) {
      res.json({ ok: true, formula: await consultarFormula(codigo, documento) });
    } else {
      res.json({ ok: true, ...(await formulasPendientes(documento)) });
    }
  } catch (error) {
    next(error);
  }
}
