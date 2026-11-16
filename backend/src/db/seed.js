import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from './pool.js';
import { MEDICAMENTOS_COMUNES } from './medicamentos-comunes.js';
import { validarClave } from '../services/usuarios.service.js';

// La misma regla que al crear usuarios desde el panel: mínimo 10 caracteres, con letras y números
const REGLA_CLAVE = 'mínimo 10 caracteres, con letras y números, sin espacios';
const claveSegura = (valor) => {
  try {
    validarClave(valor);
    return true;
  } catch {
    return false;
  }
};
const buscarUsuario = async (nombreUsuario) => {
  const { rows: [u] } = await pool.query(
    'SELECT id, clave_hash FROM usuarios_farmacia WHERE usuario = $1', [nombreUsuario]);
  return u ?? null;
};

// ---------- 1. Usuario administrador ----------
const usuario = process.env.ADMIN_USUARIO;
const clave = process.env.ADMIN_CLAVE;

if (!usuario || !clave) {
  console.error('Faltan ADMIN_USUARIO y ADMIN_CLAVE en el archivo .env');
  process.exit(1);
}

// La contraseña solo se usa para crear al administrador la primera vez; después se cambia en el panel.
const admin = await buscarUsuario(usuario);
if (!admin) {
  if (!claveSegura(clave)) {
    console.error(`ADMIN_CLAVE no es segura: ${REGLA_CLAVE}. No se creó el administrador.`);
    process.exit(1);
  }
  // bcrypt convierte la clave en un texto cifrado que no se puede revertir.
  // El 10 es el "costo": más alto = más seguro pero más lento.
  await pool.query(
    `INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol)
     VALUES ($1, $2, $3, 'administrador')
     ON CONFLICT (usuario) DO NOTHING`,
    ['Administrador', usuario, await bcrypt.hash(clave, 10)]
  );
} else if (!claveSegura(clave) && await bcrypt.compare(clave, admin.clave_hash)) {
  console.warn(`AVISO DE SEGURIDAD: "${usuario}" sigue con una contraseña débil. Cámbiela en el panel (Usuarios): ${REGLA_CLAVE}.`);
}

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
// No tiene contraseña por defecto: sin MEDICO_CLAVE no se crea.
if (demo) {
  const usuarioMedico = process.env.MEDICO_USUARIO || 'doctor';
  const claveMedico = process.env.MEDICO_CLAVE;
  const medico = await buscarUsuario(usuarioMedico);
  // Contraseña que traían las versiones anteriores: si sigue puesta, se reemplaza
  const conClaveAntigua = medico ? await bcrypt.compare('Doctor123', medico.clave_hash) : false;

  if (!claveSegura(claveMedico)) {
    if (!medico) {
      console.warn(`No se creó el médico de prueba: falta MEDICO_CLAVE (${REGLA_CLAVE}).`);
    } else if (conClaveAntigua) {
      console.warn(`AVISO DE SEGURIDAD: "${usuarioMedico}" sigue con la contraseña por defecto. Defina MEDICO_CLAVE (${REGLA_CLAVE}).`);
    }
  } else if (!medico) {
    await pool.query(
      `INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol)
       VALUES ($1, $2, $3, 'medico')
       ON CONFLICT (usuario) DO NOTHING`,
      ['Médico de turno', usuarioMedico, await bcrypt.hash(claveMedico, 10)]
    );
  } else if (conClaveAntigua) {
    await pool.query('UPDATE usuarios_farmacia SET clave_hash = $2 WHERE id = $1',
      [medico.id, await bcrypt.hash(claveMedico, 10)]);
    console.log(`Se reemplazó la contraseña por defecto de "${usuarioMedico}" por MEDICO_CLAVE.`);
  }
}

console.log('Datos iniciales cargados.');
await pool.end();