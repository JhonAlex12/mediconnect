// Contenido con el que arranca el sitio (se carga solo si las tablas están vacías).
// Después, todo se edita desde el panel: Contenido del sitio.

export const ARTICULOS = [
  {
    "slug": "que-significa-cada-dato-de-tu-formula",
    "titulo": "Qué significa cada dato de tu fórmula médica",
    "tema": "Tu fórmula",
    "resumen": "Código, fecha límite, cantidad y presentación: así se lee la fórmula que te entrega tu IPS.",
    "fecha": "2026-11-03",
    "contenido": "Cuando el médico te formula, la IPS envía la fórmula directamente a la farmacia. Tú recibes un código con el que puedes consultarla en Mediconnect. Estos son los datos más importantes y para qué sirven.\n\n## Código de la fórmula\n\nTiene la forma F-2026-0001. Junto con tu número de documento, es lo que necesitas para consultar si tus medicamentos están disponibles y para pedir tu turno. No lo compartas con personas que no vayan a reclamar por ti.\n\n## Fecha límite para reclamar\n\nEs el último día en que la farmacia puede entregarte los medicamentos de esa fórmula. Si se vence, tienes que pedir una nueva en tu IPS. Mediconnect te avisa cuando quedan pocos días.\n\n## Medicamento, presentación y cantidad\n\nLa presentación indica la forma y la concentración (por ejemplo, \"500 mg tabletas\"). La cantidad es el total de unidades formuladas para el tratamiento.\n\nSi la farmacia no tiene todas las unidades, te entrega lo disponible y el resto queda pendiente en la misma fórmula hasta la fecha límite. Cuando vuelvas por lo pendiente no pagas de nuevo la cuota moderadora.\n\n## ¿Algo no coincide?\n\nSi un medicamento, la cantidad o tus datos no corresponden con lo que te dijo el médico, no reclames: comunícate con tu IPS para que corrijan la fórmula."
  },
  {
    "slug": "consejos-para-tomar-bien-tus-medicamentos",
    "titulo": "Consejos para tomar bien tus medicamentos",
    "tema": "Cuidado en casa",
    "resumen": "Horarios, olvidos y dudas frecuentes: hábitos sencillos para que tu tratamiento funcione.",
    "fecha": "2026-10-28",
    "contenido": "Un tratamiento funciona mejor cuando se toma como lo indicó el médico. Estos hábitos te pueden ayudar en el día a día.\n\n## Sigue las indicaciones tal como te las dieron\n\nRespeta la dosis, el horario y la duración del tratamiento, aunque te sientas mejor antes de terminar. No cambies la cantidad ni suspendas un medicamento sin hablar con tu médico.\n\n## Usa recordatorios\n\nUna alarma en el celular, un pastillero semanal o asociar la toma a una rutina (como el desayuno) ayudan a no olvidar las dosis. Si tomas varios medicamentos, una lista con los horarios a la vista facilita las cosas a ti y a quien te cuida.\n\n## Si olvidas una dosis\n\nNo tomes doble cantidad para compensar. Pregunta a tu médico o al químico farmacéutico qué hacer con ese medicamento en particular, porque la respuesta cambia según el tratamiento.\n\n## Evita automedicarte\n\nNo tomes medicamentos formulados a otra persona ni compartas los tuyos. Cuéntale a tu médico qué otros medicamentos, vitaminas o productos naturales usas, porque algunos pueden interactuar entre sí.\n\n## Consulta si algo te preocupa\n\nSi notas una reacción que no esperabas, consulta a tu médico. Ante síntomas graves, acude a urgencias."
  },
  {
    "slug": "como-guardar-tus-medicamentos-en-casa",
    "titulo": "Cómo guardar tus medicamentos en casa",
    "tema": "Cuidado en casa",
    "resumen": "Dónde guardarlos, qué revisar en el empaque y qué hacer con los que ya vencieron.",
    "fecha": "2026-10-20",
    "contenido": "Guardar bien los medicamentos ayuda a que conserven su efecto y evita accidentes, sobre todo si hay niños en casa.\n\n## Un lugar fresco, seco y sin sol\n\nEl baño y la cocina no son buenos lugares por el calor y la humedad. Prefiere un cajón o un armario de una habitación. Si el empaque dice que requiere nevera, guárdalo en la parte de abajo, nunca en el congelador.\n\n## Siempre en su empaque original\n\nEl empaque protege el medicamento y trae información importante: nombre, concentración, lote y fecha de vencimiento. Si usas pastillero, llénalo solo para pocos días.\n\n## Fuera del alcance de los niños\n\nGuárdalos en un lugar alto o con seguro, y no los tomes delante de los niños como si fueran dulces.\n\n## Revisa el vencimiento\n\nUna vez al mes revisa las fechas. No uses medicamentos vencidos ni los que cambiaron de color, olor o textura. No los tires a la basura ni al sanitario: pregunta en la farmacia dónde está el punto de recolección más cercano."
  }
];

export const SECCIONES_INFORMACION = [
  {
    "ancla": "requisitos",
    "titulo": "Requisitos para reclamar",
    "contenido": "- Tu documento de identidad.\n- El código de tu fórmula (tiene la forma F-2026-0001). Te lo entrega el médico o la IPS.\n- Que la fórmula esté vigente: puedes reclamar hasta la fecha límite que aparece al consultarla.\n- El valor de la cuota moderadora, si te corresponde pagarla (ver abajo).\n\n**Si reclama otra persona por ti**, en la ventanilla se registran su nombre y su número de documento. Debe llevar el código de tu fórmula y tu número de documento.\n\nCon el **turno virtual** tus medicamentos quedan apartados durante 2 horas. Si se te hace tarde, puedes pedir 20 minutos más una sola vez con el botón \"Voy retrasado\".\n\n[Consultar mi fórmula](/paciente)",
    "orden": 1
  },
  {
    "ancla": "cuotas",
    "titulo": "Cuotas moderadoras y exenciones",
    "contenido": "La cuota moderadora es un valor fijo que pagan los afiliados del **régimen contributivo** al reclamar medicamentos ambulatorios. Depende de tu ingreso base de cotización (IBC):\n\n{tabla_cuotas}\n\n**Se paga una sola vez por fórmula**, en la ventanilla, en efectivo, transferencia o tarjeta. Si vuelves por medicamentos pendientes de la misma fórmula, no pagas de nuevo. Sin el pago no se pueden entregar los medicamentos.\n\n**No pagan cuota moderadora:**\n\n- Los afiliados del régimen subsidiado.\n- Los programas de promoción y prevención.\n- El control prenatal.\n- Las enfermedades de alto costo (por ejemplo, cáncer o VIH).\n- Las urgencias.\n\nAl consultar tu fórmula verás el valor exacto que te corresponde, según los datos que envió tu IPS.",
    "orden": 2
  },
  {
    "ancla": "pendientes",
    "titulo": "Entregas pendientes",
    "contenido": "Si la farmacia no tiene todas las unidades de un medicamento, te entrega lo disponible y **lo demás queda pendiente en la misma fórmula**. Puedes reclamarlo hasta la fecha límite.\n\nTe avisamos cuando cambie la disponibilidad. Al consultar tu fórmula verás cuánto te falta de cada medicamento, y para reclamarlo solo tienes que pedir un nuevo turno.",
    "orden": 3
  },
  {
    "ancla": "preferencial",
    "titulo": "Atención preferencial",
    "contenido": "Tienen prioridad en la fila:\n\n- Adultos mayores.\n- Mujeres en embarazo.\n- Personas con discapacidad.\n\nIndícalo al pedir tu turno virtual o al llegar a la farmacia, y tu turno se ubicará antes en la fila.",
    "orden": 4
  },
  {
    "ancla": "derechos",
    "titulo": "Derechos y deberes del paciente",
    "contenido": "**En la farmacia tienes derecho a:**\n\n- Recibir un trato digno y respetuoso.\n- Saber antes de ir qué medicamentos hay disponibles y cuánto debes pagar.\n- Recibir información clara sobre tus medicamentos y lo que queda pendiente.\n- Que tus datos personales y de salud se manejen de forma confidencial.\n- Presentar peticiones, quejas, reclamos y sugerencias, y recibir respuesta.\n\n**Y el deber de:**\n\n- Presentar tu documento y dar información verdadera.\n- Llegar a tiempo a tu turno, o cancelarlo si no puedes ir, para que otro paciente lo aproveche.\n- Tratar con respeto al personal y a los demás pacientes.\n- Usar los medicamentos como los indicó tu médico y no entregarlos a otras personas.\n\nEste es un resumen para la farmacia. La carta completa de derechos y deberes te la entrega tu EPS.",
    "orden": 5
  },
  {
    "ancla": "datos",
    "titulo": "Tratamiento de datos personales",
    "contenido": "Usamos tus datos (nombre, documento, teléfono, dirección y fórmula) solo para gestionar la entrega de tus medicamentos, tu turno, tus domicilios y los avisos que te enviamos, según la Ley 1581 de 2012 de protección de datos personales.\n\nSolo el personal autorizado de la farmacia puede verlos, y queda registro de cada consulta. Puedes pedir conocer, actualizar o corregir tus datos por los canales de PQRS.",
    "orden": 6
  },
  {
    "ancla": "pqrs",
    "titulo": "Peticiones, quejas y reclamos (PQRS)",
    "contenido": "Puedes comunicarte con nosotros por cualquiera de estos canales:\n\n- En la ventanilla de la farmacia ({horario}).\n- Por teléfono: {telefono}.\n- Por correo: {correo}.\n\nIndica tu nombre, tu documento, el código de la fórmula (si aplica) y lo que necesitas.",
    "orden": 7
  }
];

export const SLIDES = [
  {
    "nombre": "Reclama tus medicamentos",
    "texto_alt": "Mediconnect. Tu salud, sin complicaciones: ¡reclama tus medicamentos desde casa! Evita filas y ahorra tiempo.",
    "imagen": "/img/banner-familia-1600.webp",
    "imagen_movil": "/img/banner-familia-900.webp",
    "enlace": null,
    "fondo": null,
    "orden": 1
  },
  {
    "nombre": "El bienestar de tu familia",
    "texto_alt": "El bienestar de tu familia es nuestra prioridad. Trabajamos de la mano para que disfrutes cada momento con tranquilidad.",
    "imagen": "/img/slide-bienestar-1600.webp",
    "imagen_movil": "/img/slide-bienestar-900.webp",
    "enlace": null,
    "fondo": "linear-gradient(to right, #f2ebe1 0%, #ece3d8 45%, #b9ada1 100%)",
    "orden": 2
  },
  {
    "nombre": "IPS y droguería en un solo lugar",
    "texto_alt": "La salud y el bienestar en un solo lugar: IPS y droguería juntas para cuidar de ti y de tu familia. Conoce más.",
    "imagen": "/img/slide-sede-1600.webp",
    "imagen_movil": "/img/slide-sede-900.webp",
    "enlace": "/#quienes-somos",
    "fondo": "linear-gradient(to right, #fbfdfd 0%, #eef7f9 45%, #a9d3db 100%)",
    "orden": 3
  }
];

// Datos de contacto PROVISIONALES: reemplazar desde el panel
export const CONTACTO = {
  "telefono": "(000) 000 0000",
  "correo": "contacto@ejemplo.com",
  "direccion": "Dirección de la farmacia",
  "ciudad": "Cúcuta, Norte de Santander",
  "horario": "Lun a sáb · 7:00 a. m. – 7:00 p. m.",
  "lat": 7.8835,
  "lon": -72.505
};

// Preguntas frecuentes iniciales de Mediconnect Bot (el administrador las edita en el panel).
// {telefono} {correo} {horario} {direccion} {ciudad} {costo_envio} y {tabla_cuotas} se llenan solos.
export const PREGUNTAS_BOT = [
  {
    pregunta: '¿Cómo consulto mi fórmula?',
    variantes: 'ver mi fórmula\nqué medicamentos hay disponibles\nhay disponibilidad de mis medicamentos\ntienen mis medicamentos\nqué me van a entregar\nconsultar disponibilidad',
    respuesta: 'Entra a **Consultar fórmula** y escribe tu número de documento y el código de la fórmula (tiene la forma F-2026-0001; te lo entrega el médico o la IPS).\n\nVerás qué medicamentos hay disponibles, lo que te queda pendiente y el valor de la cuota moderadora que te corresponde.',
    enlace: '/paciente', sugerida: true,
  },
  {
    pregunta: 'No me aparece mi fórmula',
    variantes: 'no me sale la fórmula\ncon mi cédula no aparece la fórmula\nno encuentra mi fórmula\nel código no funciona\ndice que la fórmula no existe\nno aparece mi código',
    respuesta: 'Revisa que el **número de documento** y el **código de la fórmula** (F-2026-0001) estén bien escritos. La fórmula debe estar a tu nombre.\n\nSi la acabas de recibir, puede que la IPS aún no la haya enviado a la farmacia. Si sigue sin aparecer, comunícate al **{telefono}**.',
    enlace: '/paciente', sugerida: false,
  },
  {
    pregunta: '¿Cómo pido un turno virtual?',
    variantes: 'sacar turno\ntomar un turno\npedir ficha\nhacer la fila desde el celular\nreservar mis medicamentos\nquiero un turno\ncita para reclamar',
    respuesta: 'Consulta tu fórmula en **Pedir turno virtual** y, si hay medicamentos disponibles, toca **Pedir turno**.\n\nTus medicamentos quedan **apartados durante 2 horas**. Cuando llegues a la farmacia, espera a que te llamen en la pantalla de la sala.',
    enlace: '/paciente', sugerida: false,
  },
  {
    pregunta: 'Voy a llegar tarde a mi turno',
    variantes: 'me retrasé\nno alcanzo a llegar\nse me hizo tarde\nmás tiempo para el turno\nno puedo ir a mi turno',
    respuesta: 'En la página de tu turno toca **Voy retrasado** y te damos **20 minutos más** (se puede usar una sola vez).\n\nSi ya no puedes ir, cancela el turno para que otro paciente lo aproveche. Tu fórmula sigue vigente y puedes pedir un turno nuevo después.',
    enlace: '/paciente', sugerida: false,
  },
  {
    pregunta: '¿Qué necesito para reclamar mis medicamentos?',
    variantes: 'requisitos para reclamar\nqué documentos llevo\nqué debo llevar a la farmacia\nqué piden para entregar los medicamentos',
    respuesta: '- Tu documento de identidad.\n- El código de tu fórmula (F-2026-0001).\n- Que la fórmula esté vigente (hasta la fecha límite que ves al consultarla).\n- El valor de la cuota moderadora, si te corresponde pagarla.',
    enlace: '/informacion#requisitos', sugerida: false,
  },
  {
    pregunta: '¿Otra persona puede reclamar por mí?',
    variantes: 'puede reclamar un familiar\nmi mamá puede recoger mi fórmula\nenviar a alguien a reclamar\nreclamar los medicamentos de otra persona\nautorizar a alguien',
    respuesta: 'Sí. La persona debe llevar **el código de tu fórmula y tu número de documento**. En la ventanilla se registran su nombre y su número de documento.',
    enlace: '/informacion#requisitos', sugerida: false,
  },
  {
    pregunta: '¿Cuánto pago de cuota moderadora?',
    variantes: 'valor de la cuota moderadora\ncuánto cuesta reclamar\ncuánto debo pagar\ncuánto vale el copago\ntengo que pagar algo',
    respuesta: 'La pagan los afiliados del **régimen contributivo** y depende de tu ingreso base de cotización:\n\n{tabla_cuotas}\n\nSe paga **una sola vez por fórmula**. Al consultar tu fórmula ves el valor exacto que te corresponde.',
    enlace: '/informacion#cuotas', sugerida: true,
  },
  {
    pregunta: '¿Quién no paga cuota moderadora?',
    variantes: 'exenciones de la cuota\nsoy del subsidiado tengo que pagar\nno pagan cuota\nquiénes están exentos',
    respuesta: '**No pagan cuota moderadora:**\n\n- Los afiliados del régimen subsidiado.\n- Los programas de promoción y prevención.\n- El control prenatal.\n- Las enfermedades de alto costo (por ejemplo, cáncer o VIH).\n- Las urgencias.',
    enlace: '/informacion#cuotas', sugerida: false,
  },
  {
    pregunta: '¿Cómo puedo pagar?',
    variantes: 'medios de pago\nreciben tarjeta\npuedo pagar con transferencia\naceptan nequi\npago en efectivo',
    respuesta: 'En la ventanilla puedes pagar en **efectivo, transferencia o tarjeta**. En los domicilios pagas al recibir, en efectivo, transferencia o datáfono.',
    enlace: '/informacion#cuotas', sugerida: false,
  },
  {
    pregunta: '¿Hacen domicilios?',
    variantes: 'quiero un domicilio\nme llevan los medicamentos a la casa\ncuánto cuesta el domicilio\nvalor del envío\nmandan a domicilio\ncómo pido un domicilio',
    respuesta: 'Sí, **solo en Cúcuta**. El envío cuesta **{costo_envio}**.\n\n- Crea tu cuenta y confirma tu correo.\n- En **Mi cuenta**, agrega tu fórmula con el código que te dio la IPS.\n- Toca **Pedir domicilio**. Te llamamos para confirmar y pagas el envío y la cuota al recibir.',
    enlace: '/#domicilio', sugerida: true,
  },
  {
    pregunta: '¿Cuál es el horario?',
    variantes: 'a qué hora abren\na qué hora cierran\natienden los domingos\nestán abiertos hoy\nhorario de atención',
    respuesta: 'Nuestro horario de atención: **{horario}**',
    enlace: '/#ubicacion', sugerida: true,
  },
  {
    pregunta: '¿Dónde quedan?',
    variantes: 'dirección de la farmacia\ncómo llego\nubicación\ndónde están ubicados',
    respuesta: 'Estamos en **{direccion}**, {ciudad}.',
    enlace: '/#ubicacion', sugerida: false,
  },
  {
    pregunta: '¿Cómo me comunico con la farmacia?',
    variantes: 'número de teléfono\nteléfono de la farmacia\nwhatsapp\ntienen whatsapp\ncorreo electrónico\nquiero hablar con alguien\ncontacto',
    respuesta: '- Teléfono: **{telefono}**\n- Correo: **{correo}**\n- En la ventanilla: {horario}',
    enlace: null, sugerida: false,
  },
  {
    pregunta: 'No me entregaron todos los medicamentos',
    variantes: 'me quedaron debiendo\nmedicamentos pendientes\nno había el medicamento\nestá agotado\ncuándo me entregan lo que falta\nentrega incompleta',
    respuesta: 'Lo que no se pudo entregar **queda pendiente en la misma fórmula** y puedes reclamarlo hasta la fecha límite, sin pagar la cuota otra vez.\n\nAl consultar tu fórmula ves cuánto te falta de cada medicamento. Para reclamarlo, pide un turno nuevo.',
    enlace: '/informacion#pendientes', sugerida: false,
  },
  {
    pregunta: '¿Quién tiene atención preferencial?',
    variantes: 'adulto mayor\nestoy embarazada\npersona con discapacidad\nprioridad en la fila\ntercera edad',
    respuesta: 'Tienen prioridad en la fila los **adultos mayores, las mujeres en embarazo y las personas con discapacidad**.\n\nIndícalo al pedir tu turno virtual o al llegar a la farmacia.',
    enlace: '/informacion#preferencial', sugerida: false,
  },
  {
    pregunta: '¿Cómo pongo una queja o sugerencia?',
    variantes: 'pqrs\nhacer un reclamo\nponer una queja\nfelicitar a la farmacia\nme atendieron mal',
    respuesta: 'Puedes presentar peticiones, quejas, reclamos y sugerencias:\n\n- En la ventanilla ({horario}).\n- Por teléfono: {telefono}.\n- Por correo: {correo}.\n\nIndica tu nombre, tu documento, el código de la fórmula (si aplica) y lo que necesitas.',
    enlace: '/informacion#pqrs', sugerida: false,
  },
  {
    pregunta: '¿Para qué sirve crear una cuenta?',
    variantes: 'crear cuenta\nregistrarme\ncómo me registro\ninscribirme en la página',
    respuesta: 'Con tu cuenta puedes **pedir domicilios**, ver tus fórmulas y su historial en un solo lugar. Solo necesitas tus datos y confirmar tu correo.\n\nPara consultar una fórmula o pedir un turno virtual **no** necesitas cuenta.',
    enlace: '/registro', sugerida: false,
  },
  {
    pregunta: 'Olvidé mi contraseña',
    variantes: 'no recuerdo la clave\nrecuperar contraseña\ncambiar mi contraseña\nno puedo entrar a mi cuenta',
    respuesta: 'Toca **Ingresar** y luego **¿Olvidaste tu contraseña?**. Te enviamos a tu correo un enlace para crear una nueva (vence en 60 minutos).',
    enlace: null, sugerida: false,
  },
  {
    pregunta: 'No me llegó el correo de confirmación',
    variantes: 'confirmar mi correo\nverificar el correo\nno me llega el correo\nreenviar confirmación',
    respuesta: 'Revisa la carpeta de **spam o correo no deseado**. Si no está, entra a **Mi cuenta** y toca **Reenviar el correo**.',
    enlace: '/mi-cuenta', sugerida: false,
  },
  {
    pregunta: 'Mi fórmula se venció',
    variantes: 'pasó la fecha límite\nhasta cuándo puedo reclamar\ncuánto dura la fórmula\nfórmula vencida',
    respuesta: 'Puedes reclamar hasta la **fecha límite** que aparece al consultar la fórmula. Después de esa fecha ya no se puede entregar: pide una fórmula nueva a tu médico o a tu IPS.',
    enlace: '/paciente', sugerida: false,
  },
  {
    pregunta: 'La página me sale con error',
    variantes: 'me está dando error\nno funciona la página\nno me deja entrar\nno carga\nsale un error\nla página está fallando',
    respuesta: 'Lamento el inconveniente. Prueba esto:\n\n- Recarga la página.\n- Revisa tu conexión a internet.\n- Si te sale un aviso, léelo: por ejemplo, el código de la fórmula o el documento pueden estar mal escritos.\n\nSi sigue fallando, comunícate al **{telefono}** y cuéntanos qué estabas haciendo.',
    enlace: null, sugerida: false,
  },
];

// Inserta el contenido inicial en las tablas que estén vacías (se puede correr varias veces)
export async function sembrarContenido(cliente) {
  const vacia = async (tabla) => (await cliente.query(`SELECT NOT EXISTS (SELECT 1 FROM ${tabla}) AS v`)).rows[0].v;

  if (await vacia('articulos')) {
    for (const a of ARTICULOS) {
      await cliente.query(
        `INSERT INTO articulos (slug, titulo, tema, resumen, contenido, fecha) VALUES ($1,$2,$3,$4,$5,$6)`,
        [a.slug, a.titulo, a.tema, a.resumen, a.contenido, a.fecha]
      );
    }
  }
  if (await vacia('secciones_informacion')) {
    for (const s of SECCIONES_INFORMACION) {
      await cliente.query(
        `INSERT INTO secciones_informacion (ancla, titulo, contenido, orden) VALUES ($1,$2,$3,$4)`,
        [s.ancla, s.titulo, s.contenido, s.orden]
      );
    }
  }
  if (await vacia('slides')) {
    for (const s of SLIDES) {
      await cliente.query(
        `INSERT INTO slides (nombre, texto_alt, imagen, imagen_movil, enlace, fondo, orden) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [s.nombre, s.texto_alt, s.imagen, s.imagen_movil, s.enlace, s.fondo, s.orden]
      );
    }
  }
  await cliente.query(
    `INSERT INTO ajustes_sitio (clave, datos) VALUES ('contacto', $1) ON CONFLICT (clave) DO NOTHING`,
    [CONTACTO]
  );
  if (await vacia('preguntas_bot')) {
    for (const [i, p] of PREGUNTAS_BOT.entries()) {
      await cliente.query(
        `INSERT INTO preguntas_bot (pregunta, variantes, respuesta, enlace, sugerida, orden) VALUES ($1,$2,$3,$4,$5,$6)`,
        [p.pregunta, p.variantes, p.respuesta, p.enlace, p.sugerida, i + 1]
      );
    }
  }
}
