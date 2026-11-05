// Cliente HTTP del panel de la farmacia: agrega el token y ordena los errores
const CLAVE_TOKEN = 'mediconect_token_empleado';

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento: la sesión dura solo mientras la pestaña esté abierta
  }
}

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

// Se avisa al contexto de sesión cuando el backend responde 401
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
    if (respuesta.status === 401 && token && token === leerToken()) alVencerSesion?.();
    const mensaje = datos.mensaje || 'Ocurrió un error inesperado';
    const detalles = Array.isArray(datos.detalles) && datos.detalles.length ? `: ${datos.detalles.join('; ')}` : '';
    throw new ErrorApi(mensaje + detalles, respuesta.status);
  }
  return datos;
}
