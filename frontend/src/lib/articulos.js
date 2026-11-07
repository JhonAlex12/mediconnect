// Artículos de "Salud al día".
// Para publicar uno nuevo: agrega un objeto al inicio de la lista (el más reciente primero).
// El "slug" es la dirección: /salud-al-dia/<slug>. Usa solo minúsculas, números y guiones.
// Contenido informativo general: no reemplaza la indicación del médico ni del químico farmacéutico.

export const ARTICULOS = [
  {
    slug: 'que-significa-cada-dato-de-tu-formula',
    titulo: 'Qué significa cada dato de tu fórmula médica',
    fecha: '2026-11-03',
    tema: 'Tu fórmula',
    resumen: 'Código, fecha límite, cantidad y presentación: así se lee la fórmula que te entrega tu IPS.',
    secciones: [
      {
        parrafos: [
          'Cuando el médico te formula, la IPS envía la fórmula directamente a la farmacia. Tú recibes un código con el que puedes consultarla en Mediconnect. Estos son los datos más importantes y para qué sirven.',
        ],
      },
      {
        titulo: 'Código de la fórmula',
        parrafos: [
          'Tiene la forma F-2026-0001. Junto con tu número de documento, es lo que necesitas para consultar si tus medicamentos están disponibles y para pedir tu turno. No lo compartas con personas que no vayan a reclamar por ti.',
        ],
      },
      {
        titulo: 'Fecha límite para reclamar',
        parrafos: [
          'Es el último día en que la farmacia puede entregarte los medicamentos de esa fórmula. Si se vence, tienes que pedir una nueva en tu IPS. Mediconnect te avisa cuando quedan pocos días.',
        ],
      },
      {
        titulo: 'Medicamento, presentación y cantidad',
        parrafos: [
          'La presentación indica la forma y la concentración (por ejemplo, "500 mg tabletas"). La cantidad es el total de unidades formuladas para el tratamiento.',
          'Si la farmacia no tiene todas las unidades, te entrega lo disponible y el resto queda pendiente en la misma fórmula hasta la fecha límite. Cuando vuelvas por lo pendiente no pagas de nuevo la cuota moderadora.',
        ],
      },
      {
        titulo: '¿Algo no coincide?',
        parrafos: [
          'Si un medicamento, la cantidad o tus datos no corresponden con lo que te dijo el médico, no reclames: comunícate con tu IPS para que corrijan la fórmula.',
        ],
      },
    ],
  },
  {
    slug: 'consejos-para-tomar-bien-tus-medicamentos',
    titulo: 'Consejos para tomar bien tus medicamentos',
    fecha: '2026-10-28',
    tema: 'Cuidado en casa',
    resumen: 'Horarios, olvidos y dudas frecuentes: hábitos sencillos para que tu tratamiento funcione.',
    secciones: [
      {
        parrafos: [
          'Un tratamiento funciona mejor cuando se toma como lo indicó el médico. Estos hábitos te pueden ayudar en el día a día.',
        ],
      },
      {
        titulo: 'Sigue las indicaciones tal como te las dieron',
        parrafos: [
          'Respeta la dosis, el horario y la duración del tratamiento, aunque te sientas mejor antes de terminar. No cambies la cantidad ni suspendas un medicamento sin hablar con tu médico.',
        ],
      },
      {
        titulo: 'Usa recordatorios',
        parrafos: [
          'Una alarma en el celular, un pastillero semanal o asociar la toma a una rutina (como el desayuno) ayudan a no olvidar las dosis. Si tomas varios medicamentos, una lista con los horarios a la vista facilita las cosas a ti y a quien te cuida.',
        ],
      },
      {
        titulo: 'Si olvidas una dosis',
        parrafos: [
          'No tomes doble cantidad para compensar. Pregunta a tu médico o al químico farmacéutico qué hacer con ese medicamento en particular, porque la respuesta cambia según el tratamiento.',
        ],
      },
      {
        titulo: 'Evita automedicarte',
        parrafos: [
          'No tomes medicamentos formulados a otra persona ni compartas los tuyos. Cuéntale a tu médico qué otros medicamentos, vitaminas o productos naturales usas, porque algunos pueden interactuar entre sí.',
        ],
      },
      {
        titulo: 'Consulta si algo te preocupa',
        parrafos: [
          'Si notas una reacción que no esperabas, consulta a tu médico. Ante síntomas graves, acude a urgencias.',
        ],
      },
    ],
  },
  {
    slug: 'como-guardar-tus-medicamentos-en-casa',
    titulo: 'Cómo guardar tus medicamentos en casa',
    fecha: '2026-10-20',
    tema: 'Cuidado en casa',
    resumen: 'Dónde guardarlos, qué revisar en el empaque y qué hacer con los que ya vencieron.',
    secciones: [
      {
        parrafos: [
          'Guardar bien los medicamentos ayuda a que conserven su efecto y evita accidentes, sobre todo si hay niños en casa.',
        ],
      },
      {
        titulo: 'Un lugar fresco, seco y sin sol',
        parrafos: [
          'El baño y la cocina no son buenos lugares por el calor y la humedad. Prefiere un cajón o un armario de una habitación. Si el empaque dice que requiere nevera, guárdalo en la parte de abajo, nunca en el congelador.',
        ],
      },
      {
        titulo: 'Siempre en su empaque original',
        parrafos: [
          'El empaque protege el medicamento y trae información importante: nombre, concentración, lote y fecha de vencimiento. Si usas pastillero, llénalo solo para pocos días.',
        ],
      },
      {
        titulo: 'Fuera del alcance de los niños',
        parrafos: [
          'Guárdalos en un lugar alto o con seguro, y no los tomes delante de los niños como si fueran dulces.',
        ],
      },
      {
        titulo: 'Revisa el vencimiento',
        parrafos: [
          'Una vez al mes revisa las fechas. No uses medicamentos vencidos ni los que cambiaron de color, olor o textura. No los tires a la basura ni al sanitario: pregunta en la farmacia dónde está el punto de recolección más cercano.',
        ],
      },
    ],
  },
];

export const buscarArticulo = (slug) => ARTICULOS.find((a) => a.slug === slug);

// "2026-11-03" → "3 de noviembre de 2026"
export const fechaArticulo = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};
