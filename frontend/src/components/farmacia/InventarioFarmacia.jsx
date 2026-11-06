import React, { useCallback, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, FlaskConical, Package, PackagePlus, Scale, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useEventoEnVivo } from '../../lib/tiempoReal';
import { Aviso, BotonAccion, IndicadorEnVivo, useAccion } from './comunes';
import {
  Aviso as AvisoBase, Boton, Campo, Cargando, Casilla, Cuerpo, Encabezado, Entrada, EstadoBadge, EstadoVacio,
  Fila, Panel, Segmentado, Tabla, Td, Th, TituloPantalla,
} from '../ui';

// Estado del medicamento → tono con significado (ok = disponible, alerta = stock bajo, error = sin stock)
const ESTADOS = {
  normal: { texto: 'Disponible', tono: 'ok' },
  stock_bajo: { texto: 'Stock bajo', tono: 'alerta' },
  agotado: { texto: 'Agotado', tono: 'error' },
};

const TIPOS_MOVIMIENTO = {
  entrada: { texto: 'Entrada', icono: ArrowDownToLine, ayuda: 'Unidades que llegan (se suman al stock).' },
  salida: { texto: 'Salida', icono: ArrowUpFromLine, ayuda: 'Unidades que salen por vencimiento, daño, etc.' },
  ajuste: { texto: 'Ajuste', icono: Scale, ayuda: 'Conteo físico: el stock queda exactamente en esta cantidad.' },
};

// Texto del aviso tras un movimiento, con los pacientes avisados si los hubo
const textoMovimiento = (r) => {
  const { nombre, stock_anterior, stock_actual } = r.medicamento;
  const avisados = r.turnosAvisados?.length ?? 0;
  return `${nombre}: stock ${stock_anterior} → ${stock_actual}` +
    (avisados > 0 ? `. Se avisó a ${avisados} paciente${avisados > 1 ? 's' : ''} con turno.` : '');
};

export default function InventarioFarmacia() {
  const [datos, setDatos] = useState({ medicamentos: [], alertas: [], modo_demo: false });
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null); // id del medicamento con el formulario abierto
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api('/inventario'));
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }, []);

  const { ocupado, aviso, setAviso, ejecutar } = useAccion(cargar);

  // Tiempo real: dispensaciones y movimientos de otros empleados actualizan la tabla
  useEventoEnVivo('inventario_actualizado', cargar);

  const texto = busqueda.trim().toLowerCase();
  const visibles = datos.medicamentos.filter(
    (m) =>
      (!soloAlertas || m.estado !== 'normal') &&
      (!texto || `${m.nombre} ${m.presentacion}`.toLowerCase().includes(texto))
  );
  const medicamentoAbierto = datos.medicamentos.find((m) => m.id === seleccionado);

  const demo = (m, accion, texto) =>
    ejecutar(() => api(`/inventario/${m.id}/demo/${accion}`, { metodo: 'POST' }), (r) => `${texto} · ${textoMovimiento(r)}`);

  return (
    <div>
      <TituloPantalla
        titulo="Inventario"
        descripcion={`${datos.medicamentos.length} medicamentos activos`}
        acciones={
          <>
            <IndicadorEnVivo />
            <Boton variante="primario" icono={PackagePlus} onClick={() => setCreando((v) => !v)} aria-expanded={creando}>
              Nuevo medicamento
            </Boton>
          </>
        }
      />

      <div className="space-y-5">
        <Aviso aviso={aviso} />

        {/* Alertas de stock (RF-17) */}
        {datos.alertas.length > 0 && (
          <AvisoBase tono="alerta" titulo={`${datos.alertas.length} ${datos.alertas.length === 1 ? 'alerta' : 'alertas'} de stock`}>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {datos.alertas.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </AvisoBase>
        )}

        {creando && (
          <NuevoMedicamento
            ocupado={ocupado}
            ejecutar={ejecutar}
            alCerrar={() => setCreando(false)}
          />
        )}

        {medicamentoAbierto && (
          <RegistrarMovimiento
            key={medicamentoAbierto.id}
            medicamento={medicamentoAbierto}
            ocupado={ocupado}
            ejecutar={ejecutar}
            alCerrar={() => setSeleccionado(null)}
          />
        )}

        <Panel sinRelleno>
          <div className="px-4 py-3 border-b border-borde flex items-end gap-4 flex-wrap">
            <Campo id="inv-buscar" etiqueta="Buscar medicamento" className="flex-1 min-w-52 max-w-md">
              <Entrada type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o presentación" />
            </Campo>
            <Casilla checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} className="h-10">
              Solo con alertas
            </Casilla>
          </div>

          {cargando ? (
            <Cargando texto="Cargando el inventario…" />
          ) : visibles.length === 0 ? (
            datos.medicamentos.length === 0 ? (
              <EstadoVacio titulo="No hay medicamentos registrados">Agrega el primero con “Nuevo medicamento”.</EstadoVacio>
            ) : (
              <EstadoVacio titulo="Ningún medicamento coincide">Prueba con otro nombre o quita el filtro de alertas.</EstadoVacio>
            )
          ) : (
            <Tabla etiqueta="Inventario de medicamentos">
              <Encabezado>
                <Th>Medicamento</Th>
                <Th numero>Stock</Th>
                <Th numero title="Apartado para turnos activos">Reservado</Th>
                <Th numero>Disponible</Th>
                <Th numero>Mínimo</Th>
                <Th>Estado</Th>
                <Th oculto>Acciones</Th>
              </Encabezado>
              <Cuerpo>
                {visibles.map((m) => {
                  const estado = ESTADOS[m.estado] ?? ESTADOS.normal;
                  return (
                    <Fila key={m.id} resaltada={seleccionado === m.id}>
                      <Td>
                        <span className="font-bold text-tinta">{m.nombre}</span>
                        <span className="block text-xs text-tinta-tenue">{m.presentacion}</span>
                      </Td>
                      <Td numero className="font-bold text-tinta">{m.stock_actual}</Td>
                      <Td numero className="text-tinta-suave">{m.reservado}</Td>
                      <Td numero>{m.disponible}</Td>
                      <Td numero className="text-tinta-suave">{m.stock_minimo}</Td>
                      <Td><EstadoBadge tono={estado.tono}>{estado.texto}</EstadoBadge></Td>
                      <Td>
                        <div className="flex gap-2 justify-end flex-wrap">
                          <BotonAccion color="gris" icono={Package} ocupado={ocupado}
                            onClick={() => setSeleccionado(seleccionado === m.id ? null : m.id)}>
                            Movimiento
                          </BotonAccion>
                          {datos.modo_demo && (
                            <MenuDemo m={m} ocupado={ocupado} demo={demo} />
                          )}
                        </div>
                      </Td>
                    </Fila>
                  );
                })}
              </Cuerpo>
            </Tabla>
          )}
        </Panel>
      </div>
    </div>
  );
}

// Botones de demostración (RF-18): solo aparecen si el backend corre con MODO_DEMO=true
function MenuDemo({ m, ocupado, demo }) {
  return (
    <div className="inline-flex items-center rounded-md border border-dashed border-borde-campo" title="Solo para demostraciones">
      <span className="flex items-center gap-1 pl-2 pr-1 text-xs text-tinta-tenue">
        <FlaskConical size={14} aria-hidden="true" />
        Demo
      </span>
      {[
        ['reducir', 'Reducir', 'Stock reducido a la mitad', m.stock_actual < 2],
        ['vaciar', 'Vaciar', 'Medicamento agotado', m.stock_actual === 0],
        ['reponer', 'Reponer', 'Stock repuesto', false],
      ].map(([accion, texto, exito, deshabilitado]) => (
        <button
          key={accion}
          type="button"
          disabled={ocupado || deshabilitado}
          onClick={() => demo(m, accion, exito)}
          className="h-8 px-2 text-xs font-bold text-primario-700 hover:bg-primario-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

// Entrada, salida o ajuste de un medicamento (RF-16)
function RegistrarMovimiento({ medicamento: m, ocupado, ejecutar, alCerrar }) {
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');

  const n = Number(cantidad);
  const valida = cantidad !== '' && Number.isInteger(n) && n >= (tipo === 'ajuste' ? 0 : 1);
  const resultante = !valida ? null : tipo === 'entrada' ? m.stock_actual + n : tipo === 'salida' ? m.stock_actual - n : n;

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api(`/inventario/${m.id}/movimiento`, {
        metodo: 'POST',
        cuerpo: { tipo, cantidad: n, motivo: motivo.trim() || undefined },
      }),
      textoMovimiento
    );
    if (ok) alCerrar();
  };

  return (
    <Panel
      titulo={<>Movimiento: {m.nombre} <span className="font-normal text-tinta-suave">{m.presentacion}</span></>}
      acciones={<Boton variante="fantasma" tamano="sm" icono={X} onClick={alCerrar}>Cerrar</Boton>}
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[auto_10rem_1fr_auto] md:items-end">
          <div>
            <span className="block text-sm font-bold text-tinta mb-1">Tipo</span>
            <Segmentado
              etiqueta="Tipo de movimiento"
              valor={tipo}
              onChange={setTipo}
              opciones={Object.entries(TIPOS_MOVIMIENTO).map(([valor, { texto, icono }]) => ({ valor, texto, icono }))}
            />
          </div>
          <Campo id="mov-cantidad" etiqueta={tipo === 'ajuste' ? 'Stock contado' : 'Cantidad'}>
            <Entrada type="number" min={tipo === 'ajuste' ? 0 : 1} step={1} required
              value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="text-right cifras" />
          </Campo>
          <Campo id="mov-motivo" etiqueta="Motivo" opcional={tipo === 'entrada'}>
            <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)}
              required={tipo !== 'entrada'} minLength={tipo !== 'entrada' ? 3 : undefined}
              placeholder={tipo === 'entrada' ? 'Pedido del proveedor' : tipo === 'salida' ? 'Vencido, dañado…' : 'Conteo físico'} />
          </Campo>
          <Boton type="submit" variante="primario" disabled={ocupado || !valida}>
            Registrar
          </Boton>
        </div>
        {resultante !== null && resultante < 0 ? (
          <Aviso aviso={{ tipo: 'error', texto: `No alcanza: solo hay ${m.stock_actual} unidades.` }} />
        ) : (
          <p className="text-sm text-tinta-suave">
            {TIPOS_MOVIMIENTO[tipo].ayuda} Stock actual: <strong className="text-tinta cifras">{m.stock_actual}</strong>
            {resultante !== null && <> · Quedará en <strong className="text-tinta cifras">{resultante}</strong>.</>}
          </p>
        )}
      </form>
    </Panel>
  );
}

function NuevoMedicamento({ ocupado, ejecutar, alCerrar }) {
  const [nombre, setNombre] = useState('');
  const [presentacion, setPresentacion] = useState('');
  const [minimo, setMinimo] = useState('0');
  const [inicial, setInicial] = useState('0');

  const enviar = async (e) => {
    e.preventDefault();
    const ok = await ejecutar(
      () => api('/inventario', {
        metodo: 'POST',
        cuerpo: {
          nombre,
          presentacion,
          stock_minimo: Number(minimo),
          stock_inicial: Number(inicial),
        },
      }),
      (r) => `${r.medicamento.nombre} ${r.medicamento.presentacion} agregado al inventario`
    );
    if (ok) alCerrar();
  };

  return (
    <Panel
      titulo="Nuevo medicamento"
      acciones={<Boton variante="fantasma" tamano="sm" icono={X} onClick={alCerrar}>Cerrar</Boton>}
    >
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_8rem_8rem_auto] lg:items-end">
        <Campo id="nm-nombre" etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} placeholder="Losartán" />
        </Campo>
        <Campo id="nm-presentacion" etiqueta="Presentación">
          <Entrada value={presentacion} onChange={(e) => setPresentacion(e.target.value)} required minLength={2}
            placeholder="Tableta 50 mg" />
        </Campo>
        <Campo id="nm-minimo" etiqueta="Stock mínimo">
          <Entrada type="number" min={0} step={1} required value={minimo}
            onChange={(e) => setMinimo(e.target.value)} className="text-right cifras" />
        </Campo>
        <Campo id="nm-inicial" etiqueta="Stock inicial">
          <Entrada type="number" min={0} step={1} required value={inicial}
            onChange={(e) => setInicial(e.target.value)} className="text-right cifras" />
        </Campo>
        <Boton type="submit" variante="primario" disabled={ocupado}>
          Agregar
        </Boton>
      </form>
    </Panel>
  );
}
