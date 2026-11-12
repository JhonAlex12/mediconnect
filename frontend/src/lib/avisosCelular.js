// Avisos al celular (notificaciones push) del paciente.
// El navegador pide permiso, registra /sw.js y entrega una "suscripción" que se guarda en el servidor
// para el paciente dueño del turno. El servidor envía ahí cada notificación nueva.
import { api } from './api';

const esIphone = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad con iPadOS se presenta como Mac

const abiertaDesdeInicio = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Clave pública del servidor en el formato que pide el navegador
function aBytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
  const texto = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}

// Estados posibles:
//  'activo' · 'inactivo' · 'bloqueado' (el paciente negó el permiso)
//  'iphone' (iPhone/iPad: hay que agregar la página a la pantalla de inicio)
//  'sin_https' · 'no_soportado' · 'sin_servidor' (el servidor no tiene las claves)
export async function estadoAvisos() {
  if (!window.isSecureContext) return 'sin_https';
  const soporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!soporta) return esIphone() && !abiertaDesdeInicio() ? 'iphone' : 'no_soportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  const registro = await navigator.serviceWorker.getRegistration('/');
  const suscripcion = await registro?.pushManager.getSubscription();
  return suscripcion && Notification.permission === 'granted' ? 'activo' : 'inactivo';
}

// Pide permiso, se suscribe y guarda el celular para el paciente del turno
export async function activarAvisos(token) {
  const { clave } = await api('/turnos/push/clave', { token: null });
  if (!clave) throw new Error('Los avisos al celular no están disponibles en este momento.');

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('No diste permiso para los avisos. Puedes activarlo en la configuración del navegador.');

  const registro = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion) {
    suscripcion = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
  }
  await api('/turnos/mio/push', { metodo: 'POST', token, cuerpo: { suscripcion: suscripcion.toJSON() } });
}

// Si el celular ya tenía avisos (p. ej. de un turno anterior), lo vincula también a este turno
export async function vincularAvisos(token) {
  const registro = await navigator.serviceWorker?.getRegistration('/');
  const suscripcion = await registro?.pushManager.getSubscription();
  if (suscripcion && Notification.permission === 'granted') {
    await api('/turnos/mio/push', { metodo: 'POST', token, cuerpo: { suscripcion: suscripcion.toJSON() } });
  }
}

// Deja de recibir avisos en este celular
export async function desactivarAvisos(token) {
  const registro = await navigator.serviceWorker.getRegistration('/');
  const suscripcion = await registro?.pushManager.getSubscription();
  if (!suscripcion) return;
  await api('/turnos/mio/push', { metodo: 'DELETE', token, cuerpo: { endpoint: suscripcion.endpoint } }).catch(() => {});
  await suscripcion.unsubscribe();
}
