import { emitir } from '../sockets/emisor.js';
import { pool } from '../db/pool.js';
import { estadoPantalla } from './pantalla.service.js';
import { obtenerMiTurno } from './turnos.service.js';

// Se llama después de cada cambio en la fila. Si falla, no rompe la operación:
// el cambio ya quedó guardado y los clientes se ponen al día en la siguiente señal.
export async function publicarCambios(turnoIds = []) {
  try {
    await emitir('farmacia', 'fila_actualizada', {});
    await emitir('pantalla', 'turno_actual', await estadoPantalla());   // con nombre: solo empleados autorizados
    emitir('fila_publica', 'turno_actual', {});                    // aviso sin datos para pacientes

    for (const id of new Set(turnoIds)) {
      emitir(`turno:${id}`, 'turno_actualizado', await obtenerMiTurno(id));
      emitir(`turno:${id}`, 'notificaciones_actualizadas', {});
    }
  } catch (error) {
    console.error('Error al publicar en tiempo real:', error.message);
  }
}

// Un pedido a domicilio cambió: el panel de pedidos y el paciente dueño vuelven a pedir su lista
// con su propia sesión (el aviso no lleva datos)
export function publicarDomicilio(cuentaId) {
  emitir('domicilios', 'domicilios_actualizados', {});
  if (cuentaId) emitir(`cuenta:${cuentaId}`, 'domicilios_actualizados', {});
}

// Cambió quién está en ruta (despacho, entrega, cancelación o cambio de domiciliario): los pacientes
// con pedidos por salir actualizan el aviso "sale cuando regrese un domiciliario"
export async function publicarEsperaDomiciliario() {
  try {
    const { rows } = await pool.query(`SELECT DISTINCT cuenta_id FROM domicilios WHERE estado = 'en_preparacion'`);
    for (const r of rows) emitir(`cuenta:${r.cuenta_id}`, 'domicilios_actualizados', {});
  } catch (error) {
    console.error('Error al avisar la espera de domiciliario:', error.message);
  }
}

// El médico emitió una fórmula para pacientes con cuenta: "Mis fórmulas" se recarga sola
export function publicarFormulaNueva(cuentaIds = []) {
  for (const id of cuentaIds) emitir(`cuenta:${id}`, 'formulas_actualizadas', {});
}

// Avisa al panel que el inventario cambió (el panel vuelve a pedirlo con su sesión)
export function publicarInventario() {
  return emitir('farmacia', 'inventario_actualizado', {})
    .catch((error) => console.error('Error al publicar inventario:', error.message));
}
