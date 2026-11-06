import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { REGIMENES, RANGOS_INGRESO, EXENCIONES, MEDIOS_PAGO } from '../config/negocio.js';

// ============================================================
// DATOS DE AFILIACIÓN QUE LLEGAN CON LA FÓRMULA
// ============================================================

// Devuelve la lista de problemas (vacía si todo está bien)
export function validarAfiliacion(d) {
  const errores = [];
  if (!REGIMENES.includes(d.regimen)) {
    errores.push(`regimen: debe ser ${REGIMENES.join(' o ')}`);
  }
  if (d.regimen === 'contributivo' && !RANGOS_INGRESO.includes(d.rango_ingreso)) {
    errores.push('rango_ingreso: obligatorio en el régimen contributivo (A, B o C)');
  }
  if (d.rango_ingreso != null && !RANGOS_INGRESO.includes(d.rango_ingreso)) {
    errores.push('rango_ingreso: debe ser A, B o C');
  }
  if (d.exencion != null && !(d.exencion in EXENCIONES)) {
    errores.push(`exencion: debe ser ${Object.keys(EXENCIONES).join(', ')}`);
  }
  if (d.eps != null && (typeof d.eps !== 'string' || d.eps.trim().length > 80)) {
    errores.push('eps: texto de máximo 80 caracteres');
  }
  return errores;
}

// Cuánto se cobra por una fórmula nueva. Usa la tarifa del año de emisión
// (o la última cargada antes de ese año, si aún no hay una para ese año).
export async function calcularCuota(cliente, { regimen, rango_ingreso, exencion, fecha_emision }) {
  if (regimen !== 'contributivo' || exencion) return 0;

  const { rows: [t] } = await cliente.query(
    `SELECT valor FROM tarifas_cuota_moderadora
      WHERE rango = $1 AND anio <= EXTRACT(YEAR FROM $2::date)
      ORDER BY anio DESC LIMIT 1`,
    [rango_ingreso, fecha_emision]
  );
  if (!t) {
    throw new ErrorNegocio('No hay tarifa de cuota moderadora cargada para el año de la fórmula', 400);
  }
  return t.valor;
}

// Resumen del cobro para mostrar al paciente y al auxiliar
export function describirCobro(f, pago) {
  let motivo;
  if (!f.regimen) motivo = 'Fórmula sin datos de afiliación';
  else if (f.exencion) motivo = `Exento: ${EXENCIONES[f.exencion]}`;
  else if (f.regimen === 'subsidiado') motivo = 'Régimen subsidiado: sin cuota moderadora';
  else motivo = `Cuota moderadora, régimen contributivo, rango ${f.rango_ingreso}`;

  return {
    valor: f.cuota_moderadora,
    motivo,
    regimen: f.regimen,
    rango_ingreso: f.rango_ingreso,
    eps: f.eps,
    exencion: f.exencion,
    pagado: Boolean(pago),
    pago: pago ?? null,
    // Hay que cobrar antes de entregar
    pendiente_pago: f.cuota_moderadora > 0 && !pago,
  };
}

// ============================================================
// PAGO EN VENTANILLA
// ============================================================

export function validarPago(pago, valor) {
  if (!pago || typeof pago !== 'object') {
    throw new ErrorNegocio(`Falta registrar el pago de la cuota moderadora ($${valor.toLocaleString('es-CO')})`, 409);
  }
  if (!MEDIOS_PAGO.includes(pago.medio)) {
    throw new ErrorNegocio(`pago.medio: debe ser ${MEDIOS_PAGO.join(', ')}`, 400);
  }
  if (pago.medio === 'efectivo') {
    if (!Number.isInteger(pago.recibido) || pago.recibido < valor) {
      throw new ErrorNegocio(`El efectivo recibido debe ser al menos $${valor.toLocaleString('es-CO')}`, 400);
    }
  } else if (typeof pago.referencia !== 'string' || pago.referencia.trim().length < 3
             || pago.referencia.trim().length > 40) {
    throw new ErrorNegocio('pago.referencia: escribe el número de la transferencia o del voucher', 400);
  }
}

// Registra el pago dentro de la transacción de la entrega
export async function registrarPago(cliente, { formulaId, turnoId, valor, pago, empleado }) {
  const { rows: [p] } = await cliente.query(
    `INSERT INTO pagos (formula_id, turno_id, valor, medio, recibido, referencia, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, valor, medio, recibido, referencia, fecha`,
    [formulaId, turnoId, valor, pago.medio,
     pago.medio === 'efectivo' ? pago.recibido : null,
     pago.medio === 'efectivo' ? null : pago.referencia.trim(),
     empleado.id]
  );
  return { ...p, cambio: p.recibido != null ? p.recibido - p.valor : null };
}

// ============================================================
// TARIFAS (solo administrador)
// ============================================================

export async function listarTarifas() {
  const { rows } = await pool.query(
    `SELECT anio,
            MAX(valor) FILTER (WHERE rango = 'A') AS "A",
            MAX(valor) FILTER (WHERE rango = 'B') AS "B",
            MAX(valor) FILTER (WHERE rango = 'C') AS "C"
       FROM tarifas_cuota_moderadora
      GROUP BY anio
      ORDER BY anio DESC`
  );
  return rows;
}

export async function guardarTarifas(anio, valores, empleado) {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    throw new ErrorNegocio('Año no válido', 400);
  }
  for (const r of RANGOS_INGRESO) {
    const v = valores?.[r];
    if (!Number.isInteger(v) || v < 0 || v > 10_000_000) {
      throw new ErrorNegocio(`${r}: valor en pesos, entero y no negativo`, 400);
    }
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (const r of RANGOS_INGRESO) {
      await cliente.query(
        `INSERT INTO tarifas_cuota_moderadora (anio, rango, valor) VALUES ($1, $2, $3)
         ON CONFLICT (anio, rango) DO UPDATE SET valor = EXCLUDED.valor`,
        [anio, r, valores[r]]
      );
    }
    await registrarAcceso(
      { usuarioId: empleado.id, accion: 'editar_tarifas', detalle: `${anio}: A=${valores.A} B=${valores.B} C=${valores.C}` },
      cliente
    );
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
  return listarTarifas();
}
