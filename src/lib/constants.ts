/** Horário de funcionamento (para lógica de disponibilidade) */
export const BUSINESS_HOURS = {
  start: 9, // 09:00
  end: 18, // 18:00
} as const;

/** Intervalo entre sessões (buffer para limpeza) em minutos */
export const BUFFER_TIME_MINUTES = 15;

/** Duração padrão de uma sessão em minutos */
export const DEFAULT_SESSION_MINUTES = 60;
