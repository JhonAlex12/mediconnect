import pg from 'pg';
import webpush from 'web-push';
import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';

// ============================================================
// AVISOS AL CELULAR (notificaciones push)
// ============================================================
// El paciente acepta recibir avisos en su celular y el navegador entrega una "suscripción"
// (una dirección del servicio de avisos de Google, Mozilla, Apple o Microsoft).
// Cada vez que se crea una fila en "notificaciones", la base de datos avisa por el canal
// "nueva_notificacion" (ver schema.sql) y aquí se envía el mensaje a sus celulares.
// Sin las claves VAPID en el .env todo sigue funcionando, solo que sin avisos al celular.

const PUBLICA = process.env.VAPID_PUBLICA;
const PRIVADA = process.env.VAPID_PRIVADA;
export const pushActivo = Boolean(PUBLICA && PRIVADA);

if (pushActivo) {
  // Contacto para los servicios de avisos (lo exigen; no se muestra al paciente)
  const contacto = process.env.VAPID_CONTACTO
    || (process.env.CORREO_REMITENTE ? `mailto:${process.env.CORREO_REMITENTE}` : null)
    || process.env.URL_SITIO
    || 'https://mediconnect.local';
  webpush.setVapidDetails(contacto, PUBLICA, PRIVADA);
}

export const clavePublica = () => (pushActivo ? PUBLICA : null);

// Solo se aceptan direcciones de los servicios de avisos de los navegadores.
// Así nadie puede hacer que el servidor envíe peticiones a otra parte.
const SERVICIOS_PERMITIDOS = [
  /(^|\.)fcm\.googleapis\.com$/,          // Chrome, Edge (Android y computador), Samsung Internet
  /(^|\.)push\.services\.mozilla\.com$/,  // Firefox
  /(^|\.)push\.apple\.com$/,              // Safari (iPhone con la página en la pantalla de inicio, Mac)
  /(^|\.)notify\.windows\.com$/,          // Edge antiguo en Windows
];

function validarSuscripcion(s) {
  const endpoint = s?.endpoint;
  const p256dh = s?.keys?.p256dh;
  const auth = s?.keys?.auth;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new ErrorNegocio('Suscripción inválida', 400);
  }
  if (url.protocol !== 'https:' || !SERVICIOS_PERMITIDOS.some((r) => r.test(url.hostname))) {
    throw new ErrorNegocio('Servicio de avisos no permitido', 400);
  }
  const clave = /^[A-Za-z0-9_-]+=*$/;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || !clave.test(p256dh) || !clave.test(auth)
      || p256dh.length > 200 || auth.length > 100 || endpoint.length > 1000) {
    throw new ErrorNegocio('Suscripción inválida', 400);
  }
  return { endpoint, p256dh, auth };
}

// Guarda el celular para el paciente dueño del turno
export async function guardarSuscripcion(turnoId, suscripcion) {
  if (!pushActivo) throw new ErrorNegocio('Los avisos al celular no están activados en el servidor', 503);
  const { endpoint, p256dh, auth } = validarSuscripcion(suscripcion);
  const { rowCount } = await pool.query(
    `INSERT INTO suscripciones_push (paciente_id, endpoint, p256dh, auth)
     SELECT paciente_id, $2, $3, $4 FROM turnos WHERE id = $1 AND paciente_id IS NOT NULL
     ON CONFLICT (paciente_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [turnoId, endpoint, p256dh, auth]
  );
  if (rowCount === 0) throw new ErrorNegocio('Turno no encontrado', 404);
}

// Deja de enviar avisos a ese celular para el paciente dueño del turno
export async function quitarSuscripcion(turnoId, endpoint) {
  if (typeof endpoint !== 'string') throw new ErrorNegocio('Falta el endpoint', 400);
  await pool.query(
    `DELETE FROM suscripciones_push s USING turnos t
      WHERE t.id = $1 AND s.paciente_id = t.paciente_id AND s.endpoint = $2`,
    [turnoId, endpoint]
  );
}

// Envía una notificación ya guardada a todos los celulares del paciente
export async function enviarNotificacion(notificacionId) {
  if (!pushActivo) return;
  const { rows: [n] } = await pool.query(
    'SELECT id, paciente_id, tipo, mensaje FROM notificaciones WHERE id = $1',
    [notificacionId]
  );
  if (!n) return;
  const { rows: suscripciones } = await pool.query(
    'SELECT id, endpoint, p256dh, auth FROM suscripciones_push WHERE paciente_id = $1',
    [n.paciente_id]
  );
  const carga = JSON.stringify({ titulo: 'Mediconnect', cuerpo: n.mensaje, tipo: n.tipo, id: n.id, url: '/paciente' });

  await Promise.all(suscripciones.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        carga,
        // "Es tu turno" pierde sentido después de un rato: si el celular está apagado una hora, no se entrega
        { TTL: 3600, urgency: 'high' }
      );
    } catch (error) {
      // 404/410: el paciente quitó el permiso o desinstaló el navegador; ese celular ya no sirve
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.query('DELETE FROM suscripciones_push WHERE id = $1', [s.id]);
      } else {
        console.error('No se pudo enviar el aviso al celular:', error.statusCode ?? '', error.body ?? error.message);
      }
    }
  }));
}

// Escucha el canal de la base de datos y envía cada notificación nueva.
// Usa una conexión propia (no del pool) y se reconecta si se cae.
export function iniciarPush() {
  if (!pushActivo) {
    console.log('Avisos al celular desactivados: faltan VAPID_PUBLICA y VAPID_PRIVADA en el .env');
    return;
  }
  let reintento = null;
  const conectar = async () => {
    const cliente = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    const reconectar = () => {
      if (reintento) return;
      cliente.removeAllListeners();
      cliente.end().catch(() => {});
      reintento = setTimeout(() => { reintento = null; conectar(); }, 5000);
    };
    cliente.on('error', reconectar);
    cliente.on('end', reconectar);
    cliente.on('notification', (msg) => {
      const id = Number(msg.payload);
      if (Number.isInteger(id)) enviarNotificacion(id).catch((e) => console.error('Aviso al celular:', e.message));
    });
    try {
      await cliente.connect();
      await cliente.query('LISTEN nueva_notificacion');
      console.log('Avisos al celular activos');
    } catch (error) {
      console.error('No se pudo escuchar las notificaciones:', error.message);
      reconectar();
    }
  };
  conectar();
}
