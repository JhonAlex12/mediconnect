import React, { useCallback, useEffect, useState } from 'react';
import { Save, Wallet } from 'lucide-react';
import { api } from '../../lib/api';
import { Aviso, BotonAccion, claseCampo, useAccion } from './comunes';

const pesos = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('es-CO')}`);

const RANGOS = [
  ['A', 'Menos de 2 salarios mínimos'],
  ['B', 'Entre 2 y 5 salarios mínimos'],
  ['C', 'Más de 5 salarios mínimos'],
];

// Valores de la cuota moderadora por año (solo administradores).
// Una fórmula guarda el valor del momento en que llegó: cambiar la tarifa no afecta las ya recibidas.
export default function TarifasFarmacia() {
  const [tarifas, setTarifas] = useState([]);
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [valores, setValores] = useState({ A: '', B: '', C: '' });
  const [error, setError] = useState(null);
  const { ocupado, aviso, ejecutar } = useAccion();

  const cargar = useCallback(async () => {
    try {
      const r = await api('/tarifas');
      setTarifas(r.tarifas);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al cambiar el año se cargan sus valores (si ya existen)
  useEffect(() => {
    const t = tarifas.find((x) => String(x.anio) === anio);
    setValores(t ? { A: String(t.A), B: String(t.B), C: String(t.C) } : { A: '', B: '', C: '' });
  }, [anio, tarifas]);

  const validos = RANGOS.every(([r]) => /^\d+$/.test(valores[r]))
    && /^\d{4}$/.test(anio);

  const guardar = async (e) => {
    e.preventDefault();
    const cuerpo = Object.fromEntries(RANGOS.map(([r]) => [r, Number(valores[r])]));
    await ejecutar(
      () => api(`/tarifas/${anio}`, { metodo: 'PUT', cuerpo }).then((r) => {
        setTarifas(r.tarifas);
        return r;
      }),
      () => `Tarifas ${anio} guardadas`
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-slate-600" />
          Tarifas de cuota moderadora
        </h2>
        <p className="text-slate-600 mt-1 max-w-3xl">
          Valor que paga en ventanilla un paciente del régimen contributivo, según su rango de ingreso (IBC).
          El régimen subsidiado y las fórmulas exentas no pagan. Verifica los valores con la circular oficial de cada año.
        </p>
      </div>

      {error && <Aviso aviso={{ tipo: 'error', texto: error }} />}

      <form onSubmit={guardar} className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
        <div className="w-40">
          <label htmlFor="tar-anio" className="block text-sm font-bold text-slate-800 mb-1">Año</label>
          <input id="tar-anio" type="number" min={2000} max={2100} value={anio}
            onChange={(e) => setAnio(e.target.value)} className={claseCampo} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {RANGOS.map(([r, texto]) => (
            <div key={r}>
              <label htmlFor={`tar-${r}`} className="block text-sm font-bold text-slate-800 mb-1">
                Rango {r} <span className="font-normal text-slate-500">· {texto}</span>
              </label>
              <input id={`tar-${r}`} type="number" min={0} step={100} inputMode="numeric" value={valores[r]}
                onChange={(e) => setValores((v) => ({ ...v, [r]: e.target.value }))} className={claseCampo} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <BotonAccion type="submit" color="verde" icono={Save} ocupado={ocupado || !validos}>
            Guardar tarifas {anio}
          </BotonAccion>
          <p className="text-sm text-slate-500">Las fórmulas ya recibidas conservan el valor con el que llegaron.</p>
        </div>
        <Aviso aviso={aviso} />
      </form>

      <section className="bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden">
        <h3 className="px-5 py-3 border-b border-slate-200 font-bold text-slate-800">Historial por año</h3>
        {tarifas.length === 0 ? (
          <p className="p-5 text-slate-500">No hay tarifas cargadas.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-5 py-2 font-semibold">Año</th>
                {RANGOS.map(([r]) => <th key={r} className="px-5 py-2 font-semibold text-right">Rango {r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tarifas.map((t) => (
                <tr key={t.anio}>
                  <td className="px-5 py-2.5 font-semibold text-slate-900">{t.anio}</td>
                  {RANGOS.map(([r]) => <td key={r} className="px-5 py-2.5 text-right tabular-nums">{pesos(t[r])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
