// Genera las imágenes livianas que usa el sitio a partir de los originales.
// Uso: npm run imagenes
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const salida = new URL('../public/img/', import.meta.url).pathname;
await mkdir(salida, { recursive: true });

// Símbolo del logo (sin el nombre), recortado del logo completo con fondo transparente
const logo = new URL('../public/logo-mediconnect.png', import.meta.url).pathname;
const simbolo = sharp(logo).extract({ left: 272, top: 228, width: 490, height: 445 });
await simbolo.clone().resize({ width: 160 }).png().toFile(`${salida}logo-simbolo.png`);
await simbolo.clone().resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(`${salida}favicon.png`);
console.log('✔ símbolo y favicon');
