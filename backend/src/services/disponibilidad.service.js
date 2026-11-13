import { pool } from '../db/pool.js';
import { ZONA_HORARIA, DIAS_ALERTA } from '../config/negocio.js';
import { ErrorNegocio } from './formulas.service.js';
import { describirCobro } from './cobros.service.js';

// Calcula el estado de un medicamento según las reglas del negocio:
//   agotado        → stock = 0                                       (RN-04)
//   pocas_unidades → lo que queda libre (stock menos lo apartado por
//                    otros turnos) no alcanza para lo pendiente      (RN-03)
//   disponible     → alcanza para lo pendiente más lo de otros       (RN-02)
//   entregado      → ya se entregó todo lo formulado
// El stock mínimo NO cuenta aquí: es una alerta interna de reposición para la farmacia
// (Inventario → "Stock bajo"); al paciente solo le importa si le alcanza o no.
export function calcularEstado({ pendiente, stockActual, reservadoOtros }) {
  if (pendiente === 0) return 'entregado';
  if (stockActual === 0) return 'agotado';

  const libre = stockActual - reservadoOtros;
  if (libre < pendiente) return 'pocas_unidades';

  return 'disponible';
}

const DOCUMENTO = /^\d{5,20}$/;
const limpiar = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// "María Fernanda Rojas Pérez" → "María F. R. P.": al consultar solo con el código
// no se muestra el nombre completo (los códigos son consecutivos y fáciles de adivinar)
const nombreReservado = (nombre) => {
  const [primero, ...resto] = String(nombre ?? '').trim().split(/\s+/);
  return [primero, ...resto.map((p) => `${p.charAt(0).toUpperCase()}.`)].join(' ');
};

// Fórmulas vigentes del paciente que aún tienen medicamentos por reclamar
export async function formulasPendientes(documento) {
  const doc = limpiar(documento);
  if (!doc || !DOCUMENTO.test(doc)) {
    throw new ErrorNegocio('Escribe tu número de documento (solo números)', 400);
  }
  const { rows: [p] } = await pool.query('SELECT id, nombre FROM pacientes WHERE documento = $1', [doc]);
  // Mismo resultado si el documento no existe o no tiene nada pendiente
  if (!p) return { paciente: null, formulas: [] };

  const { rows } = await pool.query(
    `SELECT f.codigo, f.fecha_emision, f.fecha_limite,
            (f.fecha_limite - (now() AT TIME ZONE $2)::date) AS dias_restantes,
            count(*)::int AS medicamentos,
            count(*) FILTER (WHERE fi.cantidad_entregada < fi.cantidad_formulada)::int AS por_reclamar
       FROM formulas f
       JOIN formula_items fi ON fi.formula_id = f.id
      WHERE f.paciente_id = $1 AND f.fecha_limite >= (now() AT TIME ZONE $2)::date
      GROUP BY f.id
     HAVING sum(fi.cantidad_formulada - fi.cantidad_entregada) > 0
      ORDER BY f.fecha_limite ASC, f.id ASC`,
    [p.id, ZONA_HORARIA]
  );

  await pool.query(
    `INSERT INTO registro_accesos (paciente_id, accion, detalle) VALUES ($1, 'consultar_formulas_documento', $2)`,
    [p.id, `${rows.length} pendiente(s)`]
  );

  return {
    paciente: p.nombre,
    formulas: rows.map((f) => ({ ...f, alerta: f.dias_restantes <= DIAS_ALERTA })),
  };
}

// Detalle de una fórmula: con el código, y opcionalmente el documento.
// Sin el documento el nombre va abreviado y no se puede pedir turno con ella.
export async function consultarFormula(codigo, documento) {
  const cod = limpiar(codigo)?.toUpperCase();
  const doc = limpiar(documento);
  if (!cod) {
    throw new ErrorNegocio('Escribe el código de la fórmula', 400);
  }

  const { rows: [formula] } = await pool.query(
    `SELECT f.id, f.codigo, f.fecha_emision, f.fecha_limite,
            f.regimen, f.rango_ingreso, f.eps, f.exencion, f.cuota_moderadora,
            (SELECT json_build_object('valor', pg.valor, 'fecha', pg.fecha)
               FROM pagos pg WHERE pg.formula_id = f.id) AS pago,
            p.id AS paciente_id, p.nombre,
            (f.fecha_limite - (now() AT TIME ZONE $3)::date) AS dias_restantes
       FROM formulas f
       JOIN pacientes p ON p.id = f.paciente_id
      WHERE f.codigo = $1 AND ($2::text IS NULL OR p.documento = $2)`,
    [cod, doc, ZONA_HORARIA]
  );

  // Mismo mensaje si falla el código o el documento: no se revela cuál de los dos
  if (!formula) {
    throw new ErrorNegocio(doc ? 'Código o documento incorrectos' : 'No encontramos una fórmula con ese código', 404);
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
        reservadoOtros: i.reservado_otros,
      }),
    };
  });

  const dias = formula.dias_restantes;
  return {
    codigo: formula.codigo,
    paciente: doc ? formula.nombre : nombreReservado(formula.nombre),
    // Sin el documento se ve la fórmula, pero para pedir turno hay que escribirlo
    requiere_documento: !doc,
    fecha_emision: formula.fecha_emision,
    fecha_limite: formula.fecha_limite,
    dias_restantes: dias,
    vencida: dias < 0,
    alerta: dias >= 0 && dias <= DIAS_ALERTA,
    cobro: describirCobro(formula, formula.pago),
    medicamentos,
  };
}