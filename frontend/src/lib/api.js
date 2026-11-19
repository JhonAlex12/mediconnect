// Cliente HTTP del panel de la farmacia: agrega el token y ordena los errores

// La sesión del empleado vive solo en la pestaña donde inició sesión (sessionStorage): al abrir
// el enlace en otra pestaña o ventana, la página aparece sin sesión y se puede entrar con otra
// cuenta sin cerrar la que ya está abierta. Sigue al recargar y se pierde al cerrar la pestaña.
// La excepción es la pantalla de la sala, que el panel abre con su botón: esa ventana usa la
// sesión de la pestaña que la abrió.
const CLAVE_TOKEN = 'mediconect_token_empleado';
export const VENTANA_PANTALLA = 'pantalla-sala';
// (Versiones anteriores la guardaban en localStorage, para todo el navegador: eso ya no se lee,
// para que ninguna pestaña nueva tome la sesión de otra.)

export function leerToken() {
  try {
    const propio = sessionStorage.getItem(CLAVE_TOKEN);
    if (propio) return propio;
    const heredado = tokenDelPanelQueAbrio();
    if (heredado) sessionStorage.setItem(CLAVE_TOKEN, heredado);   // así sobrevive a recargar la pantalla
    return heredado;
  } catch {
    return null;
  }
}

// Solo la ventana "pantalla-sala" (window.open desde el panel) toma la sesión de quien la abrió
function tokenDelPanelQueAbrio() {
  if (window.name !== VENTANA_PANTALLA) return null;
  try {
    return window.opener?.sessionStorage.getItem(CLAVE_TOKEN) ?? null;
  } catch {
    return null;   // la abrió otro sitio: sin acceso
  }
}

export function guardarToken(token) {
  try {
    if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento: la sesión dura solo mientras la página esté abierta
  }
}

// Identifica a este navegador. Una cuenta del personal tiene una sola sesión: mientras está abierta
// aquí, nadie entra con ella desde otro equipo. El panel y la IPS abiertos aquí comparten el identificador.
const CLAVE_EQUIPO = 'mediconect_equipo';
let equipoEnMemoria = null;
export function idEquipo() {
  const nuevo = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  try {
    let id = localStorage.getItem(CLAVE_EQUIPO);
    if (!id) {
      id = nuevo();
      localStorage.setItem(CLAVE_EQUIPO, id);
    }
    return id;
  } catch {
    equipoEnMemoria ??= nuevo();   // sin almacenamiento: vale mientras la pestaña esté abierta
    return equipoEnMemoria;
  }
}

export class ErrorApi extends Error {
  constructor(mensaje, estado, sesionCerrada = null) {
    super(mensaje);
    this.estado = estado;
    this.sesionCerrada = sesionCerrada;   // por qué el servidor cerró la sesión (cerrada, clave_cambiada, otro_equipo)
  }
}

// Se avisa al contexto de sesión cuando el backend responde 401 (con el motivo, si el servidor la cerró)
let alVencerSesion = null;
export function alVencer(fn) {
  alVencerSesion = fn;
}

export async function api(ruta, { metodo = 'GET', cuerpo, token = leerToken() } = {}) {
  const cabeceras = {};
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor', 0);
  }

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    // Solo cierra la sesión del empleado si falló SU token (no el de un turno de paciente)
    const sesionCerrada = respuesta.status === 401 && datos.sesion_cerrada ? datos.sesion_cerrada : null;
    if (respuesta.status === 401 && token && token === leerToken()) alVencerSesion?.(sesionCerrada ? datos.mensaje : undefined);
    const mensaje = datos.mensaje || 'Ocurrió un error inesperado';
    const detalles = Array.isArray(datos.detalles) && datos.detalles.length ? `: ${datos.detalles.join('; ')}` : '';
    throw new ErrorApi(mensaje + detalles, respuesta.status, sesionCerrada);
  }
  return datos;
}

// La página abierta le avisa al servidor que la sesión sigue en uso (si pasan 5 minutos
// sin aviso, por ejemplo porque se cerró el navegador, la cuenta queda libre para otro equipo)
export const LATIDO_SESION_MS = 2 * 60 * 1000;
