import { useEffect, useState } from 'react';
import { api } from './api';

// Costo de envío vigente de los domicilios (null mientras carga o si falla)
export function useCostoEnvio() {
  const [valor, setValor] = useState(null);
  useEffect(() => {
    let cancelado = false;
    api('/tarifas/domicilio', { token: null })
      .then((d) => !cancelado && setValor(d.costo_envio))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);
  return valor;
}

// Lo que el paciente paga al recibir: cuota moderadora (si aplica y no la pagó) + envío
export function totalDomicilio({ cuota_moderadora: cuota = 0, cuota_pagada: pagada, costo_envio: envio = 0 }) {
  const cuotaACobrar = pagada ? 0 : cuota;
  return { cuota: cuotaACobrar, envio, total: cuotaACobrar + envio };
}
