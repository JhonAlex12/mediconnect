// Prueba del correo: npm run correo:prueba -- destino@ejemplo.com
// Revisa que los datos SMTP de .env sirvan y envía un mensaje de prueba.
import 'dotenv/config';
import nodemailer from 'nodemailer';

const destino = process.argv[2];
const { SMTP_HOST, SMTP_PORT = '587', SMTP_USUARIO, SMTP_CLAVE, CORREO_REMITENTE } = process.env;

if (!SMTP_HOST || !SMTP_USUARIO || !SMTP_CLAVE) {
  console.error('Faltan datos en backend/.env: SMTP_HOST, SMTP_USUARIO y SMTP_CLAVE');
  process.exit(1);
}
if (!destino) {
  console.error('Escribe a quién enviar la prueba: npm run correo:prueba -- tucorreo@gmail.com');
  process.exit(1);
}

const transporte = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USUARIO, pass: SMTP_CLAVE.replace(/\s/g, '') },
});

try {
  await transporte.verify();
  console.log('✔ Conexión con el servidor de correo correcta');
  await transporte.sendMail({
    from: CORREO_REMITENTE || SMTP_USUARIO,
    to: destino,
    subject: 'Prueba de correo · Mediconnect',
    text: 'Si lees esto, Mediconnect ya puede enviar correos a los pacientes.',
  });
  console.log(`✔ Correo de prueba enviado a ${destino}. Revisa la bandeja (y la carpeta de spam).`);
} catch (error) {
  console.error('✘ No se pudo enviar:', error.message);
  if (/535|Username and Password/i.test(error.message)) {
    console.error('  Revisa SMTP_USUARIO y que SMTP_CLAVE sea una contraseña de aplicación (16 letras), no la clave normal de Gmail.');
  }
  process.exit(1);
}
