// Mediconnect: arranca todo el sistema en este equipo con un solo comando.
// Solo necesita Node.js: trae su propio PostgreSQL (paquete embedded-postgres), así que no hay
// que instalar ni configurar una base de datos. La primera vez descarga las dependencias (internet).
//
//   Windows:       doble clic en "INICIAR-Windows.bat"
//   Mac o Linux:   ./iniciar.sh   (o: node iniciar/iniciar.js)
//
// Los datos quedan en iniciar/datos/. Para empezar de cero, cierre el programa y borre esa carpeta.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const BACKEND = path.join(RAIZ, 'backend');
const FRONTEND = path.join(RAIZ, 'frontend');
const DATOS = path.join(AQUI, 'datos');
const DIR_PG = path.join(DATOS, 'postgres');
const REGISTRO_PG = path.join(DATOS, 'postgres.log');
const ES_WINDOWS = process.platform === 'win32';

// Contraseña de todo el personal de prueba (administrador, médico, cajas y domicilios)
const CLAVE = 'Mediconnect2026';

const paso = (texto) => console.log(`\n>> ${texto}`);
function salirConError(texto, detalle) {
  console.error(`\nNO SE PUDO INICIAR MEDICONNECT\n${texto}`);
  if (detalle) console.error(`\nDetalle técnico: ${detalle}`);
  process.exit(1);
}

// ---------- 0. Comprobaciones ----------
const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor < 22 || (mayor === 22 && menor < 12)) {
  salirConError(`Este equipo tiene Node.js ${process.versions.node} y se necesita la versión 22.12 o superior.\n`
    + 'Instale la versión LTS desde https://nodejs.org y vuelva a abrir el programa.');
}
if (ES_WINDOWS && /\\(Temp|tmp)\\/i.test(RAIZ) && /\.zip/i.test(RAIZ)) {
  salirConError('El programa se abrió desde dentro del archivo .zip.\n'
    + 'Primero extraiga el .zip (clic derecho > "Extraer todo...") y abra INICIAR-Windows.bat desde la carpeta extraída.');
}
// El PostgreSQL de Windows usa la biblioteca de Visual C++ (VCRUNTIME140.dll), que casi todos los
// equipos ya tienen; si falta, la base de datos no arranca
const VC_REDIST = 'https://aka.ms/vs/17/release/vc_redist.x64.exe';
if (ES_WINDOWS && !existsSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'vcruntime140.dll'))) {
  spawn('cmd.exe', ['/c', 'start', '', VC_REDIST], { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
  salirConError('Falta "Microsoft Visual C++ Redistributable" (VCRUNTIME140.dll), que necesita la base de datos.\n'
    + `Se abrió su descarga (${VC_REDIST}): instálelo y vuelva a abrir INICIAR-Windows.bat.`);
}
if (ES_WINDOWS && /[^\x20-\x7e]/.test(RAIZ)) {
  console.warn(`\nAVISO: la carpeta tiene tildes o caracteres especiales:\n  ${RAIZ}\n`
    + 'Si la base de datos no arranca, mueva la carpeta a una ruta simple, por ejemplo C:\\Mediconnect.');
}

// ---------- 1. Dependencias (solo la primera vez) ----------
function npm(args, cwd) {
  const r = spawnSync(ES_WINDOWS ? 'npm.cmd' : 'npm', [...args, '--no-audit', '--no-fund'],
    { cwd, stdio: 'inherit', shell: ES_WINDOWS });
  if (r.status !== 0) {
    salirConError(`Falló "npm ${args.join(' ')}" en ${path.relative(RAIZ, cwd) || '.'}.\n`
      + 'Revise la conexión a internet y vuelva a intentarlo.', r.error?.message);
  }
}

if (!existsSync(path.join(BACKEND, 'node_modules', '.package-lock.json'))) {
  paso('Instalando las dependencias del servidor (solo la primera vez, puede tardar unos minutos)...');
  npm(['ci', '--omit=dev'], BACKEND);
}
if (!existsSync(path.join(AQUI, 'node_modules', 'embedded-postgres'))) {
  paso('Descargando PostgreSQL (solo la primera vez)...');
  npm(['ci'], AQUI);
}
if (!existsSync(path.join(FRONTEND, 'dist', 'index.html'))) {
  paso('Construyendo el sitio web (solo la primera vez)...');
  npm(['ci', '--include=dev'], FRONTEND);
  npm(['run', 'build'], FRONTEND);
}

// ---------- 2. Configuración local (claves aleatorias propias de este equipo) ----------
mkdirSync(DATOS, { recursive: true });
const ARCHIVO_CONFIG = path.join(DATOS, 'config.json');
let config = existsSync(ARCHIVO_CONFIG) ? JSON.parse(readFileSync(ARCHIVO_CONFIG, 'utf8')) : null;
if (!config) {
  config = {
    puertoBd: 54329,
    claveBd: randomBytes(12).toString('hex'),
    jwt: randomBytes(48).toString('hex'),
    ipsApiKey: randomBytes(24).toString('hex'),
  };
}
const guardarConfig = () => writeFileSync(ARCHIVO_CONFIG, JSON.stringify(config, null, 2));
guardarConfig();

function puertoLibre(puerto) {
  return new Promise((resolve) => {
    const s = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => s.close(() => resolve(true)))
      .listen(puerto, '127.0.0.1');
  });
}
async function buscarPuerto(desde, cuantos = 20) {
  for (let p = desde; p < desde + cuantos; p++) if (await puertoLibre(p)) return p;
  return null;
}

// ---------- 3. Base de datos PostgreSQL propia ----------
const { default: pg } = await import('pg');
const { default: EmbeddedPostgres } = await import('embedded-postgres');
// embedded-postgres apaga la base apenas llega Ctrl+C, antes que el servidor (que aún la usa).
// Se quitan esos manejadores: el cierre ordenado de abajo apaga primero el servidor y luego la base.
for (const evento of ['SIGINT', 'SIGTERM', 'exit', 'beforeExit']) process.removeAllListeners(evento);

const urlBd = (base) => `postgres://postgres:${config.claveBd}@127.0.0.1:${config.puertoBd}/${base}`;
async function bdResponde() {
  const c = new pg.Client({ connectionString: urlBd('postgres'), connectionTimeoutMillis: 3000 });
  c.on('error', () => {});
  try {
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}

paso('Iniciando la base de datos...');
let bd = null;
if (await bdResponde()) {
  console.log('   La base de datos ya estaba encendida (de una vez anterior): se reutiliza.');
} else {
  if (!(await puertoLibre(config.puertoBd))) {
    // El puerto lo ocupa otro programa: se usa otro y se recuerda
    config.puertoBd = await buscarPuerto(config.puertoBd + 1);
    if (!config.puertoBd) salirConError('No hay un puerto libre para la base de datos.');
    guardarConfig();
  }
  const ultimasLineas = [];
  bd = new EmbeddedPostgres({
    databaseDir: DIR_PG,
    port: config.puertoBd,
    user: 'postgres',
    password: config.claveBd,
    persistent: true,
    autoRehydrateSymlinks: true,   // por si npm no ejecutó los scripts de instalación
    initdbFlags: ['--encoding=UTF8'],
    onLog: (m) => {
      appendFileSync(REGISTRO_PG, m);
      ultimasLineas.push(m);
      if (ultimasLineas.length > 15) ultimasLineas.shift();
    },
    onError: (e) => appendFileSync(REGISTRO_PG, `[error] ${e?.message ?? e}\n`),
  });
  try {
    if (!existsSync(path.join(DIR_PG, 'PG_VERSION'))) {
      console.log('   Primera vez: creando la base de datos...');
      await bd.initialise();
    }
    await bd.start();
  } catch (error) {
    salirConError('La base de datos no arrancó. Las últimas líneas de su registro '
      + `(completo en ${path.relative(RAIZ, REGISTRO_PG)}):\n${ultimasLineas.join('').trim()}`, error?.message);
  }
}

// Base "mediconect" (si no existe)
{
  const c = new pg.Client({ connectionString: urlBd('postgres') });
  await c.connect();
  const { rowCount } = await c.query(`SELECT 1 FROM pg_database WHERE datname = 'mediconect'`);
  if (!rowCount) await c.query(`CREATE DATABASE mediconect ENCODING 'UTF8' TEMPLATE template0`);
  await c.end();
}

// ---------- 4. Tablas, datos iniciales y datos de demostración ----------
const puertoWeb = (await puertoLibre(3000)) ? 3000 : await buscarPuerto(3001);
if (!puertoWeb) salirConError('No hay un puerto libre para el sitio web (3000 a 3020 ocupados).');
const URL = `http://localhost:${puertoWeb}`;

// Variables del servidor. Se fijan todas aquí (aunque estén vacías) para que no las cambie
// un archivo backend/.env ni una variable del sistema.
const entorno = {
  ...process.env,
  PORT: String(puertoWeb),
  DATABASE_URL: urlBd('mediconect'),
  DATABASE_SSL: 'false',
  JWT_SECRET: config.jwt,
  IPS_API_KEY: config.ipsApiKey,
  ADMIN_USUARIO: 'admin',
  ADMIN_CLAVE: CLAVE,
  MEDICO_USUARIO: 'doctor',
  MEDICO_CLAVE: CLAVE,
  DEMO_CLAVE: CLAVE,
  MODO_DEMO: 'true',
  URL_SITIO: URL,
  URL_SITIO_ARCHIVO: '',
  SMTP_HOST: '', SMTP_PORT: '', SMTP_USUARIO: '', SMTP_CLAVE: '', CORREO_REMITENTE: '',
  VAPID_PUBLICA: '', VAPID_PRIVADA: '', VAPID_CONTACTO: '',
};

function correrScript(nombre, archivo) {
  const r = spawnSync(process.execPath, [path.join('src', 'db', archivo)], { cwd: BACKEND, env: entorno, stdio: 'inherit' });
  if (r.status !== 0) salirConError(`Falló el paso "${nombre}" (mensajes de arriba).`);
}
paso('Preparando las tablas y los datos de prueba...');
correrScript('crear tablas', 'migrate.js');
correrScript('datos iniciales', 'seed.js');
correrScript('datos de demostración', 'demo.js');

// ---------- 5. Servidor web ----------
let servidor = null;
// Cierre ordenado: Ctrl+C detiene el servidor y luego la base de datos
let cerrando = false;
async function cerrar(codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  console.log('\nCerrando Mediconnect...');
  if (servidor && servidor.exitCode === null) {
    servidor.kill('SIGINT');
    await new Promise((r) => { servidor.once('exit', r); setTimeout(r, 8000); });
  }
  if (bd) await bd.stop().catch(() => {});
  process.exit(codigo);
}
process.on('SIGINT', () => cerrar(0));
process.on('SIGTERM', () => cerrar(0));

paso('Iniciando el servidor...');
servidor = spawn(process.execPath, [path.join('src', 'server.js')], { cwd: BACKEND, env: entorno, stdio: 'inherit' });
servidor.on('exit', async (codigo) => {
  if (!cerrando) {
    console.error(`\nEl servidor se detuvo (código ${codigo}).`);
    await cerrar(1);
  }
});

async function esperarServidor(segundos = 60) {
  for (let i = 0; i < segundos * 2; i++) {
    try {
      const r = await fetch(`${URL}/api/salud`);
      if (r.ok) return true;
    } catch { /* todavía no responde */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
if (!(await esperarServidor())) salirConError('El servidor no respondió en 60 segundos (mensajes de arriba).');

const fila = (a, b, c = '') => `  ${a.padEnd(30)} ${b.padEnd(34)} ${c}`;
console.log(`
==============================================================================
  MEDICONNECT ESTÁ FUNCIONANDO  ->  ${URL}
==============================================================================
${fila('Qué', 'Dirección', 'Usuario / contraseña')}
${fila('Sitio del paciente', `${URL}/`)}
${fila('Consultar fórmula y turno', `${URL}/paciente`, 'cédula 1090000001')}
${fila('Cuenta de paciente', `${URL}/mi-cuenta`, `1090000001 / Paciente2026`)}
${fila('Panel de la farmacia', `${URL}/farmacia`, `admin / ${CLAVE}`)}
${fila('  (cajas y domicilios)', '', `caja1, caja2, preferencial,`)}
${fila('', '', `domicilios, domiciliario / ${CLAVE}`)}
${fila('Sistema de la IPS (médico)', `${URL}/ips/`, `doctor / ${CLAVE}`)}
${fila('Pantalla de la sala', `${URL}/pantalla`)}
${fila('Kiosco de turnos', `${URL}/kiosco`, '(se activa desde el panel)')}

  Para cerrar Mediconnect: presione Ctrl+C en esta ventana (o ciérrela).
==============================================================================
`);

if (!process.env.NO_ABRIR_NAVEGADOR) {
  const [cmd, args] = ES_WINDOWS ? ['cmd.exe', ['/c', 'start', '', URL]]
    : process.platform === 'darwin' ? ['open', [URL]] : ['xdg-open', [URL]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
  } catch { /* sin navegador: se abre a mano */ }
}
