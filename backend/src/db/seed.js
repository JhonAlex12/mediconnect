import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from './pool.js';

// ---------- 1. Usuario administrador ----------
const usuario = process.env.ADMIN_USUARIO;
const clave = process.env.ADMIN_CLAVE;

if (!usuario || !clave) {
  console.error('Faltan ADMIN_USUARIO y ADMIN_CLAVE en el archivo .env');
  process.exit(1);
}

// bcrypt convierte la clave en un texto cifrado que no se puede revertir.
// El 10 es el "costo": más alto = más seguro pero más lento.
const claveCifrada = await bcrypt.hash(clave, 10);

// ON CONFLICT DO NOTHING: si el usuario ya existe, no lo duplica
await pool.query(
  `INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol)
   VALUES ($1, $2, $3, 'administrador')
   ON CONFLICT (usuario) DO NOTHING`,
  ['Administrador', usuario, claveCifrada]
);

// ---------- 2. Medicamentos de desarrollo ----------
// Datos de prueba para trabajar; el stock real se carga desde el panel.
// Hay uno agotado y dos bajo el mínimo para probar los estados.
const medicamentos = [
  ['Acetaminofén', '500 mg tabletas', 240, 50],
  ['Losartán',     '50 mg tabletas',   18, 40],
  ['Metformina',   '850 mg tabletas',   0, 30],
  ['Ibuprofeno',   '400 mg tabletas', 120, 40],
  ['Omeprazol',    '20 mg cápsulas',   35, 40],
];

for (const [nombre, presentacion, stock, minimo] of medicamentos) {
  await pool.query(
    `INSERT INTO medicamentos (nombre, presentacion, stock_actual, stock_minimo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (nombre, presentacion) DO NOTHING`,
    [nombre, presentacion, stock, minimo]
  );
}

console.log('Datos iniciales cargados.');
await pool.end();