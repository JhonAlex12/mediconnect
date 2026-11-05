import { emitir } from '../sockets/emisor.js';
import { estadoPantalla } from './pantalla.service.js';
import { obtenerMiTurno } from './turnos.service.js';

// Se llama después de cada cambio en la fila. Si falla, no rompe la operación:
// el cambio ya quedó guardado y los clientes se ponen al día en la siguiente señal.
export async function publicarCambios(turnoIds = []) {
  try {
    emitir('farmacia', 'fila_actualizada', {});
    emitir('pantalla', 'turno_actual', await estadoPantalla());

    for (const id of new Set(turnoIds)) {
      emitir(`turno:${id}`, 'turno_actualizado', await obtenerMiTurno(id));
      emitir(`turno:${id}`, 'notificaciones_actualizadas', {});
    }
  } catch (error) {
    console.error('Error al publicar en tiempo real:', error.message);
  }
}

// Avisa al panel que el inventario cambió (el panel vuelve a pedirlo con su sesión)
export function publicarInventario() {
  emitir('farmacia', 'inventario_actualizado', {});
}