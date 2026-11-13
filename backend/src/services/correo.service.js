import { readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';

// Envío de correos. Con SMTP_HOST configurado en .env se envían de verdad;
// sin él (desarrollo) el correo se muestra en la consola del backend.
//   SMTP_HOST, SMTP_PORT (587), SMTP_USUARIO, SMTP_CLAVE, CORREO_REMITENTE
const transporte = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USUARIO
        ? { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_CLAVE?.replace(/\s/g, '') }
        : undefined,
    })
  : null;

const REMITENTE = process.env.CORREO_REMITENTE || 'Mediconnect <no-responder@mediconnect.local>';

// Dirección pública del sitio, para armar los enlaces de los correos.
// En el equipo local el túnel cambia de dirección cada vez que se reinicia: si URL_SITIO_ARCHIVO
// apunta al archivo donde el lanzador guarda la dirección del túnel, se lee en cada correo.
const URL_FIJA = process.env.URL_SITIO || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5174';

export function urlSitio() {
  let url = URL_FIJA;
  if (process.env.URL_SITIO_ARCHIVO) {
    try {
      const delArchivo = readFileSync(process.env.URL_SITIO_ARCHIVO, 'utf8').trim();
      if (/^https:\/\/[a-z0-9.-]+$/i.test(delArchivo)) url = delArchivo;
    } catch {
      // Sin túnel abierto: se usa la dirección fija
    }
  }
  return url.replace(/\/$/, '');
}

export async function enviarCorreo({ para, asunto, texto, html }) {
  if (!transporte) {
    console.log(`\n[correo sin SMTP] Para: ${para}\nAsunto: ${asunto}\n${texto}\n`);
    return;
  }
  await transporte.sendMail({ from: REMITENTE, to: para, subject: asunto, text: texto, html });
}

export function correoConfirmacion({ nombre, enlace, horas }) {
  const texto =
    `Hola, ${nombre}:\n\n` +
    `Confirma tu correo para terminar de activar tu cuenta de Mediconnect:\n${enlace}\n\n` +
    `El enlace vence en ${horas} horas. Si no creaste esta cuenta, ignora este mensaje.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0d2259">
      <h2 style="color:#2257c5">Medi<span style="color:#14ada2">connect</span></h2>
      <p>Hola, ${escapar(nombre)}:</p>
      <p>Confirma tu correo para terminar de activar tu cuenta.</p>
      <p style="margin:28px 0">
        <a href="${enlace}" style="background:#14ada2;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">
          Confirmar mi correo
        </a>
      </p>
      <p style="font-size:13px;color:#555">El enlace vence en ${horas} horas. Si no creaste esta cuenta, ignora este mensaje.</p>
    </div>`;
  return { asunto: 'Confirma tu correo · Mediconnect', texto, html };
}

export function correoRestablecer({ nombre, enlace, minutos }) {
  const texto =
    `Hola, ${nombre}:\n\n` +
    `Pediste crear una contraseña nueva para tu cuenta de Mediconnect:\n${enlace}\n\n` +
    `El enlace vence en ${minutos} minutos y sirve una sola vez. ` +
    `Si no lo pediste, ignora este mensaje: tu contraseña actual sigue funcionando.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0d2259">
      <h2 style="color:#2257c5">Medi<span style="color:#14ada2">connect</span></h2>
      <p>Hola, ${escapar(nombre)}:</p>
      <p>Pediste crear una contraseña nueva para tu cuenta.</p>
      <p style="margin:28px 0">
        <a href="${enlace}" style="background:#2257c5;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">
          Crear contraseña nueva
        </a>
      </p>
      <p style="font-size:13px;color:#555">El enlace vence en ${minutos} minutos y sirve una sola vez.
        Si no lo pediste, ignora este mensaje: tu contraseña actual sigue funcionando.</p>
    </div>`;
  return { asunto: 'Crea tu contraseña nueva · Mediconnect', texto, html };
}

const escapar = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
