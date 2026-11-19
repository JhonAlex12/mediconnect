// Una sola sesión por cuenta del personal.
// Cada token lleva "eq" (el navegador donde se inició sesión) y "v" (la versión de la sesión).
// - Mientras la sesión está en uso, nadie puede entrar con la cuenta desde otro equipo.
//   "En uso": la página abierta avisa cada 2 minutos; si pasan MINUTOS_SESION_INACTIVA sin
//   noticias (se cerró el navegador sin "Salir"), la cuenta queda libre otra vez.
// - "Salir" la libera al instante; cambiar la contraseña cierra todas las sesiones y también la libera.
// - El panel y la IPS abiertos en el mismo navegador comparten el equipo: no se bloquean entre sí.

export const FORMATO_EQUIPO = /^[A-Za-z0-9_-]{16,64}$/;
export const MINUTOS_SESION_INACTIVA = 5;

export const MENSAJE_SESION_ABIERTA = `Esta cuenta ya tiene una sesión abierta en otro equipo. Ciérrala allá con «Salir» para entrar aquí. `
  + `Si esa página ya se cerró, espera ${MINUTOS_SESION_INACTIVA} minutos e inténtalo de nuevo.`;

// Lo que ve el empleado en el panel cuando su sesión ya no sirve; la IPS usa sus propios textos con el mismo código
export const MENSAJES_SESION_CERRADA = {
  cerrada: 'Tu sesión se cerró. Inicia sesión de nuevo.',
  clave_cambiada: 'La contraseña de esta cuenta cambió. Inicia sesión de nuevo.',
  otro_equipo: 'Esta página estuvo cerrada o inactiva y la cuenta se abrió en otro equipo. Si no fuiste tú, avísale al administrador.',
};

// null si la sesión sigue vigente; si no, el código del motivo
export function motivoSesionCerrada(datos, u) {
  if (typeof datos.eq !== 'string' || !Number.isInteger(datos.v)) return 'cerrada';   // token de antes de este cambio
  if (datos.v !== u.version_sesion) return 'clave_cambiada';
  if (u.equipo_sesion === null) return 'cerrada';                                     // salió con «Salir»
  if (datos.eq !== u.equipo_sesion) return 'otro_equipo';
  return null;
}
