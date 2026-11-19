// Emergencia: libera la cuenta de un empleado y cierra su sesión abierta, por si quedó tomada
// y no se puede entrar (por ejemplo, otra persona entró con la cuenta del único administrador).
//   npm run sesion:liberar -- admin
// Después conviene cambiar la contraseña de esa cuenta.
import { pool } from './pool.js';

const usuario = process.argv[2]?.trim().toLowerCase();
if (!usuario) {
  console.error('Uso: npm run sesion:liberar -- <usuario>');
  process.exit(1);
}
try {
  const { rows: [u] } = await pool.query(
    `UPDATE usuarios_farmacia SET equipo_sesion = NULL, version_sesion = version_sesion + 1
      WHERE usuario = $1 RETURNING id`,
    [usuario]
  );
  if (!u) {
    console.error(`No existe el usuario "${usuario}".`);
    process.exitCode = 1;
  } else {
    await pool.query(
      `INSERT INTO registro_accesos (usuario_id, accion, detalle) VALUES ($1, 'liberar_sesion', 'desde el servidor')`,
      [u.id]
    );
    console.log(`Listo: se cerró la sesión de "${usuario}" y ya se puede entrar con esa cuenta.`);
  }
} finally {
  await pool.end();
}
