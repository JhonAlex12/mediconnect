-- ============================================================
-- Mediconect: estructura de la base de datos
-- Se puede ejecutar varias veces sin romper nada (IF NOT EXISTS)
-- ============================================================

-- PACIENTES: quien recibe las fórmulas y toma turnos.
-- faltas_seguidas sirve para la regla de 2 o 3 no-shows (RN-11).
-- consentimiento_en guarda cuándo aceptó el tratamiento de sus datos (Ley 1581).
CREATE TABLE IF NOT EXISTS pacientes (
  id                 SERIAL PRIMARY KEY,
  documento          VARCHAR(20)  NOT NULL UNIQUE,
  nombre             VARCHAR(120) NOT NULL,
  telefono           VARCHAR(20),
  faltas_seguidas    INTEGER      NOT NULL DEFAULT 0,
  consentimiento_en  TIMESTAMPTZ,
  creado_en          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- MEDICAMENTOS: catálogo con su stock actual y mínimo.
CREATE TABLE IF NOT EXISTS medicamentos (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL,
  presentacion  VARCHAR(80)  NOT NULL,
  stock_actual  INTEGER      NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo  INTEGER      NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  UNIQUE (nombre, presentacion)
);

-- USUARIOS DE LA FARMACIA: auxiliares y administradores.
-- La contraseña nunca se guarda: solo su versión cifrada (clave_hash).
CREATE TABLE IF NOT EXISTS usuarios_farmacia (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(120) NOT NULL,
  usuario     VARCHAR(40)  NOT NULL UNIQUE,
  clave_hash  TEXT         NOT NULL,
  rol         VARCHAR(20)  NOT NULL CHECK (rol IN ('administrador', 'auxiliar')),
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- FÓRMULAS: llegan desde la IPS (o desde el simulador, según "origen").
CREATE TABLE IF NOT EXISTS formulas (
  id             SERIAL PRIMARY KEY,
  codigo         VARCHAR(20)  NOT NULL UNIQUE,          -- formato F-AAAA-NNNN
  paciente_id    INTEGER      NOT NULL REFERENCES pacientes(id),
  fecha_emision  DATE         NOT NULL,
  fecha_limite   DATE         NOT NULL,
  origen         VARCHAR(20)  NOT NULL DEFAULT 'ips',   -- 'ips' o 'simulador'
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (fecha_limite >= fecha_emision)
);

-- ÍTEMS DE FÓRMULA: cada medicamento de una fórmula con su cantidad.
-- Lo pendiente no se guarda: se calcula (formulada - entregada).
CREATE TABLE IF NOT EXISTS formula_items (
  id                  SERIAL PRIMARY KEY,
  formula_id          INTEGER NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  medicamento_id      INTEGER NOT NULL REFERENCES medicamentos(id),
  cantidad_formulada  INTEGER NOT NULL CHECK (cantidad_formulada > 0),
  cantidad_entregada  INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_entregada >= 0),
  CHECK (cantidad_entregada <= cantidad_formulada)
);

-- TURNOS: una sola fila para turnos virtuales y físicos (RN-05).
-- paciente_id y formula_id pueden ser nulos en un turno físico
-- registrado rápido por el empleado (RN-17).
CREATE TABLE IF NOT EXISTS turnos (
  id                 SERIAL PRIMARY KEY,
  numero             VARCHAR(10)  NOT NULL,             -- V-014, F-010
  fecha              DATE         NOT NULL DEFAULT CURRENT_DATE,
  tipo               VARCHAR(10)  NOT NULL CHECK (tipo IN ('virtual', 'fisico')),
  prioridad          VARCHAR(20)  NOT NULL DEFAULT 'ninguna'
                     CHECK (prioridad IN ('ninguna', 'adulto_mayor', 'embarazada', 'discapacidad')),
  estado             VARCHAR(20)  NOT NULL DEFAULT 'reservado'
                     CHECK (estado IN ('reservado', 'en_camino', 'presente', 'llamado',
                                       'atendido', 'en_pausa', 'vencido', 'cancelado')),
  paciente_id        INTEGER REFERENCES pacientes(id),
  formula_id         INTEGER REFERENCES formulas(id),
  registrado_por     INTEGER REFERENCES usuarios_farmacia(id),  -- solo turnos físicos
  hora_toma          TIMESTAMPTZ NOT NULL DEFAULT now(),
  hora_llegada       TIMESTAMPTZ,
  hora_llamado       TIMESTAMPTZ,
  hora_vencimiento   TIMESTAMPTZ,
  veces_pausado      INTEGER     NOT NULL DEFAULT 0,
  retraso_usado      BOOLEAN     NOT NULL DEFAULT FALSE,        -- "Voy retrasado" solo una vez (RN-13)
  UNIQUE (fecha, numero)
);

-- Un paciente solo puede tener UN turno activo (RF-10).
-- La base de datos lo garantiza aunque el código falle.
CREATE UNIQUE INDEX IF NOT EXISTS un_turno_activo_por_paciente
  ON turnos (paciente_id)
  WHERE estado IN ('reservado', 'en_camino', 'presente', 'llamado', 'en_pausa');

-- RESERVAS: lo apartado del inventario para un turno (RN-12).
CREATE TABLE IF NOT EXISTS reservas (
  id              SERIAL PRIMARY KEY,
  turno_id        INTEGER     NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  medicamento_id  INTEGER     NOT NULL REFERENCES medicamentos(id),
  cantidad        INTEGER     NOT NULL CHECK (cantidad > 0),
  vence_en        TIMESTAMPTZ NOT NULL,
  liberada        BOOLEAN     NOT NULL DEFAULT FALSE
);

-- DISPENSACIONES: cada entrega de medicamentos (total o parcial).
-- Si la recoge otra persona, se guardan sus datos (RN-16).
CREATE TABLE IF NOT EXISTS dispensaciones (
  id                  SERIAL PRIMARY KEY,
  turno_id            INTEGER     NOT NULL REFERENCES turnos(id),
  formula_item_id     INTEGER     NOT NULL REFERENCES formula_items(id),
  cantidad            INTEGER     NOT NULL CHECK (cantidad > 0),
  usuario_id          INTEGER     NOT NULL REFERENCES usuarios_farmacia(id),
  delegado_nombre     VARCHAR(120),
  delegado_documento  VARCHAR(20),
  fecha               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MOVIMIENTOS DE INVENTARIO: historial de cada cambio de stock.
-- usuario_id es nulo cuando el cambio lo hace el sistema.
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id              SERIAL PRIMARY KEY,
  medicamento_id  INTEGER     NOT NULL REFERENCES medicamentos(id),
  tipo            VARCHAR(20) NOT NULL
                  CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'dispensacion')),
  cantidad        INTEGER     NOT NULL,
  usuario_id      INTEGER REFERENCES usuarios_farmacia(id),
  motivo          VARCHAR(200),
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICACIONES: avisos al paciente (una por cambio importante, RN-14).
CREATE TABLE IF NOT EXISTS notificaciones (
  id           SERIAL PRIMARY KEY,
  paciente_id  INTEGER      NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo         VARCHAR(40)  NOT NULL,
  mensaje      TEXT         NOT NULL,
  leida        BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- REGISTRO DE ACCESOS: quién consultó o modificó qué (RNF-05 y Ley 1581).
CREATE TABLE IF NOT EXISTS registro_accesos (
  id           SERIAL PRIMARY KEY,
  usuario_id   INTEGER REFERENCES usuarios_farmacia(id),
  paciente_id  INTEGER REFERENCES pacientes(id),
  accion       VARCHAR(60)  NOT NULL,       -- ej: 'consultar_formula', 'dispensar'
  detalle      TEXT,
  fecha        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índices para que las consultas más frecuentes sean rápidas
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_estado ON turnos (fecha, estado);
CREATE INDEX IF NOT EXISTS idx_reservas_medicamento ON reservas (medicamento_id) WHERE liberada = FALSE;
CREATE INDEX IF NOT EXISTS idx_notificaciones_paciente ON notificaciones (paciente_id, leida);
CREATE INDEX IF NOT EXISTS idx_formula_items_formula ON formula_items (formula_id);

-- ============================================================
-- Paso 10: fila de la farmacia
-- ============================================================

-- Nombre de quien toma un turno físico sin fórmula vinculada (RN-17)
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS nombre_visitante VARCHAR(120);

-- Lugar en la fila: permite reubicar y saltar sin cambiar la hora real de toma
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS orden TIMESTAMPTZ;
UPDATE turnos SET orden = hora_toma WHERE orden IS NULL;
ALTER TABLE turnos ALTER COLUMN orden SET DEFAULT now();
ALTER TABLE turnos ALTER COLUMN orden SET NOT NULL;

-- ============================================================
-- Cobro de la cuota moderadora en ventanilla
-- (el copago por porcentaje queda para una etapa posterior)
-- ============================================================

-- Valor de la cuota moderadora por año y rango de ingreso (IBC):
--   A = menos de 2 SMLMV, B = entre 2 y 5, C = más de 5.
-- La edita el administrador; no está fija en el código.
CREATE TABLE IF NOT EXISTS tarifas_cuota_moderadora (
  anio   INTEGER NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  rango  CHAR(1) NOT NULL CHECK (rango IN ('A', 'B', 'C')),
  valor  INTEGER NOT NULL CHECK (valor >= 0),
  PRIMARY KEY (anio, rango)
);

-- Valores iniciales 2026 (verificar contra la circular oficial y ajustar desde el panel)
INSERT INTO tarifas_cuota_moderadora (anio, rango, valor) VALUES
  (2026, 'A', 5000), (2026, 'B', 20100), (2026, 'C', 52800)
ON CONFLICT (anio, rango) DO NOTHING;

-- Datos de afiliación que envía la IPS con la fórmula.
-- regimen es nulo en fórmulas anteriores a este cambio (no se les cobra).
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS regimen VARCHAR(15)
  CHECK (regimen IN ('contributivo', 'subsidiado'));
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS rango_ingreso CHAR(1)
  CHECK (rango_ingreso IN ('A', 'B', 'C'));
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS eps VARCHAR(80);
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS exencion VARCHAR(30)
  CHECK (exencion IN ('promocion_prevencion', 'control_prenatal', 'alto_costo', 'urgencia'));
-- Valor calculado al recibir la fórmula: no cambia aunque después cambie la tarifa
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS cuota_moderadora INTEGER NOT NULL DEFAULT 0
  CHECK (cuota_moderadora >= 0);

-- PAGOS: la cuota se cobra una sola vez por fórmula (UNIQUE), en la primera entrega.
-- Si después vuelve por lo pendiente, no paga de nuevo.
CREATE TABLE IF NOT EXISTS pagos (
  id          SERIAL PRIMARY KEY,
  formula_id  INTEGER     NOT NULL UNIQUE REFERENCES formulas(id),
  turno_id    INTEGER     NOT NULL REFERENCES turnos(id),
  valor       INTEGER     NOT NULL CHECK (valor > 0),
  medio       VARCHAR(20) NOT NULL CHECK (medio IN ('efectivo', 'transferencia', 'datafono')),
  recibido    INTEGER     CHECK (recibido IS NULL OR recibido >= valor),  -- efectivo entregado por el paciente
  referencia  VARCHAR(40),                                                -- n.º de transferencia o voucher
  usuario_id  INTEGER     NOT NULL REFERENCES usuarios_farmacia(id),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos (fecha);

-- ============================================================
-- Cajas de atención: 1 a 5 generales y 6 preferencial
-- ============================================================
-- Caja en la que se llamó el turno (queda guardada para reportes)
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS caja SMALLINT CHECK (caja BETWEEN 1 AND 6);

-- Un solo turno llamado por caja a la vez
CREATE UNIQUE INDEX IF NOT EXISTS un_llamado_por_caja
  ON turnos (fecha, caja)
  WHERE estado = 'llamado';

-- ============================================================
-- Cuentas de pacientes y domicilios
-- ============================================================

-- CUENTAS DE PACIENTES: el paciente se registra en el sitio con sus datos.
-- Es una tabla aparte de "pacientes" (que llena la IPS): registrarse con un
-- documento NO da acceso a sus fórmulas; cada fórmula se agrega a la cuenta
-- escribiendo su código (ver cuenta_formulas).
CREATE TABLE IF NOT EXISTS cuentas_pacientes (
  id                 SERIAL PRIMARY KEY,
  tipo_documento     VARCHAR(5)   NOT NULL CHECK (tipo_documento IN ('CC', 'TI', 'CE', 'PPT', 'PA', 'RC')),
  documento          VARCHAR(20)  NOT NULL UNIQUE,
  nombres            VARCHAR(80)  NOT NULL,
  apellidos          VARCHAR(80)  NOT NULL,
  fecha_nacimiento   DATE         NOT NULL,
  sexo               CHAR(1)      CHECK (sexo IN ('F', 'M', 'O')),
  celular            VARCHAR(15)  NOT NULL,
  correo             VARCHAR(120) NOT NULL UNIQUE,
  direccion          VARCHAR(150) NOT NULL,
  barrio             VARCHAR(80),
  ciudad             VARCHAR(80)  NOT NULL,
  eps                VARCHAR(80),
  regimen            VARCHAR(15)  CHECK (regimen IN ('contributivo', 'subsidiado')),
  clave_hash         TEXT         NOT NULL,
  consentimiento_en  TIMESTAMPTZ  NOT NULL,      -- aceptó el tratamiento de datos (Ley 1581)
  activa             BOOLEAN      NOT NULL DEFAULT TRUE,
  ultimo_ingreso     TIMESTAMPTZ,
  creado_en          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Fórmulas que el paciente agregó a su cuenta (con código + su documento)
CREATE TABLE IF NOT EXISTS cuenta_formulas (
  cuenta_id    INTEGER     NOT NULL REFERENCES cuentas_pacientes(id) ON DELETE CASCADE,
  formula_id   INTEGER     NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  agregada_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cuenta_id, formula_id)
);

-- DOMICILIOS: el paciente pide que le lleven los medicamentos de una fórmula.
-- La farmacia lo gestiona desde el panel cambiando el estado.
CREATE TABLE IF NOT EXISTS domicilios (
  id              SERIAL PRIMARY KEY,
  cuenta_id       INTEGER      NOT NULL REFERENCES cuentas_pacientes(id),
  formula_id      INTEGER      NOT NULL REFERENCES formulas(id),
  direccion       VARCHAR(150) NOT NULL,
  barrio          VARCHAR(80),
  ciudad          VARCHAR(80)  NOT NULL,
  telefono        VARCHAR(15)  NOT NULL,
  recibe          VARCHAR(120),                 -- quién recibe, si no es el paciente
  indicaciones    VARCHAR(300),
  estado          VARCHAR(20)  NOT NULL DEFAULT 'recibido'
                  CHECK (estado IN ('recibido', 'en_preparacion', 'en_camino', 'entregado', 'cancelado')),
  nota_farmacia   VARCHAR(300),                 -- mensaje de la farmacia al paciente
  actualizado_por INTEGER      REFERENCES usuarios_farmacia(id),
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Un solo domicilio activo por fórmula
CREATE UNIQUE INDEX IF NOT EXISTS un_domicilio_activo_por_formula
  ON domicilios (formula_id)
  WHERE estado IN ('recibido', 'en_preparacion', 'en_camino');
CREATE INDEX IF NOT EXISTS idx_domicilios_estado ON domicilios (estado, creado_en);
CREATE INDEX IF NOT EXISTS idx_domicilios_cuenta ON domicilios (cuenta_id);

-- Actividad de la cuenta del paciente en el mismo registro de accesos
ALTER TABLE registro_accesos ADD COLUMN IF NOT EXISTS cuenta_id INTEGER REFERENCES cuentas_pacientes(id);
CREATE INDEX IF NOT EXISTS idx_registro_cuenta ON registro_accesos (cuenta_id, fecha) WHERE cuenta_id IS NOT NULL;

-- Confirmación del correo de la cuenta (enlace que se envía por correo)
ALTER TABLE cuentas_pacientes ADD COLUMN IF NOT EXISTS correo_verificado_en TIMESTAMPTZ;
ALTER TABLE cuentas_pacientes ADD COLUMN IF NOT EXISTS token_correo_hash TEXT;   -- solo el hash, nunca el token
ALTER TABLE cuentas_pacientes ADD COLUMN IF NOT EXISTS token_correo_vence TIMESTAMPTZ;
