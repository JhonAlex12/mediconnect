import { useEffect, useState } from 'react';
import { api } from './api';

// Datos vigentes de los domicilios: { envio, transferencia } (null mientras carga o si falla).
// "transferencia": datos de la cuenta de la farmacia; null si solo se puede pagar contraentrega
export function useDatosDomicilio() {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let cancelado = false;
    api('/tarifas/domicilio', { token: null })
      .then((d) => !cancelado && setDatos({ envio: d.costo_envio, transferencia: d.transferencia ?? null }))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);
  return datos;
}

// Costo de envío vigente de los domicilios (null mientras carga o si falla)
export function useCostoEnvio() {
  return useDatosDomicilio()?.envio ?? null;
}

// Lo que paga el paciente por el domicilio: cuota moderadora (si aplica y no la pagó) + envío
export function totalDomicilio({ cuota_moderadora: cuota = 0, cuota_pagada: pagada, costo_envio: envio = 0 }) {
  const cuotaACobrar = pagada ? 0 : cuota;
  return { cuota: cuotaACobrar, envio, total: cuotaACobrar + envio };
}
