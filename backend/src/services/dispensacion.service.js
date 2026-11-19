import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { conAvisoDeCambios } from './inventario.service.js';
import { describirCobro, validarPago, registrarPago } from './cobros.service.js';
import { ZONA_HORARIA } from '../config/negocio.js';

const HOY = `(now() AT TIME ZONE '${ZONA_HORARIA}')::date`;

const ESTADOS_DISPENSABLES = ['llamado', 'presente'];

// Lo que ya tienen apartado OTROS turnos (las reservas del propio turno sí se pueden usar)
async function reservadoPorOtros(cliente, medicamentoIds, turnoId) {
  const { rows } = await cliente.query(
    `SELECT medicamento_id, SUM(cantidad)::int AS total
       FROM reservas
      WHERE medicamento_id = ANY($1) AND liberada = FALSE
        AND vence_en > now() AND turno_id <> $2
      GROUP BY medicamento_id`,
    [medicamentoIds, turnoId]
  );
  return new Map(rows.map((r) => [r.medicamento_id, r.total]));
}

// ============================================================
// VER UN TURNO PARA DISPENSAR (CU-07 pasos 1 y 2)
// ============================================================
export async function verParaDispensar(turnoId) {
  const { rows: [t] } = await pool.query(
    `SELECT t.id, t.numero, t.estado, t.formula_id,
            p.nombre AS paciente, p.documento, f.codigo AS formula, f.fecha_limite,
            f.fecha_limite < ${HOY} AS vencida,
            f.regimen, f.rango_ingreso, f.eps, f.exencion, f.cuota_moderadora, f.indicaciones,
            (SELECT json_build_object('valor', pg.valor, 'medio', pg.medio, 'fecha', pg.fecha)
               FROM pagos pg WHERE pg.formula_id = f.id) AS pago
       FROM turnos t
       LEFT JOIN pacientes p ON p.id = t.paciente_id
       LEFT JOIN formulas f ON f.id = t.formula_id
      WHERE t.id = $1`,
    [turnoId]
  );
  if (!t) throw new ErrorNegocio('Turno no encontrado', 404);
  if (!t.formula_id) throw new ErrorNegocio('Este turno no tiene una fórmula vinculada', 400);

  const { rows: items } = await pool.query(
    `SELECT fi.id AS formula_item_id, m.id AS medicamento_id, m.nombre, m.presentacion,
            fi.cantidad_formulada, fi.cantidad_entregada,
            (fi.cantidad_formulada - fi.cantidad_entregada) AS pendiente,
            m.stock_actual
       FROM formula_items fi
       JOIN medicamentos m ON m.id = fi.medicamento_id
      WHERE fi.formula_id = $1
      ORDER BY fi.id`,
    [t.formula_id]
  );
  const otros = await reservadoPorOtros(pool, items.map((i) => i.medicamento_id), t.id);

  const { formula_id, regimen, rango_ingreso, eps, exencion, cuota_moderadora, pago, ...turno } = t;
  return {
    turno,
    cobro: describirCobro(t, pago),
    puede_dispensar: ESTADOS_DISPENSABLES.includes(t.estado) && !t.vencida,
    medicamentos: items.map((i) => ({
      ...i,
      // Máximo que se puede entregar ahora: lo pendiente, sin tocar lo apartado por otros
      maximo_entregable: Math.max(0, Math.min(i.pendiente, i.stock_actual - (otros.get(i.medicamento_id) ?? 0))),
    })),
  };
}

// ============================================================
// DISPENSAR (CU-07 pasos 3 a 7)
// ============================================================
export async function dispensar(turnoId, { items, delegado, pago } = {}, empleado) {
  // Validación de lo que se quiere entregar
  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorNegocio('Indica al menos un medicamento a entregar', 400);
  }
  const vistos = new Set();
  for (const [i, it] of items.entries()) {
    if (!Number.isInteger(it?.formula_item_id) || it.formula_item_id <= 0) {
      throw new ErrorNegocio(`items[${i}].formula_item_id: entero positivo`, 400);
    }
    if (!Number.isInteger(it.cantidad) || it.cantidad <= 0) {
      throw new ErrorNegocio(`items[${i}].cantidad: entero positivo`, 400);
    }
    if (vistos.has(it.formula_item_id)) throw new ErrorNegocio(`items[${i}]: repetido`, 400);
    vistos.add(it.formula_item_id);
  }

  // Si recoge otra persona, se necesitan sus datos (RN-16)
  if (delegado) {
    if (typeof delegado.nombre !== 'string' || delegado.nombre.trim().length < 3
        || typeof delegado.documento !== 'string' || !/^\d{5,20}$/.test(delegado.documento.trim())) {
      throw new ErrorNegocio('delegado: nombre y documento (solo números) son obligatorios', 400);
    }
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    // Bloquea el turno
    const { rows: [t] } = await cliente.query(
      `SELECT t.id, t.numero, t.estado, t.paciente_id, t.formula_id, f.codigo, f.fecha_limite,
              f.fecha_limite < ${HOY} AS vencida
         FROM turnos t LEFT JOIN formulas f ON f.id = t.formula_id
        WHERE t.id = $1
          FOR UPDATE OF t`,
      [turnoId]
    );
    if (!t) throw new ErrorNegocio('Turno no encontrado', 404);
    if (!ESTADOS_DISPENSABLES.includes(t.estado)) {
      throw new ErrorNegocio(`No se puede dispensar un turno en estado "${t.estado}"`, 409);
    }
    if (!t.formula_id) throw new ErrorNegocio('Este turno no tiene una fórmula vinculada', 400);
    if (t.vencida) {
      throw new ErrorNegocio(`La fórmula ${t.codigo} superó su fecha límite de reclamo (${t.fecha_limite})`, 409);
    }

    // Cuota moderadora: no se entrega sin pago. Se cobra una sola vez por fórmula;
    // la fila de la fórmula se bloquea para que dos ventanillas no cobren dos veces.
    const { rows: [f] } = await cliente.query(
      `SELECT f.cuota_moderadora, EXISTS (SELECT 1 FROM pagos WHERE formula_id = f.id) AS pagada
         FROM formulas f WHERE f.id = $1 FOR UPDATE`,
      [t.formula_id]
    );
    const debeCobrar = f.cuota_moderadora > 0 && !f.pagada;
    if (debeCobrar) validarPago(pago, f.cuota_moderadora);

    // Bloquea los ítems de la fórmula y sus medicamentos
    const { rows: filas } = await cliente.query(
      `SELECT fi.id, fi.medicamento_id, (fi.cantidad_formulada - fi.cantidad_entregada) AS pendiente,
              m.nombre, m.stock_actual
         FROM formula_items fi
         JOIN medicamentos m ON m.id = fi.medicamento_id
        WHERE fi.formula_id = $1
        ORDER BY m.id
          FOR UPDATE OF fi, m`,
      [t.formula_id]
    );
    const porItem = new Map(filas.map((f) => [f.id, f]));
    const otros = await reservadoPorOtros(cliente, filas.map((f) => f.medicamento_id), t.id);

    // Verifica cada cantidad antes de tocar nada (4a: stock insuficiente)
    for (const it of items) {
      const f = porItem.get(it.formula_item_id);
      if (!f) throw new ErrorNegocio('Un medicamento no pertenece a esta fórmula', 400);
      if (it.cantidad > f.pendiente) {
        throw new ErrorNegocio(`${f.nombre}: solo quedan ${f.pendiente} pendientes`, 400);
      }
      const libre = f.stock_actual - (otros.get(f.medicamento_id) ?? 0);
      if (it.cantidad > libre) {
        throw new ErrorNegocio(
          `Stock insuficiente de ${f.nombre}: se pueden entregar máximo ${Math.max(0, libre)}`,
          409
        );
      }
    }

    const medicamentoIds = items.map((it) => porItem.get(it.formula_item_id).medicamento_id);

    const pagoRegistrado = debeCobrar
      ? await registrarPago(cliente, {
          formulaId: t.formula_id, turnoId: t.id, valor: f.cuota_moderadora, pago, empleado,
        })
      : null;

    const { turnosAvisados } = await conAvisoDeCambios(cliente, medicamentoIds, async () => {
      for (const it of items) {
        const f = porItem.get(it.formula_item_id);
        // Descuenta el inventario y deja el movimiento (cantidad negativa: sale)
        await cliente.query(
          `UPDATE medicamentos SET stock_actual = stock_actual - $2 WHERE id = $1`,
          [f.medicamento_id, it.cantidad]
        );
        await cliente.query(
          `INSERT INTO movimientos_inventario (medicamento_id, tipo, cantidad, usuario_id, motivo)
           VALUES ($1, 'dispensacion', $2, $3, $4)`,
          [f.medicamento_id, -it.cantidad, empleado.id, `Turno ${t.numero}`]
        );
        // Registra la entrega
        await cliente.query(
          `INSERT INTO dispensaciones (turno_id, formula_item_id, cantidad, usuario_id, delegado_nombre, delegado_documento)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [t.id, f.id, it.cantidad, empleado.id,
           delegado?.nombre.trim() ?? null, delegado?.documento.trim() ?? null]
        );
        // Actualiza lo entregado (lo pendiente se calcula solo)
        await cliente.query(
          `UPDATE formula_items SET cantidad_entregada = cantidad_entregada + $2 WHERE id = $1`,
          [f.id, it.cantidad]
        );
      }

      // Turno atendido, reservas sobrantes liberadas y faltas reiniciadas
      await cliente.query(`UPDATE turnos SET estado = 'atendido' WHERE id = $1`, [t.id]);
      await cliente.query(
        `UPDATE reservas SET liberada = TRUE WHERE turno_id = $1 AND liberada = FALSE`,
        [t.id]
      );
      if (t.paciente_id) {
        await cliente.query(`UPDATE pacientes SET faltas_seguidas = 0 WHERE id = $1`, [t.paciente_id]);
      }
    });

    // Lo que quedó pendiente en la fórmula
    const { rows: pendientes } = await cliente.query(
      `SELECT m.nombre, (fi.cantidad_formulada - fi.cantidad_entregada) AS cantidad
         FROM formula_items fi JOIN medicamentos m ON m.id = fi.medicamento_id
        WHERE fi.formula_id = $1 AND fi.cantidad_entregada < fi.cantidad_formulada`,
      [t.formula_id]
    );

    if (t.paciente_id) {
      const mensaje = pendientes.length === 0
        ? `Se entregaron todos los medicamentos de tu fórmula ${t.codigo}.`
        : `Entrega parcial de tu fórmula ${t.codigo}. Quedan pendientes: `
          + pendientes.map((p) => `${p.nombre} (${p.cantidad})`).join(', ')
          + `. Puedes reclamarlos hasta el ${t.fecha_limite}.`;
      await cliente.query(
        `INSERT INTO notificaciones (paciente_id, tipo, mensaje) VALUES ($1, 'entrega', $2)`,
        [t.paciente_id, mensaje]
      );
    }

    await registrarAcceso(
      {
        usuarioId: empleado.id,
        pacienteId: t.paciente_id,
        accion: 'dispensar',
        detalle: `${t.numero}${delegado ? ' (delegado)' : ''}`
          + (pagoRegistrado ? ` · cobro $${pagoRegistrado.valor} (${pagoRegistrado.medio})` : ''),
      },
      cliente
    );

    await cliente.query('COMMIT');
    return { turno: t.numero, pendientes, pago: pagoRegistrado, turnosAvisados };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}