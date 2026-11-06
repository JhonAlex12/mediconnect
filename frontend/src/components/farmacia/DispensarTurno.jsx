import React, { useCallback, useState } from 'react';
import { ClipboardCheck, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useEventoEnVivo } from '../../lib/tiempoReal';
import {
  Aviso, Boton, Campo, Cargando, Casilla, Cuerpo, Encabezado, Entrada, EstadoBadge, Fila, Tabla, Td, Th,
} from '../ui';

// "2026-11-30" → "30 de noviembre de 2026" (sin pasar por zonas horarias)
const fechaLarga = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Entrega de los medicamentos de un turno en ventanilla (CU-07)
export default function DispensarTurno({ turno, ocupado, ejecutar, alCerrar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cantidades, setCantidades] = useState({}); // formula_item_id → texto del campo
  const [conDelegado, setConDelegado] = useState(false);
  const [delegado, setDelegado] = useState({ nombre: '', documento: '' });

  const cargar = useCallback(async () => {
    try {
      const d = await api(`/dispensacion/${turno.id}`);
      setDatos(d);
      setError(null);
      // Por defecto se propone entregar todo lo posible; si el stock cambió,
      // se respeta lo que el empleado escribió pero sin pasar del nuevo máximo
      setCantidades((previas) => {
        const nuevas = {};
        for (const m of d.medicamentos) {
          const previa = previas[m.formula_item_id];
          nuevas[m.formula_item_id] =
            previa === undefined ? String(m.maximo_entregable) : String(Math.min(Number(previa) || 0, m.maximo_entregable));
        }
        return nuevas;
      });
    } catch (err) {
      setError(err.message);
    }
  }, [turno.id]);

  // Si otro empleado mueve el inventario, los máximos se recalculan
  useEventoEnVivo('inventario_actualizado', cargar);

  if (error) {
    return (
      <Marco turno={turno} alCerrar={alCerrar}>
        <Aviso tono="error">{error}</Aviso>
      </Marco>
    );
  }
  if (!datos) {
    return (
      <Marco turno={turno} alCerrar={alCerrar}>
        <Cargando texto="Cargando la fórmula…" />
      </Marco>
    );
  }

  const items = datos.medicamentos
    .map((m) => ({ formula_item_id: m.formula_item_id, cantidad: Number(cantidades[m.formula_item_id]) }))
    .filter((it) => Number.isInteger(it.cantidad) && it.cantidad > 0);
  const invalidas = datos.medicamentos.some((m) => {
    const n = Number(cantidades[m.formula_item_id]);
    return cantidades[m.formula_item_id] !== '' && (!Number.isInteger(n) || n < 0 || n > m.maximo_entregable);
  });
  const delegadoValido =
    !conDelegado || (delegado.nombre.trim().length >= 3 && /^\d{5,20}$/.test(delegado.documento.trim()));
  const nadaEntregable = datos.medicamentos.every((m) => m.maximo_entregable === 0);
  const totalPendiente = datos.medicamentos.reduce((s, m) => s + m.pendiente, 0);
  const totalEntrega = items.reduce((s, it) => s + it.cantidad, 0);
  const parcial = totalEntrega < totalPendiente;

  const enviar = async (e) => {
    e.preventDefault();
    const cuerpo = {
      items,
      delegado: conDelegado ? { nombre: delegado.nombre.trim(), documento: delegado.documento.trim() } : undefined,
    };
    const ok = await ejecutar(
      () => api(`/dispensacion/${turno.id}`, { metodo: 'POST', cuerpo }),
      (r) =>
        r.pendientes.length === 0
          ? `Turno ${r.turno}: entrega completa`
          : `Turno ${r.turno}: entrega parcial. Pendiente: ${r.pendientes.map((p) => `${p.nombre} (${p.cantidad})`).join(', ')}`
    );
    if (ok) alCerrar();
  };

  const t = datos.turno;

  return (
    <Marco turno={turno} alCerrar={alCerrar}>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
        {[
          ['Paciente', t.paciente ?? 'Sin nombre'],
          ['Documento', t.documento ?? '—'],
          ['Fórmula', t.formula],
          ['Reclamar hasta', fechaLarga(t.fecha_limite)],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-tinta-suave">{etiqueta}</dt>
            <dd className="font-bold text-tinta cifras">{valor}</dd>
          </div>
        ))}
      </dl>

      {!datos.puede_dispensar && (
        <Aviso tono="error">Este turno ya no se puede dispensar (estado: {t.estado}).</Aviso>
      )}

      <form onSubmit={enviar} className="space-y-4">
        <div className="border border-borde rounded-md">
          <Tabla etiqueta="Medicamentos de la fórmula">
            <Encabezado>
              <Th>Medicamento</Th>
              <Th numero>Formulado</Th>
              <Th numero>Entregado</Th>
              <Th numero>Pendiente</Th>
              <Th numero title="Lo pendiente, sin tocar lo apartado para otros turnos">Se puede entregar</Th>
              <Th className="w-32">Entregar</Th>
            </Encabezado>
            <Cuerpo>
              {datos.medicamentos.map((m) => {
                const id = `disp-${m.formula_item_id}`;
                const sinStock = m.pendiente > 0 && m.maximo_entregable === 0;
                const completo = m.pendiente === 0;
                return (
                  <Fila key={m.formula_item_id} tenue={completo}>
                    <Td>
                      <label htmlFor={id} className={`font-bold ${completo ? '' : 'text-tinta'}`}>{m.nombre}</label>
                      <span className="block text-xs text-tinta-tenue">{m.presentacion}</span>
                    </Td>
                    <Td numero>{m.cantidad_formulada}</Td>
                    <Td numero>{m.cantidad_entregada}</Td>
                    <Td numero className="font-bold">{m.pendiente}</Td>
                    <Td numero>
                      {sinStock ? <EstadoBadge tono="error">Sin stock</EstadoBadge> : m.maximo_entregable}
                    </Td>
                    <Td>
                      {completo ? (
                        <EstadoBadge tono="ok">Entregado</EstadoBadge>
                      ) : (
                        <Entrada
                          id={id}
                          type="number"
                          min={0}
                          max={m.maximo_entregable}
                          step={1}
                          disabled={m.maximo_entregable === 0}
                          value={cantidades[m.formula_item_id] ?? ''}
                          onChange={(e) => setCantidades((c) => ({ ...c, [m.formula_item_id]: e.target.value }))}
                          className="h-9 text-right cifras"
                        />
                      )}
                    </Td>
                  </Fila>
                );
              })}
            </Cuerpo>
          </Tabla>
        </div>

        {/* Recoge otra persona (RN-16) */}
        <div className="space-y-3">
          <Casilla checked={conDelegado} onChange={(e) => setConDelegado(e.target.checked)}>
            Recoge otra persona
          </Casilla>
          {conDelegado && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Campo id="del-nombre" etiqueta="Nombre de quien recoge">
                <Entrada value={delegado.nombre} required minLength={3}
                  onChange={(e) => setDelegado((d) => ({ ...d, nombre: e.target.value }))} />
              </Campo>
              <Campo id="del-documento" etiqueta="Documento" ayuda="Solo números, entre 5 y 20 dígitos">
                <Entrada value={delegado.documento} required inputMode="numeric" pattern="\d{5,20}"
                  onChange={(e) => setDelegado((d) => ({ ...d, documento: e.target.value }))} className="cifras" />
              </Campo>
            </div>
          )}
        </div>

        {nadaEntregable ? (
          <Aviso tono="alerta">
            No hay nada que entregar ahora. Si el paciente se va sin medicamentos, cierra este panel y márcalo como atendido.
          </Aviso>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap border-t border-borde pt-4">
            <p className="text-sm text-tinta-suave">
              {items.length === 0
                ? 'Indica al menos un medicamento a entregar.'
                : parcial
                  ? <>Entrega parcial: <strong className="text-tinta cifras">{totalEntrega} de {totalPendiente}</strong> unidades. Lo demás queda pendiente hasta el {fechaLarga(t.fecha_limite)}.</>
                  : <>Entrega completa: <strong className="text-tinta cifras">{totalEntrega}</strong> unidades.</>}
            </p>
            <Boton
              type="submit"
              variante="primario"
              icono={ClipboardCheck}
              disabled={ocupado || !datos.puede_dispensar || items.length === 0 || invalidas || !delegadoValido}
            >
              Entregar y cerrar turno
            </Boton>
          </div>
        )}
      </form>
    </Marco>
  );
}

function Marco({ turno, alCerrar, children }) {
  return (
    <div className="border-t border-borde pt-4 mt-2 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-tinta">Dispensar turno <span className="cifras">{turno.numero}</span></h3>
        <Boton variante="fantasma" tamano="sm" icono={X} onClick={alCerrar}>
          Cerrar
        </Boton>
      </div>
      {children}
    </div>
  );
}
