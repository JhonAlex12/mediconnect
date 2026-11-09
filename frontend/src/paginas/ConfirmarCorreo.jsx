import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailWarning } from 'lucide-react';
import SitioPublico from '../components/SitioPublico';
import { useTitulo } from '../components/Encabezado';
import { api } from '../lib/api';
import { useCuenta } from '../lib/cuenta';

// Se abre desde el enlace del correo: /confirmar-correo?token=...
export default function ConfirmarCorreo() {
  useTitulo('Confirmar correo');
  const [params] = useSearchParams();
  const { cuenta, recargarCuenta } = useCuenta();
  const [estado, setEstado] = useState({ tipo: 'cargando' });
  const enviado = useRef(false); // el enlace sirve una sola vez: no repetir la petición

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;
    api('/cuenta/confirmar-correo', { metodo: 'POST', cuerpo: { token: params.get('token') ?? '' }, token: null })
      .then((d) => {
        setEstado({ tipo: 'ok', correo: d.correo });
        recargarCuenta().catch(() => {});
      })
      .catch((err) => setEstado({ tipo: 'error', texto: err.message }));
  }, [params, recargarCuenta]);

  return (
    <SitioPublico>
      <div className="bg-marca-hielo py-16 px-4">
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-lg shadow-sm p-8 text-center">
          {estado.tipo === 'cargando' && <p className="text-slate-500">Confirmando tu correo…</p>}
          {estado.tipo === 'ok' && (
            <>
              <CheckCircle2 className="w-14 h-14 text-marca-verde mx-auto" />
              <h1 className="font-titulo text-2xl font-extrabold text-marca-noche mt-4">¡Correo confirmado!</h1>
              <p className="text-slate-600 mt-2">{estado.correo} quedó verificado. Ya puedes pedir tus medicamentos a domicilio.</p>
            </>
          )}
          {estado.tipo === 'error' && (
            <>
              <MailWarning className="w-14 h-14 text-amber-500 mx-auto" />
              <h1 className="font-titulo text-2xl font-extrabold text-marca-noche mt-4">No pudimos confirmar tu correo</h1>
              <p className="text-slate-600 mt-2">{estado.texto}</p>
            </>
          )}
          {estado.tipo !== 'cargando' && (
            <Link to={cuenta ? '/mi-cuenta' : '/'}
              className="inline-block mt-6 bg-marca-azul hover:bg-marca-azul-oscuro text-white font-bold px-6 py-3 rounded">
              {cuenta ? 'Ir a mi cuenta' : 'Ir al inicio'}
            </Link>
          )}
        </div>
      </div>
    </SitioPublico>
  );
}
