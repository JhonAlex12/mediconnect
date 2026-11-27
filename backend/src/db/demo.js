import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from './pool.js';
import { crearUsuario } from '../services/usuarios.service.js';
import { emitirFormula } from '../services/simulador.service.js';
import { ZONA_HORARIA } from '../config/negocio.js';

// Datos de demostración para probar el sistema en un equipo (npm run db:demo).
// Solo con MODO_DEMO=true. Todos los datos son ficticios. Se puede repetir: lo que ya existe no se toca.
if (process.env.MODO_DEMO !== 'true') {
  console.log('Datos de demostración: se omiten (MODO_DEMO no es "true").');
  process.exit(0);
}

// Misma contraseña para todo el personal de prueba (mínimo 10 caracteres, con letras y números)
const CLAVE_PERSONAL = process.env.DEMO_CLAVE || 'Mediconnect2026';
const CLAVE_PACIENTE = process.env.DEMO_CLAVE_PACIENTE || 'Paciente2026';

const { rows: [admin] } = await pool.query(
  `SELECT id FROM usuarios_farmacia WHERE rol = 'administrador' ORDER BY id LIMIT 1`);
if (!admin) {
  console.error('Datos de demostración: primero hay que crear el administrador (npm run db:seed).');
  process.exit(1);
}

// ---------- 1. Personal de la farmacia ----------
const PERSONAL = [
  { nombre: 'Laura Gómez (caja 1)', usuario: 'caja1', rol: 'auxiliar', caja: 1 },
  { nombre: 'Andrés Pérez (caja 2)', usuario: 'caja2', rol: 'auxiliar', caja: 2 },
  { nombre: 'Rosa Duarte (caja preferencial)', usuario: 'preferencial', rol: 'auxiliar', caja: 6 },
  { nombre: 'Marta Rincón (domicilios)', usuario: 'domicilios', rol: 'domicilios' },
  { nombre: 'Carlos Ortega (domiciliario)', usuario: 'domiciliario', rol: 'domiciliario' },
];
for (const p of PERSONAL) {
  try {
    await crearUsuario({ ...p, clave: CLAVE_PERSONAL }, admin);
  } catch (error) {
    if (error.estado !== 409) throw error;   // ya existe
  }
}

// ---------- 2. Cuenta de paciente (con el correo ya confirmado, para poder pedir domicilios) ----------
await pool.query(
  `INSERT INTO cuentas_pacientes
     (tipo_documento, documento, nombres, apellidos, fecha_nacimiento, sexo, celular, correo,
      direccion, barrio, ciudad, eps, regimen, clave_hash, consentimiento_en, correo_verificado_en)
   VALUES ('CC', '1090000001', 'Ana María', 'Suárez Rojas', '1985-04-12', 'F', '3001234567',
           'ana.suarez@example.com', 'Calle 10 # 5-20', 'Centro', 'Cúcuta', 'Nueva EPS', 'contributivo',
           $1, now(), now())
   ON CONFLICT (documento) DO NOTHING`,
  [await bcrypt.hash(CLAVE_PACIENTE, 10)]
);

// ---------- 3. Fórmulas de pacientes ficticios ----------
const { rows: [{ total }] } = await pool.query('SELECT count(*)::int AS total FROM formulas');
if (total === 0) {
  const { rows: [{ hoy }] } = await pool.query(
    `SELECT to_char((now() AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS hoy`, [ZONA_HORARIA]);
  const dias = (n) => {
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Medicamentos con existencias y uno agotado (para ver el aviso de "no disponible")
  const { rows: conStock } = await pool.query(
    'SELECT id FROM medicamentos WHERE activo AND stock_actual >= 30 ORDER BY id LIMIT 24');
  const { rows: [agotado] } = await pool.query(
    'SELECT id FROM medicamentos WHERE activo AND stock_actual = 0 ORDER BY id LIMIT 1');
  const med = (i, cantidad) => ({ medicamento_id: conStock[i % conStock.length].id, cantidad });

  const INDICACIONES = 'Tomar con agua después de las comidas. Si presenta molestias, consulte a su médico.';
  const FORMULAS = [
    { documento: '1090000001', nombre: 'Ana María Suárez Rojas', regimen: 'contributivo', rango_ingreso: 'A',
      eps: 'Nueva EPS', medicamentos: [med(0, 30), med(1, 10)], limite: 30 },
    { documento: '1090000001', nombre: 'Ana María Suárez Rojas', regimen: 'contributivo', rango_ingreso: 'A',
      eps: 'Nueva EPS', medicamentos: [med(2, 20)], limite: 20 },
    { documento: '1090000002', nombre: 'Jorge Enrique Castro Leal', regimen: 'subsidiado', eps: 'Coosalud',
      medicamentos: [med(3, 30), med(4, 15), med(5, 10)], limite: 30 },
    { documento: '1090000003', nombre: 'Luz Marina Ortiz Vera', regimen: 'contributivo', rango_ingreso: 'B',
      eps: 'Sanitas', medicamentos: [med(6, 20)], limite: 30 },
    { documento: '1090000004', nombre: 'Pedro Antonio Villamizar Gil', regimen: 'contributivo', rango_ingreso: 'C',
      eps: 'Sura', medicamentos: [med(7, 60), med(8, 30)], limite: 30 },
    { documento: '1090000005', nombre: 'Sofía Daniela Peña Ríos', regimen: 'contributivo', rango_ingreso: 'A',
      eps: 'Nueva EPS', exencion: 'control_prenatal', medicamentos: [med(9, 30)], limite: 30 },
    { documento: '1090000006', nombre: 'Miguel Ángel Rojas Mendoza', regimen: 'subsidiado', eps: 'Coosalud',
      medicamentos: agotado ? [med(10, 10), { medicamento_id: agotado.id, cantidad: 5 }] : [med(10, 10)], limite: 30 },
    { documento: '1090000007', nombre: 'Diana Carolina Parra Silva', regimen: 'contributivo', rango_ingreso: 'B',
      eps: 'Sanitas', medicamentos: [med(11, 14)], limite: 2 },   // vence en 2 días: muestra la alerta
    { documento: '1090000008', nombre: 'Luis Fernando Mora Quintero', regimen: 'subsidiado', eps: 'Asmet Salud',
      medicamentos: [med(12, 30), med(13, 30)], limite: 30 },
  ];
  for (const { limite, ...f } of FORMULAS) {
    await emitirFormula(
      { ...f, fecha_emision: hoy, fecha_limite: dias(limite), indicaciones: INDICACIONES },
      { puedeCorregirAfiliacion: true }
    );
  }
  console.log(`Datos de demostración: ${FORMULAS.length} fórmulas de prueba creadas.`);
}

console.log('Datos de demostración listos (personal, cuenta de paciente y fórmulas).');
await pool.end();
