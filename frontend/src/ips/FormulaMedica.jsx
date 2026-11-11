import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, Send, FileText, Copy, Lock } from 'lucide-react';
import { leerToken } from '../lib/api.js';

// Las rutas exigen la sesión de un administrador de la farmacia (se comparte con /farmacia)
const conSesion = (cabeceras = {}) => {
  const token = leerToken();
  return token ? { ...cabeceras, Authorization: `Bearer ${token}` } : cabeceras;
};

export default function FormulaMedica({ onIrAPaciente }) {
  // Fechas locales (toISOString usa UTC: de noche en Colombia daría el día siguiente)
  const fechaLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoyStr = fechaLocal(new Date());
  const enQuinceDiasStr = fechaLocal(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));

  const [catalogo, setCatalogo] = useState([]);
  const [siguienteCodigo, setSiguienteCodigo] = useState('F-2026-0004');
  const [formulasRecientes, setFormulasRecientes] = useState([]);

  // Campos del formulario (RF-01, Wireframe pág. 26)
  const [documento, setDocumento] = useState('1090123456');
  const [nombre, setNombre] = useState('María Fernanda Rojas');
  const [fechaEmision, setFechaEmision] = useState(hoyStr);
  const [fechaLimite, setFechaLimite] = useState(enQuinceDiasStr);
  const [items, setItems] = useState([]);

  // Afiliación del paciente: define la cuota moderadora que paga al reclamar
  const [regimen, setRegimen] = useState('contributivo');
  const [rangoIngreso, setRangoIngreso] = useState('A');
  const [eps, setEps] = useState('Nueva EPS');
  const [exencion, setExencion] = useState('');

  // Controles para agregar medicamento a la tabla
  const [medSeleccionado, setMedSeleccionado] = useState('');
  const [cantidadSeleccionada, setCantidadSeleccionada] = useState(30);
  const [mostrarSelectorMed, setMostrarSelectorMed] = useState(false);

  // Mensajes de estado
  const [error, setError] = useState('');
  const [exito, setExito] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [sinPermiso, setSinPermiso] = useState('');

  const cargarDatos = async () => {
    try {
      const [resMeds, resFormulas] = await Promise.all([
        fetch('/api/simulador/medicamentos', { headers: conSesion() }),
        fetch('/api/simulador/formulas', { headers: conSesion() })
      ]);
      if ([401, 403].includes(resMeds.status)) {
        setSinPermiso((await resMeds.json()).mensaje ?? 'Debes iniciar sesión');
        return;
      }
      setSinPermiso('');
      const dataMeds = (await resMeds.json()).medicamentos ?? [];
      const dataFormulas = await resFormulas.json();
      if (!resMeds.ok || !resFormulas.ok) {
        setError('El simulador no está disponible: el backend debe correr con MODO_DEMO=true.');
      }

      setCatalogo(dataMeds);
      if (dataFormulas.siguiente_codigo) {
        setSiguienteCodigo(dataFormulas.siguiente_codigo);
      }
      if (dataFormulas.formulas) {
        setFormulasRecientes(dataFormulas.formulas);
      }

      // Inicializar con los dos medicamentos del wireframe (Acetaminofén 30 y Losartán 60) si está vacío
      if (items.length === 0 && dataMeds.length >= 2) {
        setItems([
          {
            medicamento_id: dataMeds[0].id,
            nombre: dataMeds[0].nombre,
            presentacion: dataMeds[0].presentacion,
            cantidad: 30
          },
          {
            medicamento_id: dataMeds[1].id,
            nombre: dataMeds[1].nombre,
            presentacion: dataMeds[1].presentacion,
            cantidad: 60
          }
        ]);
        setMedSeleccionado(String(dataMeds[2]?.id || dataMeds[0].id));
      }
    } catch (err) {
      console.error('Error cargando datos del simulador:', err);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const agregarMedicamento = () => {
    setError('');
    const med = catalogo.find((m) => String(m.id) === String(medSeleccionado));
    if (!med) {
      setError('Seleccione un medicamento válido.');
      return;
    }
    if (!cantidadSeleccionada || Number(cantidadSeleccionada) <= 0) {
      setError('Ingrese una cantidad mayor a 0.');
      return;
    }

    const yaExiste = items.find((i) => i.medicamento_id === med.id);
    if (yaExiste) {
      setItems(
        items.map((i) =>
          i.medicamento_id === med.id
            ? { ...i, cantidad: Number(i.cantidad) + Number(cantidadSeleccionada) }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          medicamento_id: med.id,
          nombre: med.nombre,
          presentacion: med.presentacion,
          cantidad: Number(cantidadSeleccionada)
        }
      ]);
    }
    setMostrarSelectorMed(false);
  };

  const quitarMedicamento = (medId) => {
    setItems(items.filter((i) => i.medicamento_id !== medId));
  };

  const cambiarCantidadItem = (medId, nuevaCantidad) => {
    setItems(
      items.map((i) =>
        i.medicamento_id === medId ? { ...i, cantidad: Number(nuevaCantidad) } : i
      )
    );
  };

  const guardarYEnviar = async (e) => {
    e.preventDefault();
    setError('');
    setExito(null);
    setEnviando(true);

    try {
      const respuesta = await fetch('/api/simulador/formulas', {
        method: 'POST',
        headers: conSesion({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          documento,
          nombre,
          fecha_emision: fechaEmision,
          fecha_limite: fechaLimite,
          regimen,
          rango_ingreso: regimen === 'contributivo' ? rangoIngreso : null,
          eps: eps.trim() || null,
          exencion: exencion || null,
          medicamentos: items.map((i) => ({
            medicamento_id: i.medicamento_id,
            cantidad: i.cantidad
          }))
        })
      });

      const data = await respuesta.json();
      if ([401, 403].includes(respuesta.status)) {
        setSinPermiso(data.mensaje ?? 'Debes iniciar sesión');
      } else if (!respuesta.ok || !data.ok) {
        const detalles = Array.isArray(data.detalles) && data.detalles.length ? `: ${data.detalles.join('; ')}` : '';
        setError((data.mensaje || 'Error al guardar y enviar la fórmula.') + detalles);
      } else {
        setExito({
          codigo: data.formula.codigo,
          documento: documento,
          nombre: nombre,
          cuota: data.formula.cuota_moderadora,
          mensaje: `Fórmula ${data.formula.codigo} registrada con ${data.formula.medicamentos} medicamento(s).`
        });
        setSiguienteCodigo(data.siguiente_codigo);
        await cargarDatos();
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor de la aplicación.');
    } finally {
      setEnviando(false);
    }
  };

  if (sinPermiso) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md border border-slate-300 p-8 text-center space-y-4">
        <span className="mx-auto w-12 h-12 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </span>
        <h2 className="text-xl font-bold text-slate-900">Acceso solo para administradores</h2>
        <p className="text-sm text-slate-600">
          {sinPermiso}. Inicia sesión con una cuenta de administrador en el panel de la farmacia y vuelve a esta página.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <a href="/farmacia" target="_blank" rel="noopener"
            className="bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Ir al panel de la farmacia ↗
          </a>
          <button type="button" onClick={cargarDatos}
            className="border border-slate-300 hover:bg-slate-50 text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer">
            Ya inicié sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tarjeta principal idéntica al Wireframe de la página 26 */}
      <div className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        <div className="bg-indigo-900 text-white px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl font-bold tracking-wide">Nueva fórmula médica</h2>
          <span className="text-xs bg-indigo-800 px-3 py-1 rounded-full text-indigo-100">
            Se envía a la farmacia por Mediconnect
          </span>
        </div>

        <form onSubmit={guardarYEnviar} className="p-6 space-y-6">
          {/* Alertas de error o éxito (Flujo principal y alterno 5a de CU-01) */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg flex items-start gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Fórmula rechazada por el sistema (RF-04)</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {exito && (
            <div className="bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded-r-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-base">
                    ¡Fórmula guardada y enviada! Código generado:{' '}
                    <span className="underline">{exito.codigo}</span>
                  </p>
                  <p className="text-sm text-emerald-800">
                    Paciente: {exito.nombre} (Doc: {exito.documento})
                  </p>
                  <p className="text-sm text-emerald-800">
                    Cuota moderadora al reclamar:{' '}
                    <strong>{exito.cuota > 0 ? `$${exito.cuota.toLocaleString('es-CO')}` : 'sin costo'}</strong>
                  </p>
                </div>
              </div>
              {onIrAPaciente && (
                <button
                  type="button"
                  onClick={() => onIrAPaciente(exito.codigo, exito.documento)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-lg shrink-0 transition cursor-pointer"
                >
                  Ver como paciente en Mediconnect ↗
                </button>
              )}
            </div>
          )}

          {/* Fila 1: Documento y Nombre del paciente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Documento del paciente
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="1090123456"
                className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Nombre del paciente
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
            </div>
          </div>

          {/* Fila 2: Fecha de la fórmula y Fecha límite de reclamo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Fecha de la fórmula
              </label>
              <input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Fecha límite de reclamo
              </label>
              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600"
              />
            </div>
          </div>

          {/* Afiliación: régimen, rango de ingreso (IBC), EPS y exención */}
          <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <legend className="sr-only">Afiliación del paciente</legend>
            <div>
              <label htmlFor="ips-regimen" className="block text-sm font-bold text-slate-800 mb-2">Régimen</label>
              <select id="ips-regimen" value={regimen} onChange={(e) => setRegimen(e.target.value)} className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600">
                <option value="contributivo">Contributivo</option>
                <option value="subsidiado">Subsidiado</option>
              </select>
            </div>
            {regimen === 'contributivo' ? (
              <div>
                <label htmlFor="ips-rango" className="block text-sm font-bold text-slate-800 mb-2">Rango de ingreso (IBC)</label>
                <select id="ips-rango" value={rangoIngreso} onChange={(e) => setRangoIngreso(e.target.value)} className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600">
                  <option value="A">A · menos de 2 salarios mínimos</option>
                  <option value="B">B · entre 2 y 5 salarios mínimos</option>
                  <option value="C">C · más de 5 salarios mínimos</option>
                </select>
              </div>
            ) : (
              <p className="self-end text-sm text-slate-600 pb-3">El régimen subsidiado no paga cuota moderadora.</p>
            )}
            <div>
              <label htmlFor="ips-eps" className="block text-sm font-bold text-slate-800 mb-2">EPS</label>
              <input id="ips-eps" type="text" value={eps} maxLength={80} onChange={(e) => setEps(e.target.value)}
                placeholder="Nombre de la EPS" className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600" />
            </div>
            <div>
              <label htmlFor="ips-exencion" className="block text-sm font-bold text-slate-800 mb-2">Exención de pago</label>
              <select id="ips-exencion" value={exencion} onChange={(e) => setExencion(e.target.value)} className="w-full border border-slate-400 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-slate-600">
                <option value="">Ninguna</option>
                <option value="promocion_prevencion">Promoción y prevención</option>
                <option value="control_prenatal">Control prenatal</option>
                <option value="alto_costo">Alto costo (cáncer, VIH…)</option>
                <option value="urgencia">Urgencia</option>
              </select>
            </div>
          </fieldset>

          {/* Tabla de Medicamentos (Wireframe pág. 26) */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              Medicamentos
            </label>

            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-sm font-bold text-slate-800">
                    <th className="py-2.5 px-4">Medicamento</th>
                    <th className="py-2.5 px-4 w-36">Cantidad</th>
                    <th className="py-2.5 px-4 w-28">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-base">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-4 px-4 text-center text-slate-500">
                        No hay medicamentos en la fórmula. Use "+ Agregar medicamento".
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.medicamento_id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {item.nombre}{' '}
                          <span className="text-xs text-slate-500">({item.presentacion})</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) =>
                              cambiarCantidadItem(item.medicamento_id, e.target.value)
                            }
                            className="w-24 border border-slate-300 rounded px-2 py-1 text-base"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => quitarMedicamento(item.medicamento_id)}
                            className="text-slate-500 hover:text-red-600 font-medium text-sm flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" /> Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Botón + Agregar medicamento */}
            {!mostrarSelectorMed ? (
              <button
                type="button"
                onClick={() => setMostrarSelectorMed(true)}
                className="mt-3 inline-flex items-center gap-1.5 border border-slate-400 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm px-4 py-2 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Agregar medicamento
              </button>
            ) : (
              <div className="mt-3 p-4 bg-slate-100 rounded-lg border border-slate-300 flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[220px]">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Seleccionar del catálogo
                  </label>
                  <select
                    value={medSeleccionado}
                    onChange={(e) => setMedSeleccionado(e.target.value)}
                    className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2 text-base"
                  >
                    {catalogo.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} ({m.presentacion}) — Stock actual: {m.stock_actual}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-32">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadSeleccionada}
                    onChange={(e) => setCantidadSeleccionada(e.target.value)}
                    className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2 text-base"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={agregarMedicamento}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm px-4 py-2.5 rounded-lg cursor-pointer"
                  >
                    Añadir a la tabla
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarSelectorMed(false)}
                    className="border border-slate-400 bg-white hover:bg-slate-200 text-slate-700 font-medium text-sm px-3 py-2.5 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pie del formulario: Código generado y botón Guardar y enviar a la app */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-base font-bold text-slate-900">
              Código generado:{' '}
              <span className="font-mono bg-slate-100 border border-slate-300 px-3 py-1 rounded text-slate-900">
                {exito ? exito.codigo : siguienteCodigo}
              </span>
              <span className="block text-xs font-normal text-slate-500 mt-1">
                Formato automático F-AAAA-NNNN (RF-02)
              </span>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="bg-neutral-300 hover:bg-neutral-400 active:bg-neutral-500 border border-neutral-500 text-slate-900 font-bold text-base px-8 py-3.5 rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {enviando ? 'Enviando a la app...' : 'Guardar y enviar a la app'}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de fórmulas registradas para facilitar el testeo */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-300 p-6">
        <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          Fórmulas enviadas al sistema (para copiar y probar en Vista del Paciente)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 px-3">Código</th>
                <th className="py-2 px-3">Paciente</th>
                <th className="py-2 px-3">Documento</th>
                <th className="py-2 px-3">Vence</th>
                <th className="py-2 px-3">Medicamentos</th>
                <th className="py-2 px-3">Acción rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formulasRecientes.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{f.codigo}</td>
                  <td className="py-2.5 px-3">{f.paciente_nombre}</td>
                  <td className="py-2.5 px-3 font-mono">{f.paciente_documento}</td>
                  <td className="py-2.5 px-3">{f.fecha_limite}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    {f.items?.map((i) => `${i.medicamento_nombre} (${i.cantidad_formulada})`).join(', ')}
                  </td>
                  <td className="py-2.5 px-3">
                    {onIrAPaciente && (
                      <button
                        type="button"
                        onClick={() => onIrAPaciente(f.codigo, f.paciente_documento)}
                        className="text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded font-semibold cursor-pointer"
                      >
                        Ver en Mediconnect ↗
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
