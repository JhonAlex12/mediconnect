import { pool } from '../db/pool.js';
import { ZONA_HORARIA } from '../config/negocio.js';
import { crearFormula, ErrorNegocio } from './formulas.service.js';

export async function listarCatalogo() {
  const { rows } = await pool.query(
    `SELECT id, nombre, presentacion, stock_actual
       FROM medicamentos WHERE activo = TRUE ORDER BY nombre`
  );
  return rows;
}

// Próximo código libre del año en curso: F-2026-0007
export async function siguienteCodigo() {
  const { rows: [r] } = await pool.query(
    `SELECT EXTRACT(YEAR FROM now() AT TIME ZONE $1)::int AS anio,
            COALESCE(MAX(SUBSTRING(codigo FROM 8)::int), 0) AS ultimo
       FROM formulas
      WHERE codigo LIKE 'F-' || EXTRACT(YEAR FROM now() AT TIME ZONE $1)::int || '-%'`,
    [ZONA_HORARIA]
  );
  return `F-${r.anio}-${String(r.ultimo + 1).padStart(4, '0')}`;
}

export async function formulasRecientes() {
  const { rows } = await pool.query(
    `SELECT f.id, f.codigo, f.fecha_emision, f.fecha_limite, f.origen,
            f.regimen, f.exencion, f.cuota_moderadora,
            p.nombre AS paciente_nombre, p.documento AS paciente_documento,
            COALESCE(json_agg(json_build_object(
              'medicamento_nombre', m.nombre,
              'cantidad_formulada', fi.cantidad_formulada
            ) ORDER BY fi.id) FILTER (WHERE fi.id IS NOT NULL), '[]') AS items
       FROM formulas f
       JOIN pacientes p ON p.id = f.paciente_id
       LEFT JOIN formula_items fi ON fi.formula_id = f.id
       LEFT JOIN medicamentos m ON m.id = fi.medicamento_id
      WHERE f.origen = 'simulador'   -- nunca las fórmulas reales que envía la IPS
      GROUP BY f.id, p.id
      ORDER BY f.creado_en DESC
      LIMIT 10`
  );
  return rows;
}

// Emite una fórmula como lo haría la IPS: el código lo asigna el sistema
export async function emitirFormula({
  documento, nombre, fecha_emision, fecha_limite, medicamentos, regimen, rango_ingreso, eps, exencion,
}) {
  const datos = {
    documento: typeof documento === 'string' ? documento.trim() : documento,
    nombre,
    fecha_emision,
    fecha_limite,
    medicamentos,
    regimen,
    rango_ingreso: rango_ingreso || null,
    eps: eps || null,
    exencion: exencion || null,
    origen: 'simulador',
  };

  // Si dos personas emiten a la vez y chocan en el código, se reintenta con el siguiente
  for (let intento = 0; intento < 3; intento++) {
    try {
      return await crearFormula({ ...datos, codigo: await siguienteCodigo() });
    } catch (error) {
      const choque = error instanceof ErrorNegocio && error.estado === 409;
      if (!choque || intento === 2) throw error;
    }
  }
}
