// Genera las imágenes livianas que usa el sitio a partir de los originales.
// Uso: npm run imagenes
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const salida = new URL('../public/img/', import.meta.url).pathname;
await mkdir(salida, { recursive: true });

// Banner principal: dos tamaños en WebP (computador y celular)
const banner = new URL('../imagenes-originales/banner-familia.jpg', import.meta.url).pathname;
for (const ancho of [1600, 900]) {
  const destino = `${salida}banner-familia-${ancho}.webp`;
  await sharp(banner).resize({ width: ancho }).webp({ quality: 78 }).toFile(destino);
  console.log('✔', destino);
}

// Símbolo del logo (sin el nombre), recortado del logo completo con fondo transparente
const logo = new URL('../public/logo-mediconnect.png', import.meta.url).pathname;
const simbolo = sharp(logo).extract({ left: 272, top: 228, width: 490, height: 445 });
await simbolo.clone().resize({ width: 160 }).png().toFile(`${salida}logo-simbolo.png`);
await simbolo.clone().resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(`${salida}favicon.png`);
console.log('✔ símbolo y favicon');

// Color de fondo del banner (borde izquierdo), para rellenar a los lados en pantallas anchas
const { dominant } = await sharp(banner).extract({ left: 0, top: 300, width: 60, height: 800 }).stats();
console.log('Color de fondo del banner:', dominant);

// Mediconnect Bot: el ícono (burbuja con el robot, sin el nombre) para el botón del chat
const bot = new URL('../imagenes-originales/mediconnect-bot.png', import.meta.url).pathname;
const burbuja = sharp(bot).extract({ left: 130, top: 250, width: 1790, height: 1540 });
for (const ancho of [96, 192]) {
  await burbuja.clone().resize(ancho, ancho, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85 }).toFile(`${salida}bot-${ancho}.webp`);
}
console.log('✔ ícono del bot');
