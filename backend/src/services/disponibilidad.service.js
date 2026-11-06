import { pool } from '../db/pool.js';
import { ZONA_HORARIA, DIAS_ALERTA } from '../config/negocio.js';
import { ErrorNegocio } from './formulas.service.js';
import { describirCobro } from './cobros.service.js';

// Calcula el estado de un medicamento según las reglas del negocio:
//   agotado        → stock = 0                                       (RN-04)
//   pocas_unidades → stock bajo el mínimo, o no alcanza para lo
//                    pendiente después de lo apartado por otros      (RN-03)
//   disponible     → alcanza para lo pendiente más lo de otros       (RN-02)
//   entregado      → ya se entregó todo lo formulado
export function calcularEstado({ pendiente, stockActual, stockMinimo, reservadoOtros }) {
  if (pendiente === 0) return 'entregado';
  if (stockActual === 0) return 'agotado';

  const libre = stockActual - reservadoOtros;
  if (stockActual < stockMinimo || libre < pendiente) return 'pocas_unidades';

  return 'disponible';
}

export async function consultarFormula(codigo, documento) {
  if (typeof codigo !== 'string' || typeof documento !== 'string') {
    throw new ErrorNegocio('Ingresa el código de la fórmula y tu documento', 400);
  }

  // Busca la fórmula solo si el código y el documento coinciden
  const { rows: [formula] } = await pool.query(
    `SELECT f.id, f.codigo, f.fecha_emision, f.fecha_limite,
            f.regimen, f.rango_ingreso, f.eps, f.exencion, f.cuota_moderadora,
            (SELECT json_build_object('valor', pg.valor, 'fecha', pg.fecha)
               FROM pagos pg WHERE pg.formula_id = f.id) AS pago,
            p.id AS paciente_id, p.nombre,
            (f.fecha_limite - (now() AT TIME ZONE $3)::date) AS dias_restantes
       FROM formulas f
       JOIN pacientes p ON p.id = f.paciente_id
      WHERE f.codigo = $1 AND p.documento = $2`,
    [codigo.trim().toUpperCase(), documento.trim(), ZONA_HORARIA]
  );

  // Mismo mensaje si falla el código o el documento: no se revela cuál de los dos
  if (!formula) {
    throw new ErrorNegocio('Código o documento incorrectos', 404);
  }

  // Medicamentos de la fórmula, con lo que otros pacientes ya tienen apartado.
  // Las reservas del propio paciente no cuentan en su contra.
  const { rows: items } = await pool.query(
    `SELECT m.id AS medicamento_id, m.nombre, m.presentacion,
            m.stock_actual, m.stock_minimo,
            fi.cantidad_formulada, fi.cantidad_entregada,
            COALESCE((
              SELECT SUM(r.cantidad)
                FROM reservas r
                JOIN turnos t ON t.id = r.turno_id
               WHERE r.medicamento_id = m.id
                 AND r.liberada = FALSE
                 AND r.vence_en > now()
                 AND t.paciente_id IS DISTINCT FROM $2
            ), 0)::int AS reservado_otros
       FROM formula_items fi
       JOIN medicamentos m ON m.id = fi.medicamento_id
      WHERE fi.formula_id = $1
      ORDER BY fi.id`,
    [formula.id, formula.paciente_id]
  );

  // Deja constancia de quién consultó qué (RNF-05)
  await pool.query(
    `INSERT INTO registro_accesos (paciente_id, accion, detalle)
     VALUES ($1, 'consultar_formula', $2)`,
    [formula.paciente_id, formula.codigo]
  );

  const medicamentos = items.map((i) => {
    const pendiente = i.cantidad_formulada - i.cantidad_entregada;
    return {
      medicamento_id: i.medicamento_id,
      nombre: i.nombre,
      presentacion: i.presentacion,
      cantidad_formulada: i.cantidad_formulada,
      cantidad_entregada: i.cantidad_entregada,
      cantidad_pendiente: pendiente,
      entrega_parcial: i.cantidad_entregada > 0 && pendiente > 0,
      estado: calcularEstado({
        pendiente,
        stockActual: i.stock_actual,
        stockMinimo: i.stock_minimo,
        reservadoOtros: i.reservado_otros,
      }),
    };
  });

  const dias = formula.dias_restantes;
  return {
    codigo: formula.codigo,
    paciente: formula.nombre,
    fecha_emision: formula.fecha_emision,
    fecha_limite: formula.fecha_limite,
    dias_restantes: dias,
    vencida: dias < 0,
    alerta: dias >= 0 && dias <= DIAS_ALERTA,
    cobro: describirCobro(formula, formula.pago),
    medicamentos,
  };
}