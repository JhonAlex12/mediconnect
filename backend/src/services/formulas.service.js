import { pool } from '../db/pool.js';
import { validarAfiliacion, calcularCuota } from './cobros.service.js';

// Error con código HTTP, para responder con el estado correcto (400, 409...)
export class ErrorNegocio extends Error {
  constructor(mensaje, estado = 400, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

const FORMATO_CODIGO = /^F-\d{4}-\d{4}$/;      // F-2026-0001
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;   // 2026-10-30
const ORIGENES = ['ips', 'simulador'];

const fechaValida = (valor) =>
  typeof valor === 'string' && FORMATO_FECHA.test(valor) && !Number.isNaN(Date.parse(valor));

// Revisa los datos recibidos y devuelve la lista de problemas (vacía si todo está bien)
function validar(datos) {
  const errores = [];
  const d = datos ?? {};

  if (typeof d.codigo !== 'string' || !FORMATO_CODIGO.test(d.codigo)) {
    errores.push('codigo: debe tener el formato F-AAAA-NNNN');
  }
  if (typeof d.documento !== 'string' || !/^\d{5,20}$/.test(d.documento)) {
    errores.push('documento: solo números, entre 5 y 20 dígitos');
  }
  if (typeof d.nombre !== 'string' || d.nombre.trim().length < 3) {
    errores.push('nombre: obligatorio');
  }
  if (!fechaValida(d.fecha_emision)) {
    errores.push('fecha_emision: formato AAAA-MM-DD');
  }
  if (!fechaValida(d.fecha_limite)) {
    errores.push('fecha_limite: formato AAAA-MM-DD');
  }
  if (fechaValida(d.fecha_emision) && fechaValida(d.fecha_limite) && d.fecha_limite < d.fecha_emision) {
    errores.push('fecha_limite: no puede ser anterior a la fecha de emisión');
  }
  if (d.origen !== undefined && !ORIGENES.includes(d.origen)) {
    errores.push(`origen: debe ser ${ORIGENES.join(' o ')}`);
  }

  if (!Array.isArray(d.medicamentos) || d.medicamentos.length === 0) {
    errores.push('medicamentos: debe haber al menos uno');
  } else {
    const ids = new Set();
    d.medicamentos.forEach((m, i) => {
      if (!Number.isInteger(m?.medicamento_id) || m.medicamento_id <= 0) {
        errores.push(`medicamentos[${i}].medicamento_id: número entero positivo`);
      } else if (ids.has(m.medicamento_id)) {
        errores.push(`medicamentos[${i}]: medicamento repetido`);
      } else {
        ids.add(m.medicamento_id);
      }
      if (!Number.isInteger(m?.cantidad) || m.cantidad <= 0) {
        errores.push(`medicamentos[${i}].cantidad: número entero positivo`);
      }
    });
  }

  // Indicaciones del médico: opcionales, texto de hasta 1000 caracteres
  if (d.indicaciones != null && (typeof d.indicaciones !== 'string' || d.indicaciones.trim().length > 1000)) {
    errores.push('indicaciones: texto de máximo 1000 caracteres');
  }

  // Régimen, rango de ingreso, EPS y exención: definen la cuota moderadora
  errores.push(...validarAfiliacion(d));

  return errores;
}

export async function crearFormula(datos) {
  const errores = validar(datos);
  if (errores.length > 0) {
    throw new ErrorNegocio('Datos incompletos o inválidos', 400, errores);
  }

  const cliente = await pool.connect();
  try {
    // Transacción: o se guarda todo, o no se guarda nada
    await cliente.query('BEGIN');

    // Todos los medicamentos deben existir en el catálogo
    const idsMedicamentos = datos.medicamentos.map((m) => m.medicamento_id);
    const { rows: existentes } = await cliente.query(
      'SELECT id FROM medicamentos WHERE id = ANY($1) AND activo = TRUE',
      [idsMedicamentos]
    );
    if (existentes.length !== idsMedicamentos.length) {
      throw new ErrorNegocio('Algún medicamento no existe en el catálogo', 400);
    }

    // Registra al paciente si no existe; si ya existe, reutiliza el mismo y toma el nombre
    // y la afiliación de la fórmula más reciente (la IPS tiene el dato oficial ligado al documento)
    const rango = datos.regimen === 'contributivo' ? datos.rango_ingreso : null;
    const { rows: [paciente] } = await cliente.query(
      `INSERT INTO pacientes (documento, nombre, telefono, regimen, rango_ingreso, eps)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (documento)
       DO UPDATE SET nombre = EXCLUDED.nombre,
                     telefono = COALESCE(EXCLUDED.telefono, pacientes.telefono),
                     regimen = EXCLUDED.regimen,
                     rango_ingreso = EXCLUDED.rango_ingreso,
                     eps = COALESCE(EXCLUDED.eps, pacientes.eps)
       RETURNING id`,
      [datos.documento, datos.nombre.trim(), datos.telefono ?? null,
       datos.regimen, rango, datos.eps?.trim() || null]
    );

    // Cuánto pagará el paciente al reclamar (queda fijo con la tarifa de hoy)
    const cuota = await calcularCuota(cliente, { ...datos, rango_ingreso: rango });

    // Guarda la fórmula
    const { rows: [formula] } = await cliente.query(
      `INSERT INTO formulas (codigo, paciente_id, fecha_emision, fecha_limite, origen,
                             regimen, rango_ingreso, eps, exencion, cuota_moderadora, indicaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, codigo, fecha_emision, fecha_limite, origen, regimen, cuota_moderadora`,
      [datos.codigo, paciente.id, datos.fecha_emision, datos.fecha_limite, datos.origen ?? 'ips',
       datos.regimen, rango, datos.eps?.trim() || null, datos.exencion ?? null, cuota,
       datos.indicaciones?.trim() || null]
    );

    // Guarda cada medicamento de la fórmula
    for (const m of datos.medicamentos) {
      await cliente.query(
        `INSERT INTO formula_items (formula_id, medicamento_id, cantidad_formulada)
         VALUES ($1, $2, $3)`,
        [formula.id, m.medicamento_id, m.cantidad]
      );
    }

    await cliente.query('COMMIT');
    return { ...formula, medicamentos: datos.medicamentos.length };
  } catch (error) {
    await cliente.query('ROLLBACK');
    // 23505 = violación de unicidad en PostgreSQL (código de fórmula repetido)
    if (error.code === '23505') {
      throw new ErrorNegocio('Ya existe una fórmula con ese código', 409);
    }
    throw error;
  } finally {
    cliente.release();   // devuelve la conexión al pool
  }
}