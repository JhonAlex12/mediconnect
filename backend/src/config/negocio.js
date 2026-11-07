// Zona horaria de la farmacia: define qué es "hoy" para fechas y turnos
export const ZONA_HORARIA = 'America/Bogota';

// Cuántos días antes de la fecha límite se muestra la alerta (RF-08)
export const DIAS_ALERTA = 3;

// Cuánto dura la reserva de medicamentos al tomar el turno (RN-12)
export const HORAS_RESERVA = 2;

// Minutos extra del botón "Voy retrasado", una sola vez (RN-13)
export const MINUTOS_RETRASO = 20;

// Minutos promedio de atención por turno, para el tiempo estimado
export const MINUTOS_POR_TURNO = 5;

// Faltas seguidas a partir de las cuales se pide confirmación extra (RN-11)
export const FALTAS_CONFIRMACION = 2;

// Faltas seguidas a partir de las cuales solo se permite un turno virtual por día (RN-11)
export const FALTAS_LIMITE_DIARIO = 3;

// Estados en los que un turno sigue "vivo" (RN-01)
export const ESTADOS_ACTIVOS = ['reservado', 'en_camino', 'presente', 'llamado', 'en_pausa'];

// Prioridades permitidas (RN-05)
export const PRIORIDADES = ['ninguna', 'adulto_mayor', 'embarazada', 'discapacidad'];
// Minutos de espera a un turno llamado antes de pausarlo solo (RN-07: 3 a 5)
export const MINUTOS_GRACIA = 4;

// Minutos en pausa tras los cuales el turno vence (RN-09: 30 a 60)
export const MINUTOS_VENCE_PAUSA = 30;

// Cada cuánto corren las tareas automáticas (cron con segundos: cada 30 s)
export const CRON_MANTENIMIENTO = '*/30 * * * * *';

// ---------- Cobro de la cuota moderadora ----------
export const REGIMENES = ['contributivo', 'subsidiado'];
export const RANGOS_INGRESO = ['A', 'B', 'C'];   // A < 2 SMLMV, B 2 a 5, C > 5

// Casos en los que no se cobra (texto que ve el paciente y el auxiliar)
export const EXENCIONES = {
  promocion_prevencion: 'Programa de promoción y prevención',
  control_prenatal: 'Control prenatal',
  alto_costo: 'Enfermedad de alto costo',
  urgencia: 'Urgencia',
};

export const MEDIOS_PAGO = ['efectivo', 'transferencia', 'datafono'];

// ---------- Cajas de atención ----------
// 1 a 5: generales. 6: preferencial (adultos mayores, embarazadas y personas con discapacidad)
export const CAJAS = [1, 2, 3, 4, 5, 6];
export const CAJA_PREFERENCIAL = 6;
