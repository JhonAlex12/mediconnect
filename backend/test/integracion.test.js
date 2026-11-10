// TEST_DATABASE_URL debe apuntar a PostgreSQL de pruebas. Cada ejecución usa
// un esquema aislado que elimina al terminar; nunca usa DATABASE_URL del proyecto.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import http from 'node:http';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { io as clienteSocket } from 'socket.io-client';

test('entregas y permisos en tiempo real', { timeout: 30000 }, async (t) => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Configura TEST_DATABASE_URL para ejecutar la integración');
  const esquema = `regresion_${process.pid}_${Date.now()}`;
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${esquema}`);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${esquema}`);
  process.env.DATABASE_URL = url.toString();
  process.env.DATABASE_SSL = 'false';
  process.env.JWT_SECRET = 'secreto-exclusivo-de-las-pruebas';
  const { pool } = await import('../src/db/pool.js');
  t.after(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA ${esquema} CASCADE`);
    await admin.end();
  });
  const schema = await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  // Las migraciones deben poder repetirse durante el arranque.
  await pool.query(schema);
  const { cambiarEstadoDomicilio, domiciliosFarmacia, solicitarDomicilio } = await import('../src/services/cuentas.service.js');
  const { dispensar } = await import('../src/services/dispensacion.service.js');
  const { iniciarSockets } = await import('../src/sockets/index.js');
  const { emitir } = await import('../src/sockets/emisor.js');
  const { editarUsuario } = await import('../src/services/usuarios.service.js');

  async function preparar() {
    await pool.query(`TRUNCATE pacientes, cuentas_pacientes, usuarios_farmacia, medicamentos RESTART IDENTITY CASCADE`);
    await pool.query(`
      INSERT INTO usuarios_farmacia (nombre, usuario, clave_hash, rol) VALUES
        ('Admin','admin','hash','administrador'), ('Auxiliar','aux','hash','auxiliar'), ('Pedidos','pedidos','hash','domicilios');
      INSERT INTO pacientes (documento, nombre) VALUES ('123456','Paciente prueba');
      INSERT INTO medicamentos (nombre, presentacion, stock_actual, stock_minimo) VALUES ('Prueba','Tabletas',20,1);
      INSERT INTO formulas (codigo, paciente_id, fecha_emision, fecha_limite, regimen, cuota_moderadora)
        VALUES ('F-2026-0001',1,CURRENT_DATE,CURRENT_DATE + 5,'contributivo',5000);
      INSERT INTO formula_items (formula_id, medicamento_id, cantidad_formulada) VALUES (1,1,10);
      INSERT INTO cuentas_pacientes (tipo_documento, documento, nombres, apellidos, fecha_nacimiento,
        celular, correo, direccion, ciudad, clave_hash, consentimiento_en, correo_verificado_en)
        VALUES ('CC','123456','Paciente','Prueba','1990-01-01','3001234567','prueba@example.test','Calle 10','Cúcuta','hash',now(),now());
      INSERT INTO cuenta_formulas (cuenta_id,formula_id) VALUES (1,1);
      INSERT INTO domicilios (cuenta_id,formula_id,direccion,ciudad,telefono,estado,costo_envio)
        VALUES (1,1,'Calle 10','Cúcuta','3001234567','en_preparacion',3000);
    `);
  }
  const despacho = (cantidad = 10) => ({ estado: 'en_camino', items: [{ formula_item_id: 1, cantidad }] });
  const entrega = (cantidad = 10) => ({ estado: 'entregado',
    items: [{ formula_item_id: 1, cantidad }], pago: { medio: 'efectivo', recibido: 10000 } });
  const fila = async (tabla) => (await pool.query(`SELECT * FROM ${tabla} ORDER BY 1`)).rows[0];
  const filas = async (tabla) => (await pool.query(`SELECT * FROM ${tabla} ORDER BY 1`)).rows;
  const cuenta = async (tabla) => (await pool.query(`SELECT * FROM ${tabla}`)).rowCount;
  const nuevoPedido = () => solicitarDomicilio(1, { codigo: 'F-2026-0001', direccion: 'Calle 10',
    barrio: 'Centro', ciudad: 'Cúcuta', telefono: '3001234567' });

  await t.test('despachar descuenta el stock de inmediato y saca lo despachado de lo pendiente', async () => {
    await preparar();
    await cambiarEstadoDomicilio(3, 1, despacho());
    assert.equal((await fila('medicamentos')).stock_actual, 10);
    assert.equal((await fila('formula_items')).cantidad_entregada, 10);
    assert.equal((await fila('domicilios')).estado, 'en_camino');
    assert.deepEqual((await filas('domicilio_items')).map((r) => [r.despachada, r.entregada]), [[10, null]]);
    assert.equal((await fila('movimientos_inventario')).cantidad, -10);
    assert.equal(await cuenta('dispensaciones'), 0);
    assert.equal(await cuenta('pagos'), 0);
    const [d] = await domiciliosFarmacia({ estado: 'activos' });
    assert.equal(d.despacho[0].despachada, 10);
    assert.equal(d.medicamentos, null);
  });
  await t.test('entrega completa: dispensación, cuota y recibo; impide otro pedido', async () => {
    await preparar();
    await cambiarEstadoDomicilio(3, 1, despacho());
    await cambiarEstadoDomicilio(3, 1, entrega());
    assert.equal((await fila('medicamentos')).stock_actual, 10);
    assert.equal((await fila('formula_items')).cantidad_entregada, 10);
    assert.equal((await fila('domicilios')).estado, 'entregado');
    assert.equal((await fila('dispensaciones')).domicilio_id, 1);
    assert.equal((await fila('pagos')).valor, 5000);
    assert.equal(await cuenta('movimientos_inventario'), 1);
    const [d] = await domiciliosFarmacia({ estado: 'entregado' });
    assert.equal(d.cobro.total, 8000);
    assert.equal(d.cobro.recibido, 10000);
    assert.equal(d.despacho[0].entregada, 10);
    await assert.rejects(nuevoPedido(), /entregada completa/);
  });
  await t.test('entrega parcial: lo no entregado vuelve al inventario y el resto se cobra sin repetir la cuota', async () => {
    await preparar();
    await cambiarEstadoDomicilio(3, 1, despacho());
    await cambiarEstadoDomicilio(3, 1, entrega(4));
    assert.equal((await fila('medicamentos')).stock_actual, 16);
    assert.equal((await fila('formula_items')).cantidad_entregada, 4);
    assert.equal((await fila('dispensaciones')).cantidad, 4);
    assert.deepEqual((await filas('movimientos_inventario')).map((m) => [m.tipo, m.cantidad]),
      [['dispensacion', -10], ['devolucion', 6]]);
    const segundo = await nuevoPedido();
    await cambiarEstadoDomicilio(3, segundo.id, { estado: 'en_preparacion' });
    await cambiarEstadoDomicilio(3, segundo.id, despacho(6));
    await cambiarEstadoDomicilio(3, segundo.id, { ...entrega(6), pago: { medio: 'transferencia', referencia: 'REF-2' } });
    assert.equal(await cuenta('pagos'), 1);
    assert.deepEqual((await pool.query('SELECT cuota FROM cobros_domicilio ORDER BY domicilio_id')).rows.map((r) => r.cuota), [5000, 0]);
    assert.equal((await fila('formula_items')).cantidad_entregada, 10);
    assert.equal((await fila('medicamentos')).stock_actual, 10);
  });
  await t.test('cancelar un pedido despachado devuelve todo al inventario y permite pedir de nuevo', async () => {
    await preparar();
    await cambiarEstadoDomicilio(3, 1, despacho());
    await cambiarEstadoDomicilio(3, 1, { estado: 'cancelado', nota: 'No había nadie en casa' });
    assert.equal((await fila('medicamentos')).stock_actual, 20);
    assert.equal((await fila('formula_items')).cantidad_entregada, 0);
    assert.equal((await fila('domicilio_items')).entregada, 0);
    assert.equal(await cuenta('dispensaciones'), 0);
    assert.equal(await cuenta('pagos'), 0);
    await nuevoPedido();
  });
  await t.test('cancelar antes de despachar no mueve el inventario', async () => {
    await preparar();
    await cambiarEstadoDomicilio(3, 1, { estado: 'cancelado' });
    assert.equal((await fila('medicamentos')).stock_actual, 20);
    assert.equal(await cuenta('movimientos_inventario'), 0);
  });
  await t.test('rechaza despachos y entregas con cantidades inválidas o pagos incompletos', async () => {
    await preparar();
    for (const datos of [
      { ...despacho(), items: [] }, despacho(0), despacho(-1), despacho(1.5), despacho(11),
      { ...despacho(), items: [...despacho().items, ...despacho().items] },
      { ...despacho(), items: [{ formula_item_id: 999, cantidad: 1 }] },
    ]) await assert.rejects(cambiarEstadoDomicilio(3, 1, datos));
    assert.equal((await fila('medicamentos')).stock_actual, 20);
    assert.equal(await cuenta('domicilio_items'), 0);

    await cambiarEstadoDomicilio(3, 1, despacho());
    for (const datos of [
      { ...entrega(), items: [] }, entrega(11), entrega(0), entrega(-1),
      { ...entrega(), items: [...entrega().items, ...entrega().items] },
      { ...entrega(), items: [{ formula_item_id: 999, cantidad: 1 }] },
      { ...entrega(), pago: undefined }, { ...entrega(), pago: { medio: 'efectivo', recibido: 7999 } },
      { ...entrega(), pago: { medio: 'transferencia', referencia: '' } },
    ]) await assert.rejects(cambiarEstadoDomicilio(3, 1, datos));
    assert.equal((await fila('medicamentos')).stock_actual, 10);
    assert.equal((await fila('formula_items')).cantidad_entregada, 10);
    assert.equal(await cuenta('cobros_domicilio'), 0);
    assert.equal(await cuenta('dispensaciones'), 0);
  });
  await t.test('al despachar respeta las reservas y rechaza fórmulas vencidas', async () => {
    await preparar();
    await pool.query(`INSERT INTO turnos (numero,tipo,paciente_id,formula_id) VALUES ('V-001','virtual',1,1);
      INSERT INTO reservas (turno_id,medicamento_id,cantidad,vence_en) VALUES (1,1,15,now() + interval '1 hour')`);
    await assert.rejects(cambiarEstadoDomicilio(3, 1, despacho()), /disponibles para despachar/);
    const [d] = await domiciliosFarmacia({ estado: 'activos' });
    assert.equal(d.medicamentos[0].disponible, 5);
    await pool.query(`UPDATE formulas SET fecha_emision=CURRENT_DATE-5, fecha_limite=CURRENT_DATE-1`);
    await assert.rejects(cambiarEstadoDomicilio(3, 1, despacho(1)), /vencida/);
  });
  await t.test('un pedido en camino sin despacho registrado no se puede marcar entregado', async () => {
    await preparar();
    await pool.query(`UPDATE domicilios SET estado='en_camino'`);
    await assert.rejects(cambiarEstadoDomicilio(3, 1, entrega()), /despacho registrado/);
  });
  await t.test('entrega sin cuota ni envío registra recibo cero y no exige pago', async () => {
    await preparar();
    await pool.query('UPDATE formulas SET cuota_moderadora=0; UPDATE domicilios SET costo_envio=0');
    await cambiarEstadoDomicilio(3, 1, despacho());
    await cambiarEstadoDomicilio(3, 1, { ...entrega(), pago: undefined });
    assert.equal(await cuenta('pagos'), 0);
    const [d] = await domiciliosFarmacia({ estado: 'entregado' });
    assert.equal(d.cobro.total, 0);
    assert.equal(d.cobro.medio, null);
    assert.equal((await fila('medicamentos')).stock_actual, 10);
  });
  await t.test('dos despachos o dos entregas simultáneas se aplican una sola vez', async () => {
    await preparar();
    let r = await Promise.allSettled([cambiarEstadoDomicilio(3, 1, despacho()), cambiarEstadoDomicilio(3, 1, despacho())]);
    assert.equal(r.filter((v) => v.status === 'fulfilled').length, 1);
    assert.equal((await fila('medicamentos')).stock_actual, 10);
    r = await Promise.allSettled([cambiarEstadoDomicilio(3, 1, entrega()), cambiarEstadoDomicilio(3, 1, entrega())]);
    assert.equal(r.filter((v) => v.status === 'fulfilled').length, 1);
    assert.equal(await cuenta('dispensaciones'), 1);
    assert.equal(await cuenta('pagos'), 1);
  });
  await t.test('un fallo al guardar el estado revierte el despacho o la entrega completos', async () => {
    await preparar();
    const fallar = () => pool.query(`CREATE FUNCTION impedir_cambio() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'fallo de prueba'; END $$;
      CREATE TRIGGER fallo BEFORE UPDATE ON domicilios FOR EACH ROW EXECUTE FUNCTION impedir_cambio()`);
    const quitarFallo = () => pool.query('DROP TRIGGER fallo ON domicilios; DROP FUNCTION impedir_cambio()');
    await fallar();
    try {
      await assert.rejects(cambiarEstadoDomicilio(3, 1, despacho()), /fallo de prueba/);
      assert.equal((await fila('medicamentos')).stock_actual, 20);
      assert.equal((await fila('formula_items')).cantidad_entregada, 0);
      for (const tabla of ['domicilio_items', 'movimientos_inventario']) assert.equal(await cuenta(tabla), 0);
    } finally { await quitarFallo(); }

    await cambiarEstadoDomicilio(3, 1, despacho());
    await fallar();
    try {
      await assert.rejects(cambiarEstadoDomicilio(3, 1, entrega(4)), /fallo de prueba/);
      assert.equal((await fila('medicamentos')).stock_actual, 10);
      assert.equal((await fila('formula_items')).cantidad_entregada, 10);
      assert.equal((await fila('domicilio_items')).entregada, null);
      for (const tabla of ['pagos', 'cobros_domicilio', 'dispensaciones']) assert.equal(await cuenta(tabla), 0);
      assert.equal(await cuenta('movimientos_inventario'), 1);
    } finally { await quitarFallo(); }
  });
  await t.test('la dispensación en ventanilla sigue funcionando con la migración', async () => {
    await preparar();
    await pool.query(`INSERT INTO turnos (numero,tipo,estado,paciente_id,formula_id)
      VALUES ('F-001','fisico','presente',1,1)`);
    await dispensar(1, entrega(), { id: 2 });
    assert.equal((await fila('pagos')).turno_id, 1);
    assert.equal((await fila('dispensaciones')).domicilio_id, null);
  });
  await t.test('lo despachado no se puede volver a entregar en ventanilla mientras va en camino', async () => {
    await preparar();
    await cambiarEstadoDomicilio(3, 1, despacho());
    await pool.query(`INSERT INTO turnos (numero,tipo,estado,paciente_id,formula_id)
      VALUES ('F-001','fisico','presente',1,1)`);
    await assert.rejects(dispensar(1, entrega(1), { id: 2 }), /pendientes/);
  });

  const servidor = http.createServer();
  const sockets = iniciarSockets(servidor);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => sockets.close(resolve)));
  const direccion = `http://127.0.0.1:${servidor.address().port}`;
  const token = (id, extra = {}, expiresIn = '1h') => jwt.sign({ tipo: 'empleado', id, ...extra }, process.env.JWT_SECRET, { expiresIn });
  async function conectar(auth, rechazar = false) {
    const s = clienteSocket(direccion, { auth, transports: ['websocket'], reconnection: false });
    try {
      await once(s, rechazar ? 'connect_error' : 'connect', { signal: AbortSignal.timeout(3000) });
      return s;
    } catch (error) { s.disconnect(); throw error; }
    finally { if (rechazar) s.disconnect(); }
  }
  await t.test('pantalla: acepta auxiliar, rechaza domicilios, bajas y token vencido', async () => {
    await preparar();
    const s = await conectar({ tipo: 'pantalla', token: token(2) });
    try {
      const recibido = once(s, 'turno_actual', { signal: AbortSignal.timeout(3000) });
      await emitir('pantalla', 'turno_actual', { nombre: 'Paciente' });
      assert.equal((await recibido)[0].nombre, 'Paciente');
    } finally { s.disconnect(); }
    await conectar({ tipo: 'pantalla', token: token(3) }, true);
    await pool.query('UPDATE usuarios_farmacia SET activo=false WHERE id=2');
    await conectar({ tipo: 'pantalla', token: token(2) }, true);
    await conectar({ tipo: 'pantalla', token: token(1, {}, -1) }, true);
    await conectar({ tipo: 'pantalla', token: 'invalido' }, true);
  });
  await t.test('domicilios no entra en salas de farmacia; paciente solo recibe su turno', async () => {
    await preparar();
    const d = await conectar({ token: token(3) });
    const p = await conectar({ token: token(undefined, { tipo: 'paciente_turno', turno_id: 7 }) });
    try {
      const conexiones = [...sockets.of('/').sockets.values()];
      assert.deepEqual(conexiones.find((s) => s.data.empleadoId === 3).data.salas, []);
      assert.deepEqual(conexiones.find((s) => !s.data.empleadoId).data.salas, ['turno:7','fila_publica']);
    } finally { d.disconnect(); p.disconnect(); }
  });
  await t.test('revalida permisos antes de enviar nombres, incluso ante cambios directos en BD', async () => {
    await preparar();
    const s = await conectar({ tipo: 'pantalla', token: token(2) });
    let filtrados = 0;
    s.on('turno_actual', () => filtrados++);
    try {
      await pool.query("UPDATE usuarios_farmacia SET rol='domicilios' WHERE id=2");
      const desconectado = once(s, 'disconnect', { signal: AbortSignal.timeout(3000) });
      await emitir('pantalla', 'turno_actual', { nombre: 'Privado' });
      await desconectado;
      assert.equal(filtrados, 0);
    } finally { s.disconnect(); }
  });
  await t.test('editar permisos desconecta sesiones abiertas inmediatamente', async () => {
    await preparar();
    const s = await conectar({ tipo: 'pantalla', token: token(2) });
    try {
      const desconectado = once(s, 'disconnect', { signal: AbortSignal.timeout(3000) });
      await editarUsuario(2, { activo: false }, { id: 1 });
      await desconectado;
    } finally { s.disconnect(); }
  });
  await t.test('desconecta al vencer el JWT de una conexión abierta', async () => {
    await preparar();
    const s = await conectar({ tipo: 'pantalla', token: token(2, {}, 2) });
    try { await once(s, 'disconnect', { signal: AbortSignal.timeout(3000) }); }
    finally { s.disconnect(); }
  });
});
