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