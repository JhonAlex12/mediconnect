import { pool } from '../db/pool.js';
import { ErrorNegocio } from './formulas.service.js';
import { listarTarifas } from './cobros.service.js';
import { costoEnvio } from './cuentas.service.js';

// Mediconnect Bot: responde buscando la pregunta del paciente en el contenido del sitio
// (preguntas del bot, Información al paciente y Salud al día). No usa inteligencia artificial:
// solo dice lo que el administrador escribió, y nada sale del servidor.

// ---------- Texto ----------

const sinTildes = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const normalizar = (t) => sinTildes(String(t ?? '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();

// Palabras que no ayudan a saber de qué se trata la pregunta
const VACIAS = new Set(`
a al algo alguien alla aqui asi aun bien bueno buena buenas buenos cada como con cual cuales cuando de del
desde dia dias donde el ella ellas ellos en entonces era es esa ese eso esta estan estar este esto favor fue
ha hace hacer hay he hola la las le les lo los mas me mi mis mucho muy nada ni no nos o otra otro para pero
podria por porfa porque pues puede pueden puedo q que quiero quisiera saber se ser si sin sobre solo son su
sus tal tambien tardes te tengo ti toca todo tu tus u un una uno unos unas usted ustedes
va vamos voy y ya yo noches ok okey gracias senor senora sr sra
`.split(/\s+/).filter(Boolean));

// Frases que se leen como una sola idea
const FRASES = [
  [/\badult[oa]s? mayor(es)?\b|\btercera edad\b/g, ' #preferencial '],
  [/\ba domicilio\b|\ba la casa\b|\ba mi casa\b/g, ' #domicilio '],
  [/\bno hay\b|\bno habia\b|\bno tenian\b|\bno tienen\b/g, ' #pendiente '],
  [/\bfecha limite\b/g, ' #vence '],
  [/\bcorreo electronico\b/g, ' #contacto '],
];

// Palabras con el mismo sentido se cuentan como una sola (#concepto)
const SINONIMOS = {};
const grupo = (concepto, palabras) => palabras.split(' ').forEach((p) => { SINONIMOS[p] = concepto; });
grupo('#domicilio', 'domicilio domicilios domiciliario envio envios enviar envian envien mandan mandar llevan llevar traen traer casa');
grupo('#costo', 'cuanto cuanta cuesta cuestan vale valen valor precio precios cobran cobra cobro pagar pago pagos pago plata tarifa');
grupo('#cuota', 'cuota cuotas copago copagos moderadora moderadoras');
grupo('#horario', 'horario horarios hora horas abren abre abierto abiertos cierran cierra cerrado domingo domingos sabado sabados festivo festivos');
grupo('#ubicacion', 'ubicacion ubicados ubicada direccion quedan queda llego llegar mapa sede');
grupo('#contacto', 'telefono telefonos llamar llamo numero celular whatsapp wasap correo email contacto comunicar comunico comunicarme hablar');
grupo('#formula', 'formula formulas receta recetas orden ordenes prescripcion');
grupo('#medicamento', 'medicamento medicamentos medicina medicinas droga drogas pastilla pastillas remedio remedios');
grupo('#turno', 'turno turnos fila cola ficha fichas');
grupo('#pqrs', 'queja quejas pqrs pqr peticion peticiones sugerencia sugerencias denuncia felicitar felicitacion');
grupo('#reclamar', 'reclamar reclamo reclama recoger recojo retirar retiro');
grupo('#preferencial', 'preferencial prioridad prioritario embarazada embarazadas embarazo discapacidad discapacitado anciano ancianos');
grupo('#pendiente', 'pendiente pendientes falta faltan faltaron falto debiendo incompleto incompleta agotado agotados');
grupo('#cuenta', 'cuenta cuentas registrar registrarme registro inscribir inscribirme');
grupo('#clave', 'contrasena clave password');
grupo('#pedir', 'pedir pido pide sacar saco saca solicitar solicito');
grupo('#disponible', 'tienen tiene hay disponible disponibles disponibilidad existencia');
grupo('#retraso', 'tarde retrasado retrasada retraso retrase atrasado atrasada demoro demora');
grupo('#vence', 'vencida vencido vence vencio vencimiento caduco caducada vigencia vigente');

// Raíz sencilla: "fórmulas" y "fórmula" → "formu"; "reclamar" y "reclamo" → "recla"
const raiz = (p) => {
  if (p.startsWith('#')) return p;
  const sinPlural = p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p;
  return sinPlural.length > 5 ? sinPlural.slice(0, 5) : sinPlural;
};

export function terminos(texto) {
  let t = ` ${normalizar(texto)} `;
  for (const [patron, concepto] of FRASES) t = t.replace(patron, concepto);
  const salida = [];
  for (const p of t.split(/\s+/)) {
    if (!p) continue;
    if (p.startsWith('#')) { salida.push(p); continue; }
    const concepto = SINONIMOS[p];
    if (concepto) salida.push(concepto);
    else if (!VACIAS.has(p) && p.length > 1) salida.push(raiz(p));
  }
  return salida;
}

// ---------- Datos que se llenan solos ----------

const pesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

async function datosDelSitio() {
  const [{ rows: [c] }, [tarifa], envio] = await Promise.all([
    pool.query(`SELECT datos FROM ajustes_sitio WHERE clave = 'contacto'`),
    listarTarifas(),
    costoEnvio(),
  ]);
  const contacto = c?.datos ?? {};
  const tablaCuotas = tarifa
    ? [
      `Valores ${tarifa.anio}:`,
      '',
      `- Menos de 2 salarios mínimos: **${pesos(tarifa.A)}**`,
      `- Entre 2 y 5 salarios mínimos: **${pesos(tarifa.B)}**`,
      `- Más de 5 salarios mínimos: **${pesos(tarifa.C)}**`,
    ].join('\n')
    : 'Consulta los valores vigentes en Información al paciente.';
  return {
    telefono: contacto.telefono ?? '', correo: contacto.correo ?? '', horario: contacto.horario ?? '',
    direccion: contacto.direccion ?? '', ciudad: contacto.ciudad ?? '',
    costo_envio: pesos(envio), tabla_cuotas: tablaCuotas,
  };
}

const llenar = (texto, datos) => texto.replace(/\{(\w+)\}/g, (todo, k) => (datos[k] != null ? String(datos[k]) : todo));

// Primeros párrafos de una sección larga (sin sus botones: el chat pone su propio enlace)
function extracto(texto, max = 420) {
  const bloques = texto.split(/\n\s*\n/).map((b) => b.trim()).filter((b) => b && !/^\[[^\]]+\]\([^)\s]+\)$/.test(b));
  const elegidos = [];
  let largo = 0;
  for (const b of bloques) {
    if (elegidos.length && largo + b.length > max) break;
    elegidos.push(b);
    largo += b.length;
  }
  return elegidos.join('\n\n');
}

// ---------- Índice de búsqueda (se arma cada minuto o cuando cambia una pregunta) ----------

let indice = null;
let armadoEn = 0;
export const invalidarIndice = () => { indice = null; };

async function armarIndice() {
  if (indice && Date.now() - armadoEn < 60_000) return indice;

  const [preguntas, secciones, articulos, datos] = await Promise.all([
    pool.query(`SELECT id, pregunta, variantes, respuesta, enlace FROM preguntas_bot WHERE activa ORDER BY orden, id`),
    pool.query(`SELECT ancla, titulo, contenido FROM secciones_informacion WHERE visible ORDER BY orden, id`),
    pool.query(`SELECT slug, titulo, tema, resumen, contenido FROM articulos WHERE publicado ORDER BY fecha DESC`),
    datosDelSitio(),
  ]);

  // Cada documento: de dónde sale, qué responde y en qué textos se busca (con su peso)
  const docs = [
    ...preguntas.rows.map((p) => ({
      id: `p:${p.id}`, tipo: 'pregunta', titulo: p.pregunta, factor: 1,
      respuesta: llenar(p.respuesta, datos), enlace: p.enlace,
      campos: [[p.pregunta, 4], [p.variantes, 3], [p.respuesta, 1]],
    })),
    ...secciones.rows.map((s) => ({
      id: `s:${s.ancla}`, tipo: 'seccion', titulo: s.titulo, factor: 0.85,
      respuesta: extracto(llenar(s.contenido, datos)), enlace: `/informacion#${s.ancla}`,
      campos: [[s.titulo, 3], [s.contenido, 0.7]],
    })),
    ...articulos.rows.map((a) => ({
      id: `a:${a.slug}`, tipo: 'articulo', titulo: a.titulo, factor: 0.8,
      respuesta: `Te puede servir este artículo de **Salud al día**: **${a.titulo}**.\n\n${a.resumen}`,
      enlace: `/salud-al-dia/${a.slug}`,
      campos: [[a.titulo, 3], [a.tema, 1], [a.resumen, 2], [a.contenido, 0.4]],
    })),
  ];

  const df = new Map();
  for (const d of docs) {
    d.tf = new Map();
    d.largo = 0;
    for (const [texto, peso] of d.campos) {
      for (const t of terminos(texto)) {
        d.tf.set(t, (d.tf.get(t) ?? 0) + peso);
        d.largo += peso;
      }
    }
    for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    delete d.campos;
  }
  const n = docs.length || 1;
  const idf = new Map([...df].map(([t, k]) => [t, Math.log(1 + (n - k + 0.5) / (k + 0.5))]));
  const promedio = docs.reduce((s, d) => s + d.largo, 0) / n || 1;

  indice = { docs, idf, n, promedio, porId: new Map(docs.map((d) => [d.id, d])) };
  armadoEn = Date.now();
  return indice;
}

// Puntaje BM25 de cada documento y qué parte de la pregunta quedó cubierta
function buscar(ind, texto) {
  const q = [...new Set(terminos(texto))];
  if (!q.length) return { q, resultados: [] };
  const idfDesconocida = Math.log(1 + ind.n) * 0.5; // palabras que no aparecen en el sitio
  const pesoTotal = q.reduce((s, t) => s + (ind.idf.get(t) ?? idfDesconocida), 0);
  const k1 = 1.2;
  const b = 0.3;

  const resultados = [];
  for (const d of ind.docs) {
    let puntaje = 0;
    let cubierto = 0;
    for (const t of q) {
      const tf = d.tf.get(t);
      if (!tf) continue;
      const idf = ind.idf.get(t);
      puntaje += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * d.largo / ind.promedio));
      cubierto += idf;
    }
    if (puntaje > 0) resultados.push({ d, puntaje: puntaje * d.factor, cobertura: cubierto / pesoTotal });
  }
  resultados.sort((x, y) => y.puntaje - x.puntaje);
  return { q, resultados };
}

// ---------- Respuestas fijas ----------

const EMERGENCIA = /\b(emergencia|sobredosis|intoxic\w*|envenen\w*|desmay\w*|convulsi\w*|infarto|no puedo respirar|me estoy ahogando|me siento muy mal|suicid\w*|quitarme la vida)\b/;
const CONSEJO_MEDICO = /\b(dosis|para que sirve|sirve para|efectos? (secundario|adverso)s?|contraindica\w*|(?:me )?puedo tomar(?! (?:un |el |mi |otro )?turno)|debo tomar|cuant[ao]s? (pastillas|tabletas|capsulas|gotas|ml|mg|cucharadas)|mezclar|combinar|con alcohol|con licor|con cerveza|reemplazar el medicamento|cambiar el medicamento|que me tomo|que puedo tomar)\b/;
const SOLO_SALUDO = /^(hola|buenas|buenos|buen|dia|dias|tardes|noches|saludos|hey|que tal|como estas|como esta)( (hola|buenas|buenos|buen|dia|dias|tardes|noches|saludos|que tal|como estas|como esta))*$/;
const SOLO_GRACIAS = /^(muchas |mil )?(gracias|ok|okey|listo|vale|perfecto|chao|adios|hasta luego|bueno|entendido|excelente)( (gracias|muy amable|listo|chao|bueno))*$/;

async function fija(texto, datos) {
  const n = normalizar(texto);
  if (EMERGENCIA.test(n)) {
    return {
      texto: '**Si es una emergencia, llama ya a la línea 123** o ve al servicio de urgencias más cercano.\n\nSoy un asistente de la farmacia y no puedo atender emergencias.',
      enlace: null,
    };
  }
  if (CONSEJO_MEDICO.test(n)) {
    return {
      texto: `No puedo darte indicaciones sobre cómo tomar un medicamento, dosis o efectos: eso debe decírtelo **tu médico o el químico farmacéutico**.\n\nPuedes preguntar en la ventanilla de la farmacia o llamar al **${datos.telefono}**.`,
      enlace: null,
    };
  }
  if (SOLO_SALUDO.test(n)) {
    return { texto: '¡Hola! Cuéntame qué necesitas: fórmulas, turnos, cuotas, domicilios, horario…', enlace: null, temas: true };
  }
  if (SOLO_GRACIAS.test(n)) {
    return { texto: '¡Con gusto! Si tienes otra pregunta, aquí estoy.', enlace: null };
  }
  return null;
}

// ---------- Público ----------

const MAX_TEXTO = 300;

export async function temasSugeridos() {
  const { rows } = await pool.query(
    `SELECT id, pregunta FROM preguntas_bot WHERE activa AND sugerida ORDER BY orden, id LIMIT 6`
  );
  return rows.map((r) => ({ id: `p:${r.id}`, titulo: r.pregunta }));
}

const contarUso = (doc) => {
  if (doc.tipo !== 'pregunta') return;
  pool.query('UPDATE preguntas_bot SET veces_usada = veces_usada + 1 WHERE id = $1', [Number(doc.id.slice(2))])
    .catch(() => {});
};

const respuestaDe = (doc) => ({ texto: doc.respuesta, enlace: doc.enlace, fuente: doc.titulo });

// { texto } (lo que escribió el paciente) o { id } (tocó un tema sugerido)
export async function preguntar({ texto, id } = {}) {
  const ind = await armarIndice();

  if (typeof id === 'string' && id) {
    const doc = ind.porId.get(id);
    if (!doc) throw new ErrorNegocio('Ese tema ya no está disponible', 404);
    contarUso(doc);
    return { entendida: true, respuesta: respuestaDe(doc), relacionadas: [] };
  }

  const pregunta = typeof texto === 'string' ? texto.trim().slice(0, MAX_TEXTO) : '';
  if (!pregunta) throw new ErrorNegocio('Escribe tu pregunta', 400);

  const datos = await datosDelSitio();
  const respuestaFija = await fija(pregunta, datos);
  if (respuestaFija) {
    const { temas, ...respuesta } = respuestaFija;
    return { entendida: true, respuesta, relacionadas: temas ? await temasSugeridos() : [] };
  }

  const { resultados } = buscar(ind, pregunta);
  const [mejor] = resultados;
  // Se responde solo si la mayor parte de la pregunta coincide con el documento
  if (mejor && mejor.cobertura >= 0.5 && mejor.puntaje >= 1.2) {
    contarUso(mejor.d);
    const relacionadas = resultados.slice(1)
      .filter((r) => r.puntaje >= mejor.puntaje * 0.6 && r.cobertura >= 0.4)
      .slice(0, 2)
      .map((r) => ({ id: r.d.id, titulo: r.d.titulo }));
    return { entendida: true, respuesta: respuestaDe(mejor.d), relacionadas };
  }

  await anotarSinRespuesta(pregunta);
  // Si algo se parece un poco, se ofrece como opción
  const parecidas = resultados.filter((r) => r.cobertura >= 0.25).slice(0, 3).map((r) => ({ id: r.d.id, titulo: r.d.titulo }));
  return {
    entendida: false,
    respuesta: {
      texto: parecidas.length
        ? 'No estoy seguro de haber entendido. ¿Es alguno de estos temas?'
        : `No encontré información sobre eso. Prueba con otras palabras o comunícate con la farmacia al **${datos.telefono}** (${datos.horario}).`,
      enlace: null,
    },
    relacionadas: parecidas.length ? parecidas : await temasSugeridos(),
  };
}

// Sin documentos, teléfonos, códigos de fórmula ni correos
export const anonimizar = (t) => t
  .replace(/[^\s@]+@[^\s@]+/g, '[correo]')
  .replace(/\bf-?\s?\d{4}-?\s?\d{2,}\b/gi, '[código]')
  .replace(/\d[\d\s.\-]{3,}\d/g, '[número]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200);

async function anotarSinRespuesta(texto) {
  const limpio = anonimizar(texto);
  if (normalizar(limpio).length < 3) return;
  await pool.query('INSERT INTO bot_sin_respuesta (texto) VALUES ($1)', [limpio]).catch(() => {});
}

// ---------- Administración ----------

const ENLACE = /^(\/[\w\-/#?=&.%]*|https:\/\/[^\s<>"]+)$/;
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const COLUMNAS = 'id, pregunta, variantes, respuesta, enlace, sugerida, activa, orden, veces_usada';

async function auditar(empleadoId, accion, detalle) {
  await pool.query(
    `INSERT INTO registro_accesos (usuario_id, accion, detalle) VALUES ($1, $2, $3)`,
    [empleadoId, accion, detalle]
  );
}

export async function listarPreguntas() {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM preguntas_bot ORDER BY orden, id`);
  return rows;
}

function validar(d) {
  const p = {
    pregunta: texto(d.pregunta),
    variantes: texto(d.variantes).split('\n').map((l) => l.trim()).filter(Boolean).join('\n'),
    respuesta: texto(d.respuesta),
    enlace: texto(d.enlace) || null,
    sugerida: d.sugerida === true,
    activa: d.activa !== false,
  };
  const errores = [];
  if (p.pregunta.length < 5 || p.pregunta.length > 160) errores.push('Pregunta: entre 5 y 160 caracteres');
  if (p.variantes.length > 3000) errores.push('Otras formas de preguntarlo: máximo 3000 caracteres');
  if (p.respuesta.length < 5 || p.respuesta.length > 3000) errores.push('Respuesta: entre 5 y 3000 caracteres');
  if (p.enlace && (!ENLACE.test(p.enlace) || p.enlace.length > 200)) errores.push('Enlace: usa una ruta del sitio (/informacion) o una dirección https://');
  if (errores.length) throw new ErrorNegocio('Revisa los datos de la pregunta', 400, errores);
  return p;
}

export async function crearPregunta(empleadoId, d = {}) {
  const p = validar(d);
  const { rows: [nueva] } = await pool.query(
    `INSERT INTO preguntas_bot (pregunta, variantes, respuesta, enlace, sugerida, activa, orden)
     VALUES ($1,$2,$3,$4,$5,$6, COALESCE((SELECT max(orden) FROM preguntas_bot), 0) + 1) RETURNING ${COLUMNAS}`,
    [p.pregunta, p.variantes, p.respuesta, p.enlace, p.sugerida, p.activa]
  );
  await auditar(empleadoId, 'crear_pregunta_bot', p.pregunta);
  invalidarIndice();
  return nueva;
}

export async function editarPregunta(empleadoId, id, d = {}) {
  const p = validar(d);
  const { rows: [editada] } = await pool.query(
    `UPDATE preguntas_bot SET pregunta=$2, variantes=$3, respuesta=$4, enlace=$5, sugerida=$6, activa=$7, actualizado_en=now()
      WHERE id = $1 RETURNING ${COLUMNAS}`,
    [id, p.pregunta, p.variantes, p.respuesta, p.enlace, p.sugerida, p.activa]
  );
  if (!editada) throw new ErrorNegocio('La pregunta no existe', 404);
  await auditar(empleadoId, 'editar_pregunta_bot', p.pregunta);
  invalidarIndice();
  return editada;
}

export async function eliminarPregunta(empleadoId, id) {
  const { rows: [p] } = await pool.query('DELETE FROM preguntas_bot WHERE id = $1 RETURNING pregunta', [id]);
  if (!p) throw new ErrorNegocio('La pregunta no existe', 404);
  await auditar(empleadoId, 'eliminar_pregunta_bot', p.pregunta);
  invalidarIndice();
}

export async function ordenarPreguntas(empleadoId, ids) {
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) throw new ErrorNegocio('Orden no válido', 400);
  await pool.query(
    `UPDATE preguntas_bot p SET orden = o.pos FROM unnest($1::int[]) WITH ORDINALITY AS o(id, pos) WHERE p.id = o.id`,
    [ids]
  );
  await auditar(empleadoId, 'ordenar_preguntas_bot', ids.join(','));
  invalidarIndice();
  return listarPreguntas();
}

// Lo que el bot no supo responder, agrupado (las más repetidas primero)
export async function listarSinRespuesta() {
  const { rows } = await pool.query(
    `SELECT min(texto) AS texto, count(*)::int AS veces, max(creado_en) AS ultima
       FROM bot_sin_respuesta
      GROUP BY lower(texto)
      ORDER BY count(*) DESC, max(creado_en) DESC
      LIMIT 100`
  );
  return rows;
}

export async function descartarSinRespuesta(empleadoId, textoDescartado) {
  const t = texto(textoDescartado);
  if (!t) throw new ErrorNegocio('Falta el texto', 400);
  await pool.query('DELETE FROM bot_sin_respuesta WHERE lower(texto) = lower($1)', [t]);
  await auditar(empleadoId, 'descartar_pregunta_bot', t.slice(0, 120));
}

// Las preguntas sin respuesta se guardan máximo 60 días
export async function limpiarSinRespuesta() {
  await pool.query(`DELETE FROM bot_sin_respuesta WHERE creado_en < now() - interval '60 days'`);
}
