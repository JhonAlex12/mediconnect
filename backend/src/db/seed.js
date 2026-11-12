import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from './pool.js';
import { MEDICAMENTOS_COMUNES } from './medicamentos-comunes.js';

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

// ---------- 2. Catálogo de medicamentos ----------
// Los 100 de uso más frecuente (src/db/medicamentos-comunes.js). Si ya existe, no se toca.
// Con MODO_DEMO=true llegan con stock de prueba (algunos agotados o bajo el mínimo, para ver
// los estados); sin modo demo llegan en 0 y el stock real se carga desde el panel.
const demo = process.env.MODO_DEMO === 'true';
for (const [i, [nombre, presentacion, minimo]] of MEDICAMENTOS_COMUNES.entries()) {
  let stock = 0;
  if (demo) {
    if (i % 23 === 7) stock = 0;                                // agotado
    else if (i % 9 === 4) stock = Math.floor(minimo / 2);       // bajo el mínimo
    else stock = minimo * (2 + (i % 4));                        // normal
  }
  await pool.query(
    `INSERT INTO medicamentos (nombre, presentacion, stock_actual, stock_minimo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (nombre, presentacion) DO NOTHING`,
    [nombre, presentacion, stock, minimo]
  );
}

// ---------- 3. Médico de prueba (solo con MODO_DEMO=true) ----------
// Entra al sistema de la IPS de prueba (/ips/) para emitir fórmulas; no ve el panel de la farmacia.
if (process.env.MODO_DEMO === 'true') {
  const usuarioMedico = process.env.MEDICO_USUARIO || 'doctor';
  const claveMedico = process.env.MEDICO_CLAVE || 'Doctor123';
  await pool.query(
    `INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol)
     VALUES ($1, $2, $3, 'medico')
     ON CONFLICT (usuario) DO NOTHING`,
    ['Médico de turno', usuarioMedico, await bcrypt.hash(claveMedico, 10)]
  );
}

console.log('Datos iniciales cargados.');
await pool.end();