const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', 'mediconect.sqlite');
const db = new DatabaseSync(dbPath);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function inicializarBaseDeDatos() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS pacientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      documento TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      telefono TEXT DEFAULT '3000000000',
      no_shows_seguidos INTEGER DEFAULT 0,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      presentacion TEXT NOT NULL,
      stock_actual INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      paciente_id INTEGER NOT NULL,
      doctor TEXT DEFAULT 'Dr. Carlos Mendoza (IPS)',
      fecha_emision TEXT NOT NULL,
      fecha_limite TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'vigente',
      origen TEXT NOT NULL DEFAULT 'simulador',
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    );

    CREATE TABLE IF NOT EXISTS formula_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formula_id INTEGER NOT NULL,
      medicamento_id INTEGER NOT NULL,
      cantidad_formulada INTEGER NOT NULL,
      cantidad_entregada INTEGER NOT NULL DEFAULT 0,
      cantidad_pendiente INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (formula_id) REFERENCES formulas(id),
      FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
    );

    CREATE TABLE IF NOT EXISTS turnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      tipo TEXT NOT NULL, -- 'virtual' o 'fisico'
      paciente_id INTEGER,
      nombre_paciente TEXT NOT NULL,
      documento_paciente TEXT,
      formula_id INTEGER,
      prioridad TEXT NOT NULL DEFAULT 'Ninguna', -- 'Ninguna', 'Adulto mayor', 'Embarazada', 'Discapacidad'
      estado TEXT NOT NULL DEFAULT 'reservado', -- 'reservado', 'en_camino', 'presente', 'llamado', 'atendido', 'en_pausa', 'vencido', 'cancelado'
      ya_se_retraso INTEGER NOT NULL DEFAULT 0,
      veces_pausado INTEGER NOT NULL DEFAULT 0,
      orden_fila INTEGER NOT NULL DEFAULT 0,
      registrado_por TEXT,
      delegado_nombre TEXT,
      delegado_documento TEXT,
      autorizacion_basica INTEGER DEFAULT 0,
      hora_toma TEXT NOT NULL,
      hora_llegada TEXT,
      hora_llamado TEXT,
      hora_vencimiento TEXT,
      hora_atencion TEXT,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
      FOREIGN KEY (formula_id) REFERENCES formulas(id)
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turno_id INTEGER NOT NULL,
      medicamento_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      vence_en TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (turno_id) REFERENCES turnos(id),
      FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
    );

    CREATE TABLE IF NOT EXISTS dispensaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      turno_id INTEGER NOT NULL,
      formula_item_id INTEGER NOT NULL,
      medicamento_id INTEGER NOT NULL,
      cantidad_entregada INTEGER NOT NULL,
      cantidad_pendiente INTEGER NOT NULL,
      usuario TEXT NOT NULL,
      delegado_info TEXT,
      fecha TEXT NOT NULL,
      FOREIGN KEY (turno_id) REFERENCES turnos(id),
      FOREIGN KEY (formula_item_id) REFERENCES formula_items(id),
      FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
    );

    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicamento_id INTEGER NOT NULL,
      tipo TEXT NOT NULL, -- 'entrada', 'salida', 'ajuste', 'dispensacion', 'demo'
      cantidad INTEGER NOT NULL,
      stock_resultante INTEGER NOT NULL,
      usuario TEXT NOT NULL,
      detalle TEXT,
      fecha TEXT NOT NULL,
      FOREIGN KEY (medicamento_id) REFERENCES medicamentos(id)
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paciente_id INTEGER NOT NULL,
      turno_id INTEGER,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      canal TEXT NOT NULL DEFAULT 'ambos', -- 'interna', 'sms_whatsapp', 'ambos'
      leida INTEGER NOT NULL DEFAULT 0,
      clave_unica TEXT,
      fecha TEXT NOT NULL,
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    );

    CREATE TABLE IF NOT EXISTS usuarios_farmacia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      usuario TEXT UNIQUE NOT NULL,
      clave_hash TEXT NOT NULL,
      rol TEXT NOT NULL, -- 'auxiliar', 'administrador'
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL,
      accion TEXT NOT NULL,
      detalle TEXT,
      fecha TEXT NOT NULL
    );
  `);

  sembrarDatosIniciales();
}

function sembrarDatosIniciales() {
  const countMeds = db.prepare('SELECT COUNT(*) as total FROM medicamentos').get().total;
  if (countMeds > 0) return;

  console.log('Sembrando datos iniciales de demostración en SQLite...');

  // 1. Usuarios de la farmacia (CU-08, CU-10)
  const insertUser = db.prepare(`
    INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol, activo)
    VALUES (?, ?, ?, ?, 1)
  `);
  insertUser.run('Laura Gómez (Auxiliar)', 'auxiliar', hashPassword('123456'), 'auxiliar');
  insertUser.run('Andrés Acevedo (Admin)', 'admin', hashPassword('admin123'), 'administrador');

  // 2. Medicamentos (exactamente como en el wireframe de la página 31 y 27)
  const insertMed = db.prepare(`
    INSERT INTO medicamentos (nombre, presentacion, stock_actual, stock_minimo)
    VALUES (?, ?, ?, ?)
  `);
  insertMed.run('Acetaminofén 500 mg', 'tabletas', 240, 50);
  insertMed.run('Losartán 50 mg', 'tabletas', 18, 40);
  insertMed.run('Metformina 850 mg', 'tabletas', 0, 30);
  insertMed.run('Ibuprofeno 400 mg', 'tabletas', 120, 40);
  insertMed.run('Omeprazol 20 mg', 'cápsulas', 35, 40);

  // 3. Pacientes de prueba (basados en wireframes páginas 26, 27 y 30)
  const insertPac = db.prepare(`
    INSERT INTO pacientes (documento, nombre, telefono, no_shows_seguidos)
    VALUES (?, ?, ?, ?)
  `);
  insertPac.run('1090123456', 'María Fernanda Rojas', '3105551234', 0);
  insertPac.run('1090654321', 'Ana Pérez', '3112223344', 0);
  insertPac.run('1090111222', 'Marta Ruiz', '3123334455', 0);
  insertPac.run('1090333444', 'Pedro Díaz', '3156667788', 0);

  // 4. Fórmulas iniciales (F-2026-0001 lista para probar en Vista del Paciente como en página 27)
  const hoy = new Date();
  const haceUnDia = new Date(hoy.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const enTresDias = new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const enQuinceDias = new Date(hoy.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const insertFormula = db.prepare(`
    INSERT INTO formulas (codigo, paciente_id, doctor, fecha_emision, fecha_limite, estado, origen)
    VALUES (?, ?, ?, ?, ?, 'vigente', 'simulador')
  `);
  const insertItem = db.prepare(`
    INSERT INTO formula_items (formula_id, medicamento_id, cantidad_formulada, cantidad_entregada, cantidad_pendiente)
    VALUES (?, ?, ?, 0, 0)
  `);

  // Fórmula F-2026-0001 (Paciente 1090123456 - vence en 3 días para ver la alerta visual RF-08)
  const f1 = insertFormula.run('F-2026-0001', 1, 'Dr. Carlos Mendoza (IPS)', haceUnDia, enTresDias);
  insertItem.run(f1.lastInsertRowid, 1, 30); // Acetaminofén 500 mg (Disponible)
  insertItem.run(f1.lastInsertRowid, 2, 60); // Losartán 50 mg (Pocas unidades)
  insertItem.run(f1.lastInsertRowid, 3, 60); // Metformina 850 mg (Agotado)

  // Fórmula F-2026-0002 (Paciente Ana Pérez 1090654321)
  const f2 = insertFormula.run('F-2026-0002', 2, 'Dra. Sofía Vargas (IPS)', haceUnDia, enQuinceDias);
  insertItem.run(f2.lastInsertRowid, 1, 20);
  insertItem.run(f2.lastInsertRowid, 4, 30);

  // Fórmula F-2026-0003 (Paciente Marta Ruiz 1090111222)
  const f3 = insertFormula.run('F-2026-0003', 3, 'Dr. Carlos Mendoza (IPS)', haceUnDia, enQuinceDias);
  insertItem.run(f3.lastInsertRowid, 1, 15);
  insertItem.run(f3.lastInsertRowid, 5, 20);

  // 5. Turnos de ejemplo en la fila para que la Pantalla Pública y la Fila se vean vivas desde el inicio (como en página 30 y 32)
  const ahoraISO = hoy.toISOString();
  const venceISO = new Date(hoy.getTime() + 60 * 60 * 1000).toISOString();
  const insertTurno = db.prepare(`
    INSERT INTO turnos (
      numero, tipo, paciente_id, nombre_paciente, documento_paciente, formula_id,
      prioridad, estado, orden_fila, hora_toma, hora_llegada, hora_llamado, hora_vencimiento
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // V-009 Llamado (Ana Pérez - Adulto mayor)
  insertTurno.run('V-009', 'virtual', 2, 'Ana Pérez', '1090654321', 2, 'Adulto mayor', 'llamado', 1, ahoraISO, ahoraISO, ahoraISO, venceISO);
  // F-010 Presente (Luis Gómez - Físico)
  insertTurno.run('F-010', 'fisico', null, 'Luis Gómez', '1090888999', null, 'Ninguna', 'presente', 2, ahoraISO, ahoraISO, null, venceISO);
  // V-011 Presente (Marta Ruiz - Embarazada)
  insertTurno.run('V-011', 'virtual', 3, 'Marta Ruiz', '1090111222', 3, 'Embarazada', 'presente', 3, ahoraISO, ahoraISO, null, venceISO);
  // V-012 En camino (Pedro Díaz)
  insertTurno.run('V-012', 'virtual', 4, 'Pedro Díaz', '1090333444', null, 'Ninguna', 'en_camino', 4, ahoraISO, null, null, venceISO);
  // V-007 En pausa (Juan Mora)
  insertTurno.run('V-007', 'virtual', null, 'Juan Mora', '1090777666', null, 'Ninguna', 'en_pausa', 5, ahoraISO, ahoraISO, ahoraISO, venceISO);
}

module.exports = {
  db,
  hashPassword,
  inicializarBaseDeDatos
};
