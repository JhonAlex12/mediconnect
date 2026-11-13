// Sesión del sistema de la IPS (/ips/), guardada aparte de la del panel de la farmacia.
// Así, si el médico inicia sesión en la IPS, el panel del auxiliar en el mismo navegador no se ve afectado.
const CLAVE = 'mediconect_token_ips';

export function leerTokenIps() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarTokenIps(token) {
  try {
    if (token) localStorage.setItem(CLAVE, token);
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: la sesión dura solo mientras la pestaña esté abierta
  }
}
