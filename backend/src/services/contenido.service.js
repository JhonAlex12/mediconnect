import sharp from 'sharp';
import { pool } from '../db/pool.js';
import { ErrorNegocio, fechaValida } from './formulas.service.js';

// Contenido del sitio editable por el administrador:
// carrusel, artículos de "Salud al día", información al paciente, contacto e imágenes

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const opcional = (v) => texto(v) || null;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Rutas de imagen permitidas: las del sitio (/img/...) o las subidas (/api/contenido/imagenes/N)
const RUTA_IMAGEN = /^\/(img\/[\w.-]+|api\/contenido\/imagenes\/\d+)$/;
// Enlaces internos (/ruta, /ruta#ancla) o externos https
const ENLACE = /^(\/[\w\-/#?=&.%]*|https:\/\/[^\s<>"]+)$/;
// Colores o degradados para el fondo de un slide (sin url() ni nada ejecutable)
const FONDO = /^[#\w\s,.%()-]+$/;

function largo(errores, nombre, valor, min, max) {
  if (valor.length < min || valor.length > max) {
    errores.push(min > 0 ? `${nombre}: entre ${min} y ${max} caracteres` : `${nombre}: máximo ${max} caracteres`);
  }
}

async function auditar(empleadoId, accion, detalle) {
  await pool.query(
    `INSERT INTO registro_accesos (usuario_id, accion, detalle) VALUES ($1, $2, $3)`,
    [empleadoId, accion, detalle]
  );
}

// ---------- Imágenes ----------

const TIPOS_IMAGEN = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1 };
const MAX_BYTES = 10 * 1024 * 1024;

// Recibe una imagen como data URL (data:image/png;base64,...) y guarda dos versiones WebP
export async function subirImagen(empleadoId, dataUrl) {
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!m || !TIPOS_IMAGEN[m[1]]) throw new ErrorNegocio('La imagen debe ser JPG, PNG o WebP', 400);
  const original = Buffer.from(m[2], 'base64');
  if (original.length > MAX_BYTES) throw new ErrorNegocio('La imagen pesa más de 10 MB', 413);

  let grande, movil, info;
  try {
    const base = sharp(original).rotate(); // respeta la orientación de fotos de celular
    ({ data: grande, info } = await base.clone().resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer({ resolveWithObject: true }));
    movil = await base.clone().resize({ width: 900, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  } catch {
    throw new ErrorNegocio('No se pudo leer la imagen. Prueba con otro archivo.', 400);
  }

  const { rows: [img] } = await pool.query(
    `INSERT INTO imagenes (datos, datos_movil, ancho, alto, subida_por) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [grande, movil, info.width, info.height, empleadoId]
  );
  await auditar(empleadoId, 'subir_imagen', String(img.id));
  return {
    id: img.id,
    url: `/api/contenido/imagenes/${img.id}`,
    url_movil: `/api/contenido/imagenes/${img.id}?movil=1`,
    ancho: info.width,
    alto: info.height,
  };
}

export async function leerImagen(id, movil) {
  const { rows: [img] } = await pool.query(
    `SELECT tipo, ${movil ? 'COALESCE(datos_movil, datos)' : 'datos'} AS datos FROM imagenes WHERE id = $1`,
    [id]
  );
  return img ?? null;
}

// ---------- Carrusel ----------

const COLUMNAS_SLIDE = 'id, nombre, texto_alt, imagen, imagen_movil, enlace, fondo, orden, activo';

export async function listarSlides({ todos = false } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_SLIDE} FROM slides ${todos ? '' : 'WHERE activo'} ORDER BY orden, id`
  );
  return rows;
}

function validarSlide(d) {
  const errores = [];
  const s = {
    nombre: texto(d.nombre),
    texto_alt: texto(d.texto_alt),
    imagen: texto(d.imagen),
    imagen_movil: opcional(d.imagen_movil),
    enlace: opcional(d.enlace),
    fondo: opcional(d.fondo),
    activo: d.activo !== false,
  };
  largo(errores, 'Nombre', s.nombre, 2, 80);
  largo(errores, 'Texto de la imagen', s.texto_alt, 5, 300);
  if (!RUTA_IMAGEN.test(s.imagen)) errores.push('Imagen: sube una imagen');
  if (s.imagen_movil && !RUTA_IMAGEN.test(s.imagen_movil)) errores.push('Imagen para celular: no es válida');
  if (s.enlace && (!ENLACE.test(s.enlace) || s.enlace.length > 200)) errores.push('Enlace: usa una ruta del sitio (/informacion) o una dirección https://');
  if (s.fondo && (!FONDO.test(s.fondo) || s.fondo.length > 200 || /url\s*\(/i.test(s.fondo))) errores.push('Fondo: usa un color (#ffffff) o un degradado');
  if (errores.length) throw new ErrorNegocio('Revisa los datos del slide', 400, errores);
  return s;
}

export async function crearSlide(empleadoId, d = {}) {
  const s = validarSlide(d);
  const { rows: [nuevo] } = await pool.query(
    `INSERT INTO slides (nombre, texto_alt, imagen, imagen_movil, enlace, fondo, activo, orden)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE((SELECT max(orden) FROM slides), 0) + 1)
     RETURNING ${COLUMNAS_SLIDE}`,
    [s.nombre, s.texto_alt, s.imagen, s.imagen_movil, s.enlace, s.fondo, s.activo]
  );
  await auditar(empleadoId, 'crear_slide', s.nombre);
  return nuevo;
}

export async function editarSlide(empleadoId, id, d = {}) {
  const s = validarSlide(d);
  const { rows: [editado] } = await pool.query(
    `UPDATE slides SET nombre=$2, texto_alt=$3, imagen=$4, imagen_movil=$5, enlace=$6, fondo=$7, activo=$8,
            actualizado_en = now()
      WHERE id = $1 RETURNING ${COLUMNAS_SLIDE}`,
    [id, s.nombre, s.texto_alt, s.imagen, s.imagen_movil, s.enlace, s.fondo, s.activo]
  );
  if (!editado) throw new ErrorNegocio('El slide no existe', 404);
  await auditar(empleadoId, 'editar_slide', s.nombre);
  return editado;
}

export async function eliminarSlide(empleadoId, id) {
  const { rows: [s] } = await pool.query('DELETE FROM slides WHERE id = $1 RETURNING nombre', [id]);
  if (!s) throw new ErrorNegocio('El slide no existe', 404);
  await auditar(empleadoId, 'eliminar_slide', s.nombre);
}

// Recibe la lista de ids en el orden nuevo
export async function ordenarSlides(empleadoId, ids) {
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) throw new ErrorNegocio('Orden no válido', 400);
  await pool.query(
    `UPDATE slides s SET orden = o.pos FROM unnest($1::int[]) WITH ORDINALITY AS o(id, pos) WHERE s.id = o.id`,
    [ids]
  );
  await auditar(empleadoId, 'ordenar_slides', ids.join(','));
  return listarSlides({ todos: true });
}

// ---------- Artículos (Salud al día) ----------

const COLUMNAS_ARTICULO = `id, slug, titulo, tema, resumen, imagen, to_char(fecha, 'YYYY-MM-DD') AS fecha, publicado`;

export async function listarArticulos({ todos = false } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_ARTICULO} FROM articulos ${todos ? '' : 'WHERE publicado'} ORDER BY fecha DESC, id DESC`
  );
  return rows;
}

export async function verArticulo(slugOId, { todos = false } = {}) {
  const porId = typeof slugOId === 'number';
  const { rows: [a] } = await pool.query(
    `SELECT ${COLUMNAS_ARTICULO}, contenido FROM articulos
      WHERE ${porId ? 'id = $1' : 'slug = $1'} ${todos ? '' : 'AND publicado'}`,
    [slugOId]
  );
  if (!a) throw new ErrorNegocio('El artículo no existe', 404);
  return a;
}

function validarArticulo(d) {
  const errores = [];
  const a = {
    slug: texto(d.slug).toLowerCase(),
    titulo: texto(d.titulo),
    tema: texto(d.tema),
    resumen: texto(d.resumen),
    contenido: texto(d.contenido),
    imagen: opcional(d.imagen),
    fecha: texto(d.fecha),
    publicado: d.publicado !== false,
  };
  if (!SLUG.test(a.slug) || a.slug.length > 120) errores.push('Dirección: solo minúsculas, números y guiones (ej.: cuidados-en-invierno)');
  largo(errores, 'Título', a.titulo, 5, 160);
  largo(errores, 'Tema', a.tema, 3, 60);
  largo(errores, 'Resumen', a.resumen, 10, 300);
  largo(errores, 'Contenido', a.contenido, 20, 50000);
  if (a.imagen && !RUTA_IMAGEN.test(a.imagen)) errores.push('Imagen: no es válida');
  if (!fechaValida(a.fecha)) errores.push('Fecha: no es válida');
  if (errores.length) throw new ErrorNegocio('Revisa los datos del artículo', 400, errores);
  return a;
}

const slugRepetido = (error) => {
  if (error.code === '23505') throw new ErrorNegocio('Ya hay un artículo con esa dirección', 409);
  throw error;
};

export async function crearArticulo(empleadoId, d = {}) {
  const a = validarArticulo(d);
  const { rows: [nuevo] } = await pool.query(
    `INSERT INTO articulos (slug, titulo, tema, resumen, contenido, imagen, fecha, publicado, actualizado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [a.slug, a.titulo, a.tema, a.resumen, a.contenido, a.imagen, a.fecha, a.publicado, empleadoId]
  ).catch(slugRepetido);
  await auditar(empleadoId, 'crear_articulo', a.slug);
  return verArticulo(nuevo.id, { todos: true });
}

export async function editarArticulo(empleadoId, id, d = {}) {
  const a = validarArticulo(d);
  const { rowCount } = await pool.query(
    `UPDATE articulos SET slug=$2, titulo=$3, tema=$4, resumen=$5, contenido=$6, imagen=$7, fecha=$8, publicado=$9,
            actualizado_por=$10, actualizado_en=now()
      WHERE id = $1`,
    [id, a.slug, a.titulo, a.tema, a.resumen, a.contenido, a.imagen, a.fecha, a.publicado, empleadoId]
  ).catch(slugRepetido);
  if (!rowCount) throw new ErrorNegocio('El artículo no existe', 404);
  await auditar(empleadoId, 'editar_articulo', a.slug);
  return verArticulo(id, { todos: true });
}

export async function eliminarArticulo(empleadoId, id) {
  const { rows: [a] } = await pool.query('DELETE FROM articulos WHERE id = $1 RETURNING slug', [id]);
  if (!a) throw new ErrorNegocio('El artículo no existe', 404);
  await auditar(empleadoId, 'eliminar_articulo', a.slug);
}

// ---------- Información al paciente ----------

export async function listarSecciones({ todas = false } = {}) {
  const { rows } = await pool.query(
    `SELECT id, ancla, titulo, contenido, orden, visible FROM secciones_informacion
      ${todas ? '' : 'WHERE visible'} ORDER BY orden, id`
  );
  return rows;
}

function validarSeccion(d) {
  const errores = [];
  const s = {
    ancla: texto(d.ancla).toLowerCase(),
    titulo: texto(d.titulo),
    contenido: texto(d.contenido),
    visible: d.visible !== false,
  };
  if (!SLUG.test(s.ancla) || s.ancla.length > 40) errores.push('Ancla: solo minúsculas, números y guiones');
  largo(errores, 'Título', s.titulo, 3, 120);
  largo(errores, 'Contenido', s.contenido, 10, 20000);
  if (errores.length) throw new ErrorNegocio('Revisa los datos de la sección', 400, errores);
  return s;
}

const anclaRepetida = (error) => {
  if (error.code === '23505') throw new ErrorNegocio('Ya hay una sección con esa ancla', 409);
  throw error;
};

export async function crearSeccion(empleadoId, d = {}) {
  const s = validarSeccion(d);
  const { rows: [nueva] } = await pool.query(
    `INSERT INTO secciones_informacion (ancla, titulo, contenido, visible, orden)
     VALUES ($1,$2,$3,$4, COALESCE((SELECT max(orden) FROM secciones_informacion), 0) + 1) RETURNING id`,
    [s.ancla, s.titulo, s.contenido, s.visible]
  ).catch(anclaRepetida);
  await auditar(empleadoId, 'crear_seccion_info', s.ancla);
  return nueva;
}

export async function editarSeccion(empleadoId, id, d = {}) {
  const s = validarSeccion(d);
  const { rowCount } = await pool.query(
    `UPDATE secciones_informacion SET ancla=$2, titulo=$3, contenido=$4, visible=$5, actualizado_en=now()
      WHERE id = $1`,
    [id, s.ancla, s.titulo, s.contenido, s.visible]
  ).catch(anclaRepetida);
  if (!rowCount) throw new ErrorNegocio('La sección no existe', 404);
  await auditar(empleadoId, 'editar_seccion_info', s.ancla);
}

export async function eliminarSeccion(empleadoId, id) {
  const { rows: [s] } = await pool.query('DELETE FROM secciones_informacion WHERE id = $1 RETURNING ancla', [id]);
  if (!s) throw new ErrorNegocio('La sección no existe', 404);
  await auditar(empleadoId, 'eliminar_seccion_info', s.ancla);
}

export async function ordenarSecciones(empleadoId, ids) {
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) throw new ErrorNegocio('Orden no válido', 400);
  await pool.query(
    `UPDATE secciones_informacion s SET orden = o.pos
       FROM unnest($1::int[]) WITH ORDINALITY AS o(id, pos) WHERE s.id = o.id`,
    [ids]
  );
  await auditar(empleadoId, 'ordenar_secciones_info', ids.join(','));
  return listarSecciones({ todas: true });
}

// ---------- Contacto y ubicación ----------

export async function verContacto() {
  const { rows: [c] } = await pool.query(`SELECT datos FROM ajustes_sitio WHERE clave = 'contacto'`);
  return c?.datos ?? {};
}

export async function guardarContacto(empleadoId, d = {}) {
  const errores = [];
  const c = {
    telefono: texto(d.telefono),
    correo: texto(d.correo),
    direccion: texto(d.direccion),
    ciudad: texto(d.ciudad),
    horario: texto(d.horario),
    lat: Number(d.lat),
    lon: Number(d.lon),
  };
  largo(errores, 'Teléfono', c.telefono, 7, 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.correo) || c.correo.length > 120) errores.push('Correo: no es válido');
  largo(errores, 'Dirección', c.direccion, 5, 150);
  largo(errores, 'Ciudad', c.ciudad, 2, 80);
  largo(errores, 'Horario', c.horario, 5, 120);
  if (!(c.lat >= -90 && c.lat <= 90) || !(c.lon >= -180 && c.lon <= 180)) errores.push('Ubicación del mapa: latitud o longitud no válidas');
  if (errores.length) throw new ErrorNegocio('Revisa los datos de contacto', 400, errores);

  await pool.query(
    `INSERT INTO ajustes_sitio (clave, datos, actualizado_por) VALUES ('contacto', $1, $2)
     ON CONFLICT (clave) DO UPDATE SET datos = $1, actualizado_por = $2, actualizado_en = now()`,
    [c, empleadoId]
  );
  await auditar(empleadoId, 'editar_contacto', null);
  return c;
}
