// Sesión del sistema de la IPS (/ips/), guardada aparte de la del panel de la farmacia.
// Así, si el médico inicia sesión en la IPS, el panel del auxiliar en el mismo navegador no se ve afectado.
// Como en el panel, vive solo en la pestaña donde se inició (sessionStorage): al abrir el enlace
// otra vez, la página aparece sin sesión y la que ya estaba abierta sigue igual.
const CLAVE = 'mediconect_token_ips';

export function leerTokenIps() {
  try {
    return sessionStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarTokenIps(token) {
  try {
    if (token) sessionStorage.setItem(CLAVE, token);
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: la sesión dura solo mientras la página esté abierta
  }
}
