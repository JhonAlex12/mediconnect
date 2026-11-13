import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { calcularEstado } from './disponibilidad.service.js';
import { registrarAcceso } from './auditoria.service.js';
import { ESTADOS_ACTIVOS } from '../config/negocio.js';

// Mensaje para el paciente según el nuevo estado del medicamento
const MENSAJES = {
  agotado: (n) => `${n} se agotó. Te avisaremos cuando haya disponibilidad.`,
  pocas_unidades: (n) => `${n}: quedan pocas unidades, puede que no alcance.`,
  disponible: (n) => `${n}: ya hay disponibilidad.`,
};

// Estado de cada medicamento para cada paciente con turno activo que lo tenga formulado
async function estadosPorTurno(cliente, medicamentoIds) {
  const { rows } = await cliente.query(
    `SELECT t.id AS turno_id, t.paciente_id, m.id AS medicamento_id, m.nombre,
            m.stock_actual, m.stock_minimo,
            (fi.cantidad_formulada - fi.cantidad_entregada) AS pendiente,
            COALESCE((
              SELECT SUM(r.cantidad) FROM reservas r
               WHERE r.medicamento_id = m.id AND r.liberada = FALSE
                 AND r.vence_en > now() AND r.turno_id <> t.id
            ), 0)::int AS reservado_otros
       FROM turnos t
       JOIN formula_items fi ON fi.formula_id = t.formula_id
       JOIN medicamentos m ON m.id = fi.medicamento_id
      WHERE m.id = ANY($1) AND t.estado = ANY($2) AND t.paciente_id IS NOT NULL`,
    [medicamentoIds, ESTADOS_ACTIVOS]
  );

  const mapa = new Map();
  for (const r of rows) {
    mapa.set(`${r.turno_id}:${r.medicamento_id}`, {
      turnoId: r.turno_id,
      pacienteId: r.paciente_id,
      nombre: r.nombre,
      estado: calcularEstado({
        pendiente: r.pendiente,
        stockActual: r.stock_actual,
        reservadoOtros: r.reservado_otros,
      }),
    });
  }
  return mapa;
}

// Ejecuta un cambio de stock y avisa, una sola vez, a cada paciente
// cuyo medicamento cambió de estado (CU-06 paso 5, RN-14)
export async function conAvisoDeCambios(cliente, medicamentoIds, cambio) {
  const antes = await estadosPorTurno(cliente, medicamentoIds);
  const resultado = await cambio();
  const despues = await estadosPorTurno(cliente, medicamentoIds);

  const turnosAvisados = new Set();
  for (const [clave, ahora] of despues) {
    const previo = antes.get(clave);
    if (!previo || previo.estado === ahora.estado || !MENSAJES[ahora.estado]) continue;
    await cliente.query(
      `INSERT INTO notificaciones (paciente_id, tipo, mensaje) VALUES ($1, 'cambio_stock', $2)`,
      [ahora.pacienteId, MENSAJES[ahora.estado](ahora.nombre)]
    );
    turnosAvisados.add(ahora.turnoId);
  }
  return { resultado, turnosAvisados: [...turnosAvisados] };
}

// ============================================================
// VER INVENTARIO CON ALERTAS (RF-16, RF-17)
// ============================================================
export async function verInventario() {
  const { rows } = await pool.query(
    `SELECT m.id, m.nombre, m.presentacion, m.stock_actual, m.stock_minimo,
            COALESCE(SUM(r.cantidad) FILTER (WHERE r.liberada = FALSE AND r.vence_en > now()), 0)::int
              AS reservado
       FROM medicamentos m
       LEFT JOIN reservas r ON r.medicamento_id = m.id
      WHERE m.activo = TRUE
      GROUP BY m.id
      ORDER BY m.nombre`
  );

  const medicamentos = rows.map((m) => ({
    ...m,
    disponible: Math.max(0, m.stock_actual - m.reservado),
    estado: m.stock_actual === 0 ? 'agotado' : m.stock_actual < m.stock_minimo ? 'stock_bajo' : 'normal',
  }));

  const alertas = medicamentos
    .filter((m) => m.estado !== 'normal')
    .map((m) => (m.estado === 'agotado'
      ? `${m.nombre} ${m.presentacion}: agotado`
      : `${m.nombre} ${m.presentacion}: bajo el mínimo (${m.stock_actual} de ${m.stock_minimo})`));

  return { medicamentos, alertas, modo_demo: process.env.MODO_DEMO === 'true' };
}

// ============================================================
// CREAR MEDICAMENTO EN EL CATÁLOGO
// ============================================================
export async function crearMedicamento(datos, empleado) {
  const { nombre, presentacion, stock_minimo = 0, stock_inicial = 0 } = datos ?? {};
  const errores = [];
  if (typeof nombre !== 'string' || nombre.trim().length < 2) errores.push('nombre: obligatorio');
  if (typeof presentacion !== 'string' || presentacion.trim().length < 2) errores.push('presentacion: obligatoria');
  if (!Number.isInteger(stock_minimo) || stock_minimo < 0) errores.push('stock_minimo: entero mayor o igual a 0');
  if (!Number.isInteger(stock_inicial) || stock_inicial < 0) errores.push('stock_inicial: entero mayor o igual a 0');
  if (errores.length > 0) throw new ErrorNegocio('Datos inválidos', 400, errores);

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [m] } = await cliente.query(
      `INSERT INTO medicamentos (nombre, presentacion, stock_actual, stock_minimo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, presentacion, stock_actual, stock_minimo`,
      [nombre.trim(), presentacion.trim(), stock_inicial, stock_minimo]
    );
    if (stock_inicial > 0) {
      await cliente.query(
        `INSERT INTO movimientos_inventario (medicamento_id, tipo, cantidad, usuario_id, motivo)
         VALUES ($1, 'entrada', $2, $3, 'Stock inicial')`,
        [m.id, stock_inicial, empleado.id]
      );
    }
    await registrarAcceso({ usuarioId: empleado.id, accion: 'crear_medicamento', detalle: m.nombre }, cliente);
    await cliente.query('COMMIT');
    return m;
  } catch (error) {
    await cliente.query('ROLLBACK');
    if (error.code === '23505') {
      throw new ErrorNegocio('Ya existe ese medicamento con esa presentación', 409);
    }
    throw error;
  } finally {
    cliente.release();
  }
}

// ============================================================
// CAMBIAR EL STOCK MÍNIMO (solo administrador)
// Es el punto de reposición: por debajo de él el medicamento sale como "Stock bajo"
// en el inventario. No bloquea entregas ni cambia lo que ve el paciente.
// ============================================================
export async function cambiarMinimo(medicamentoId, { stock_minimo } = {}, empleado) {
  if (!Number.isInteger(stock_minimo) || stock_minimo < 0 || stock_minimo > 1000000) {
    throw new ErrorNegocio('stock_minimo: número entero mayor o igual a 0', 400);
  }
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [m] } = await cliente.query(
      `SELECT id, nombre, presentacion, stock_minimo FROM medicamentos WHERE id = $1 AND activo = TRUE FOR UPDATE`,
      [medicamentoId]
    );
    if (!m) throw new ErrorNegocio('Medicamento no encontrado', 404);
    if (m.stock_minimo === stock_minimo) throw new ErrorNegocio('El mínimo ya tiene ese valor', 400);

    await cliente.query(`UPDATE medicamentos SET stock_minimo = $2 WHERE id = $1`, [m.id, stock_minimo]);
    await registrarAcceso({
      usuarioId: empleado.id,
      accion: 'cambiar_stock_minimo',
      detalle: `${m.nombre} ${m.presentacion}: ${m.stock_minimo} → ${stock_minimo}`,
    }, cliente);
    await cliente.query('COMMIT');
    return { id: m.id, nombre: m.nombre, minimo_anterior: m.stock_minimo, stock_minimo };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// ============================================================
// MOVIMIENTOS: entrada, salida y ajuste (RF-16)
//   entrada → suma la cantidad
//   salida  → resta la cantidad
//   ajuste  → deja el stock exactamente en la cantidad (conteo físico)
// ============================================================
export async function registrarMovimiento(medicamentoId, { tipo, cantidad, motivo }, empleado) {
  if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
    throw new ErrorNegocio('tipo: debe ser entrada, salida o ajuste', 400);
  }
  const minimo = tipo === 'ajuste' ? 0 : 1;
  if (!Number.isInteger(cantidad) || cantidad < minimo) {
    throw new ErrorNegocio(`cantidad: entero mayor o igual a ${minimo}`, 400);
  }
  if (tipo !== 'entrada' && (typeof motivo !== 'string' || motivo.trim().length < 3)) {
    throw new ErrorNegocio('motivo: obligatorio para salidas y ajustes', 400);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { rows: [m] } = await cliente.query(
      `SELECT id, nombre, stock_actual FROM medicamentos WHERE id = $1 AND activo = TRUE FOR UPDATE`,
      [medicamentoId]
    );
    if (!m) throw new ErrorNegocio('Medicamento no encontrado', 404);

    const nuevo = tipo === 'entrada' ? m.stock_actual + cantidad
                : tipo === 'salida'  ? m.stock_actual - cantidad
                : cantidad;
    if (nuevo < 0) {
      throw new ErrorNegocio(`No hay suficiente stock: hay ${m.stock_actual}`, 409);
    }
    const diferencia = nuevo - m.stock_actual;
    if (diferencia === 0) throw new ErrorNegocio('El stock ya tiene ese valor', 400);

    const { turnosAvisados } = await conAvisoDeCambios(cliente, [m.id], async () => {
      await cliente.query(`UPDATE medicamentos SET stock_actual = $2 WHERE id = $1`, [m.id, nuevo]);
      // La cantidad se guarda con signo: positiva si entra, negativa si sale
      await cliente.query(
        `INSERT INTO movimientos_inventario (medicamento_id, tipo, cantidad, usuario_id, motivo)
         VALUES ($1, $2, $3, $4, $5)`,
        [m.id, tipo, diferencia, empleado.id, motivo?.trim() || null]
      );
    });

    await registrarAcceso(
      { usuarioId: empleado.id, accion: 'movimiento_inventario', detalle: `${tipo} ${diferencia} ${m.nombre}` },
      cliente
    );

    await cliente.query('COMMIT');
    return {
      medicamento: { id: m.id, nombre: m.nombre, stock_anterior: m.stock_actual, stock_actual: nuevo },
      turnosAvisados,
    };
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// ============================================================
// BOTONES DE DEMOSTRACIÓN (RF-18): solo con MODO_DEMO=true
// ============================================================
export async function accionDemo(medicamentoId, accion, empleado) {
  if (process.env.MODO_DEMO !== 'true') {
    throw new ErrorNegocio('Función no disponible', 404);
  }

  const { rows: [m] } = await pool.query(
    `SELECT stock_actual, stock_minimo FROM medicamentos WHERE id = $1`,
    [medicamentoId]
  );
  if (!m) throw new ErrorNegocio('Medicamento no encontrado', 404);

  const movimientos = {
    reducir: { tipo: 'salida', cantidad: Math.floor(m.stock_actual / 2) },
    vaciar:  { tipo: 'ajuste', cantidad: 0 },
    reponer: { tipo: 'entrada', cantidad: Math.max(m.stock_minimo * 2, 10) },
  };
  const mov = movimientos[accion];
  if (!mov) throw new ErrorNegocio('Acción de demostración no válida', 400);

  return registrarMovimiento(medicamentoId, { ...mov, motivo: `Demostración: ${accion}` }, empleado);
}