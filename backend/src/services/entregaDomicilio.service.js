import { ErrorNegocio } from './formulas.service.js';
import { validarPago, registrarPago } from './cobros.service.js';
import { conAvisoDeCambios } from './inventario.service.js';
import { ZONA_HORARIA } from '../config/negocio.js';

// Flujo de inventario de un domicilio (el llamador ya bloqueó el domicilio y mantiene abierta la transacción):
// 1. Despacho (pasa a "en camino"): el stock baja de inmediato y las unidades dejan de estar pendientes en la fórmula,
//    para que no se entreguen también en ventanilla mientras van en camino.
// 2. Entrega: se confirma cuánto recibió el paciente; lo que no se entregó vuelve al inventario como devolución.
// 3. Cancelación de un pedido ya despachado: todo lo despachado vuelve al inventario.

// [{ formula_item_id, cantidad }] → enteros, sin repetidos; "minimo" es 1 al despachar y 0 al entregar
function validarItems(items, minimo) {
  if (!Array.isArray(items) || !items.length) {
    throw new ErrorNegocio('Indica los medicamentos y sus cantidades', 400);
  }
  const vistos = new Set();
  for (const it of items) {
    if (!Number.isInteger(it?.formula_item_id) || it.formula_item_id <= 0
        || !Number.isInteger(it.cantidad) || it.cantidad < minimo || vistos.has(it.formula_item_id)) {
      throw new ErrorNegocio('Las cantidades deben ser números enteros válidos, sin medicamentos repetidos', 400);
    }
    vistos.add(it.formula_item_id);
  }
}

async function bloquearFormula(cliente, formulaId) {
  const { rows: [f] } = await cliente.query(
    `SELECT id, paciente_id, codigo, cuota_moderadora,
            fecha_limite < (now() AT TIME ZONE $2)::date AS vencida,
            EXISTS (SELECT 1 FROM pagos WHERE formula_id = formulas.id) AS pagada
       FROM formulas WHERE id = $1 FOR UPDATE`,
    [formulaId, ZONA_HORARIA]
  );
  return f;
}

// Lo despachado en este domicilio, con los ítems y medicamentos bloqueados (siempre en el mismo orden)
async function bloquearDespacho(cliente, domicilioId) {
  const { rows } = await cliente.query(
    `SELECT di.formula_item_id, di.despachada, fi.medicamento_id, m.nombre
       FROM domicilio_items di
       JOIN formula_items fi ON fi.id = di.formula_item_id
       JOIN medicamentos m ON m.id = fi.medicamento_id
      WHERE di.domicilio_id = $1
      ORDER BY m.id, fi.id
        FOR UPDATE OF di, fi, m`,
    [domicilioId]
  );
  return rows;
}

// Regresa unidades despachadas al inventario y vuelven a quedar pendientes en la fórmula
async function devolverAlInventario(cliente, fila, cantidad, domicilio, empleadoId, motivo) {
  if (cantidad <= 0) return;
  await cliente.query('UPDATE medicamentos SET stock_actual = stock_actual + $2 WHERE id = $1',
    [fila.medicamento_id, cantidad]);
  await cliente.query('UPDATE formula_items SET cantidad_entregada = cantidad_entregada - $2 WHERE id = $1',
    [fila.formula_item_id, cantidad]);
  await cliente.query(
    `INSERT INTO movimientos_inventario (medicamento_id, tipo, cantidad, usuario_id, motivo)
     VALUES ($1, 'devolucion', $2, $3, $4)`,
    [fila.medicamento_id, cantidad, empleadoId, `${motivo} · domicilio ${domicilio.id}`]
  );
}

// 1. DESPACHO: sale el pedido con las cantidades indicadas
export async function despacharDomicilio(cliente, domicilio, items, empleadoId) {
  validarItems(items, 1);
  const f = await bloquearFormula(cliente, domicilio.formula_id);
  if (f.vencida) throw new ErrorNegocio('La fórmula está vencida: no se puede despachar', 409);

  const { rows: filas } = await cliente.query(
    `SELECT fi.id, fi.medicamento_id, fi.cantidad_formulada - fi.cantidad_entregada AS pendiente,
            m.nombre, m.stock_actual
       FROM formula_items fi JOIN medicamentos m ON m.id = fi.medicamento_id
      WHERE fi.formula_id = $1 ORDER BY m.id, fi.id FOR UPDATE OF fi, m`,
    [f.id]
  );
  // Lo apartado por turnos virtuales vigentes no se puede despachar
  const { rows: reservas } = await cliente.query(
    `SELECT medicamento_id, SUM(cantidad)::int AS cantidad FROM reservas
      WHERE medicamento_id = ANY($1) AND NOT liberada AND vence_en > now()
      GROUP BY medicamento_id`, [filas.map((it) => it.medicamento_id)]
  );
  const porItem = new Map(filas.map((it) => [it.id, it]));
  const libres = new Map(filas.map((it) => [it.medicamento_id, it.stock_actual]));
  for (const r of reservas) libres.set(r.medicamento_id, libres.get(r.medicamento_id) - r.cantidad);
  for (const it of items) {
    const fila = porItem.get(it.formula_item_id);
    if (!fila) throw new ErrorNegocio('Un medicamento no pertenece a esta fórmula', 400);
    if (it.cantidad > fila.pendiente) throw new ErrorNegocio(`${fila.nombre}: solo quedan ${fila.pendiente} pendientes`, 409);
    const libre = libres.get(fila.medicamento_id);
    if (it.cantidad > libre) {
      throw new ErrorNegocio(`${fila.nombre}: solo hay ${Math.max(0, libre)} disponibles para despachar`, 409);
    }
    libres.set(fila.medicamento_id, libre - it.cantidad);
  }

  const medicamentoIds = items.map((it) => porItem.get(it.formula_item_id).medicamento_id);
  const { turnosAvisados } = await conAvisoDeCambios(cliente, medicamentoIds, async () => {
    for (const it of items) {
      const fila = porItem.get(it.formula_item_id);
      await cliente.query('UPDATE medicamentos SET stock_actual = stock_actual - $2 WHERE id = $1',
        [fila.medicamento_id, it.cantidad]);
      await cliente.query('UPDATE formula_items SET cantidad_entregada = cantidad_entregada + $2 WHERE id = $1',
        [fila.id, it.cantidad]);
      await cliente.query(
        `INSERT INTO domicilio_items (domicilio_id, formula_item_id, despachada) VALUES ($1, $2, $3)`,
        [domicilio.id, fila.id, it.cantidad]);
      await cliente.query(
        `INSERT INTO movimientos_inventario (medicamento_id, tipo, cantidad, usuario_id, motivo)
         VALUES ($1, 'dispensacion', $2, $3, $4)`,
        [fila.medicamento_id, -it.cantidad, empleadoId, `Despacho domicilio ${domicilio.id} · ${f.codigo}`]);
    }
  });
  return { turnosAvisados };
}

// 2. ENTREGA: lo recibido queda como dispensación; lo que no, vuelve al inventario. Se cobra al entregar.
export async function entregarDomicilio(cliente, domicilio, items, pago, empleadoId) {
  validarItems(items, 0);
  const f = await bloquearFormula(cliente, domicilio.formula_id);
  const despacho = await bloquearDespacho(cliente, domicilio.id);
  if (!despacho.length) throw new ErrorNegocio('Este pedido no tiene un despacho registrado', 409);

  const recibidas = new Map(items.map((it) => [it.formula_item_id, it.cantidad]));
  for (const id of recibidas.keys()) {
    if (!despacho.some((d) => d.formula_item_id === id)) {
      throw new ErrorNegocio('Un medicamento no hace parte de este despacho', 400);
    }
  }
  for (const d of despacho) {
    const cantidad = recibidas.get(d.formula_item_id);
    if (cantidad === undefined) throw new ErrorNegocio('Indica cuántas unidades se entregaron de cada medicamento', 400);
    if (cantidad > d.despachada) throw new ErrorNegocio(`${d.nombre}: solo se despacharon ${d.despachada}`, 409);
  }
  if (despacho.every((d) => recibidas.get(d.formula_item_id) === 0)) {
    throw new ErrorNegocio('No se entregó nada: cancela el pedido para devolver los medicamentos al inventario', 409);
  }

  // Cobro: la cuota una sola vez por fórmula (puede haberse pagado en ventanilla o en otro domicilio) + el envío
  const cuota = f.pagada ? 0 : f.cuota_moderadora;
  const envio = domicilio.costo_envio;
  const total = cuota + envio;
  if (total > 0) validarPago(pago, total);
  if (cuota > 0) {
    await registrarPago(cliente, {
      formulaId: f.id, domicilioId: domicilio.id, valor: cuota,
      pago: { ...pago, recibido: pago.medio === 'efectivo' ? pago.recibido - envio : undefined },
      empleado: { id: empleadoId },
    });
  }
  await cliente.query(
    `INSERT INTO cobros_domicilio (domicilio_id, cuota, envio, medio, recibido, referencia, usuario_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [domicilio.id, cuota, envio, total ? pago.medio : null,
      total && pago.medio === 'efectivo' ? pago.recibido : null,
      total && pago.medio !== 'efectivo' ? pago.referencia.trim() : null, empleadoId]
  );

  const { turnosAvisados } = await conAvisoDeCambios(cliente, despacho.map((d) => d.medicamento_id), async () => {
    for (const d of despacho) {
      const entregada = recibidas.get(d.formula_item_id);
      await cliente.query(
        'UPDATE domicilio_items SET entregada = $3 WHERE domicilio_id = $1 AND formula_item_id = $2',
        [domicilio.id, d.formula_item_id, entregada]);
      if (entregada > 0) {
        await cliente.query(
          `INSERT INTO dispensaciones (domicilio_id, formula_item_id, cantidad, usuario_id) VALUES ($1,$2,$3,$4)`,
          [domicilio.id, d.formula_item_id, entregada, empleadoId]);
      }
      await devolverAlInventario(cliente, d, d.despachada - entregada, domicilio, empleadoId, 'No entregado al paciente');
    }
  });

  const entregados = despacho.filter((d) => recibidas.get(d.formula_item_id) > 0);
  await cliente.query(
    `INSERT INTO notificaciones (paciente_id, tipo, mensaje) VALUES ($1,'entrega',$2)`,
    [f.paciente_id, `Entrega a domicilio de tu fórmula ${f.codigo}: `
      + entregados.map((d) => `${d.nombre} (${recibidas.get(d.formula_item_id)})`).join(', ')]);
  return { turnosAvisados };
}

// 3. CANCELACIÓN después del despacho: todo lo despachado vuelve al inventario
export async function devolverDespacho(cliente, domicilio, empleadoId) {
  const despacho = await bloquearDespacho(cliente, domicilio.id);
  if (!despacho.length) return { turnosAvisados: [] };
  const { turnosAvisados } = await conAvisoDeCambios(cliente, despacho.map((d) => d.medicamento_id), async () => {
    for (const d of despacho) {
      await cliente.query(
        'UPDATE domicilio_items SET entregada = 0 WHERE domicilio_id = $1 AND formula_item_id = $2',
        [domicilio.id, d.formula_item_id]);
      await devolverAlInventario(cliente, d, d.despachada, domicilio, empleadoId, 'Pedido cancelado');
    }
  });
  return { turnosAvisados };
}
