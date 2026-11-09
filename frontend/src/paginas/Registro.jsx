import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import SitioPublico, { TituloPagina } from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { Aviso } from '../components/farmacia/comunes';
import CamposPersonales, {
  Campo, DATOS_VACIOS, Seccion, TIPOS_DOCUMENTO, claseInput,
} from '../components/cuenta/CamposPersonales';
import { useCuenta } from '../lib/cuenta';

export default function Registro() {
  useTitulo('Crear cuenta');
  const { cuenta, registrar } = useCuenta();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ ...DATOS_VACIOS, tipo_documento: 'CC', documento: '' });
  const [clave, setClave] = useState('');
  const [clave2, setClave2] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (cuenta) return <Navigate to="/mi-cuenta" replace />;

  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));

  const enviar = async (e) => {
    e.preventDefault();
    if (clave !== clave2) {
      setAviso({ tipo: 'error', texto: 'Las contraseñas no coinciden' });
      return;
    }
    if (!acepta) {
      setAviso({ tipo: 'error', texto: 'Debes aceptar el tratamiento de tus datos personales' });
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      await registrar({ ...datos, clave, acepta_datos: true });
      navegar('/mi-cuenta');
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.message });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SitioPublico>
      <TituloPagina
        titulo="Crear cuenta"
        descripcion="Guarda tus fórmulas, consulta tu historial y pide tus medicamentos a domicilio."
      />
      <div className="bg-marca-hielo py-8">
        <form onSubmit={enviar} className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 sm:p-8 space-y-8">
            <Aviso aviso={aviso} />

            <Seccion titulo="Identificación">
              <Campo etiqueta="Tipo de documento" id="tipo_documento">
                <select id="tipo_documento" value={datos.tipo_documento}
                  onChange={(e) => cambiar('tipo_documento', e.target.value)} className={claseInput}>
                  {TIPOS_DOCUMENTO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Número de documento" id="documento" ayuda="Sin puntos ni espacios">
                <input id="documento" value={datos.documento} required maxLength={20} autoComplete="off"
                  onChange={(e) => cambiar('documento', e.target.value.replace(/[^0-9a-zA-Z]/g, ''))} className={claseInput} />
              </Campo>
            </Seccion>

            <CamposPersonales datos={datos} cambiar={cambiar} />

            <Seccion titulo="Contraseña">
              <Campo etiqueta="Contraseña" id="clave" ayuda="Mínimo 8 caracteres, con letras y números">
                <input id="clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)}
                  autoComplete="new-password" minLength={8} required className={claseInput} />
              </Campo>
              <Campo etiqueta="Repite la contraseña" id="clave2">
                <input id="clave2" type="password" value={clave2} onChange={(e) => setClave2(e.target.value)}
                  autoComplete="new-password" required className={claseInput} />
              </Campo>
            </Seccion>

            <label className="flex items-start gap-3 bg-marca-hielo border border-slate-200 rounded p-4 cursor-pointer">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
                className="mt-1 w-5 h-5 accent-marca-azul shrink-0" />
              <span className="text-sm text-slate-700">
                Autorizo a Mediconnect a tratar mis datos personales y de salud para gestionar mis fórmulas,
                turnos y domicilios, según la{' '}
                <Link to="/informacion#datos" target="_blank" className="text-marca-azul font-semibold underline">
                  política de tratamiento de datos
                </Link>{' '}
                (Ley 1581 de 2012).
              </span>
            </label>

            <button type="submit" disabled={enviando}
              className="w-full flex items-center justify-center gap-2 bg-marca-verde hover:bg-marca-verde-oscuro disabled:opacity-60 text-white font-bold py-3 rounded transition cursor-pointer">
              <UserPlus className="w-5 h-5" />
              {enviando ? 'Creando tu cuenta…' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </div>
    </SitioPublico>
  );
}
