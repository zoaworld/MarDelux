import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./config";
import { BUSINESS_HOURS, BUFFER_TIME_MINUTES } from "@/lib/constants";
import { getCached, invalidate, CACHE_KEYS, CACHE_TTL } from "./cache";

const CONFIG_COLLECTION = "config";
const HORARIO_DOC_ID = "horario";
const SITE_DOC_ID = "site";

export interface SiteConfig {
  nomeEmpresa?: string;
  email?: string;
  telefone?: string;
}

/** 0 = Domingo, 1 = Segunda, ..., 6 = Sábado */
export interface DiaSemanaConfig {
  diaSemana: number;
  abre: string;   // "09:00"
  fecha: string;  // "18:00"
  fechado?: boolean;
}

export interface FeriadoConfig {
  data: string;   // "YYYY-MM-DD"
  fechado: boolean;
  abre?: string;
  fecha?: string;
}

export interface HorarioConfig {
  bufferMinutes: number;
  /** Fallback quando diasSemana não está preenchido */
  startHour?: number;
  endHour?: number;
  /** Horário por dia da semana (0=Dom .. 6=Sab). Se vazio, usa startHour/endHour. */
  diasSemana?: DiaSemanaConfig[];
  /** Datas especiais: feriados ou exceções */
  feriados?: FeriadoConfig[];
}

const defaultDiasSemana: DiaSemanaConfig[] = [
  { diaSemana: 0, abre: "09:00", fecha: "18:00", fechado: false },
  { diaSemana: 1, abre: "09:00", fecha: "18:00", fechado: false },
  { diaSemana: 2, abre: "09:00", fecha: "18:00", fechado: false },
  { diaSemana: 3, abre: "09:00", fecha: "18:00", fechado: false },
  { diaSemana: 4, abre: "09:00", fecha: "18:00", fechado: false },
  { diaSemana: 5, abre: "09:00", fecha: "18:00", fechado: false },
  { diaSemana: 6, abre: "09:00", fecha: "18:00", fechado: false },
];

const defaultConfig: HorarioConfig = {
  startHour: BUSINESS_HOURS.start,
  endHour: BUSINESS_HOURS.end,
  bufferMinutes: BUFFER_TIME_MINUTES,
  diasSemana: defaultDiasSemana,
  feriados: [],
};

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Para uma data YYYY-MM-DD e config, devolve start/end em minutos (do dia) ou null se fechado */
export function getHorarioParaData(dataStr: string, config: HorarioConfig): { start: number; end: number; buffer: number } | null {
  const d = new Date(dataStr + "T12:00:00");
  const diaSemana = d.getDay();
  const buffer = config.bufferMinutes ?? BUFFER_TIME_MINUTES;

  const feriado = config.feriados?.find((f) => f.data === dataStr);
  if (feriado?.fechado) return null;
  if (feriado?.abre != null && feriado?.fecha != null) {
    return {
      start: parseTimeToMinutes(feriado.abre),
      end: parseTimeToMinutes(feriado.fecha),
      buffer,
    };
  }

  const dias = config.diasSemana;
  if (dias?.length) {
    const diaConfig = dias.find((x) => x.diaSemana === diaSemana);
    if (diaConfig?.fechado || !diaConfig) return null;
    return {
      start: parseTimeToMinutes(diaConfig.abre),
      end: parseTimeToMinutes(diaConfig.fecha),
      buffer,
    };
  }

  const start = (config.startHour ?? BUSINESS_HOURS.start) * 60;
  const end = (config.endHour ?? BUSINESS_HOURS.end) * 60;
  return { start, end, buffer };
}

async function fetchHorarioConfig(): Promise<HorarioConfig> {
  if (!db) return defaultConfig;
  try {
    const ref = doc(db, CONFIG_COLLECTION, HORARIO_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) return defaultConfig;
    const d = snap.data();
    const diasSemana = d.diasSemana as DiaSemanaConfig[] | undefined;
    const feriados = (d.feriados as FeriadoConfig[] | undefined) ?? [];
    return {
      startHour: typeof d.startHour === "number" ? d.startHour : defaultConfig.startHour,
      endHour: typeof d.endHour === "number" ? d.endHour : defaultConfig.endHour,
      bufferMinutes: typeof d.bufferMinutes === "number" ? d.bufferMinutes : defaultConfig.bufferMinutes,
      diasSemana: Array.isArray(diasSemana) && diasSemana.length > 0 ? diasSemana : defaultConfig.diasSemana,
      feriados: Array.isArray(feriados) ? feriados : [],
    };
  } catch {
    return defaultConfig;
  }
}

/** Obtém horário de funcionamento e buffer (com cache 2 min) */
export async function getHorarioConfig(): Promise<HorarioConfig> {
  return getCached(CACHE_KEYS.horario, CACHE_TTL.config, fetchHorarioConfig);
}

/** Guarda horário de funcionamento no Firestore */
export async function setHorarioConfig(config: HorarioConfig): Promise<void> {
  if (!db) throw new Error("Firebase não está configurado.");
  const ref = doc(db, CONFIG_COLLECTION, HORARIO_DOC_ID);
  await setDoc(ref, {
    startHour: config.startHour ?? defaultConfig.startHour,
    endHour: config.endHour ?? defaultConfig.endHour,
    bufferMinutes: config.bufferMinutes,
    diasSemana: config.diasSemana ?? defaultConfig.diasSemana,
    feriados: config.feriados ?? [],
  });
  invalidate(CACHE_KEYS.horario);
}

async function fetchSiteConfig(): Promise<SiteConfig> {
  if (!db) return {};
  try {
    const ref = doc(db, CONFIG_COLLECTION, SITE_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) return {};
    const d = snap.data();
    return {
      nomeEmpresa: typeof d.nomeEmpresa === "string" ? d.nomeEmpresa : undefined,
      email: typeof d.email === "string" ? d.email : undefined,
      telefone: typeof d.telefone === "string" ? d.telefone : undefined,
    };
  } catch {
    return {};
  }
}

/** Obtém configuração geral do site (nome, contacto) — com cache 2 min */
export async function getSiteConfig(): Promise<SiteConfig> {
  return getCached(CACHE_KEYS.site, CACHE_TTL.config, fetchSiteConfig);
}

/** Guarda configuração geral do site */
export async function setSiteConfig(config: SiteConfig): Promise<void> {
  if (!db) throw new Error("Firebase não está configurado.");
  const ref = doc(db, CONFIG_COLLECTION, SITE_DOC_ID);
  await setDoc(ref, {
    nomeEmpresa: config.nomeEmpresa ?? "",
    email: config.email ?? "",
    telefone: config.telefone ?? "",
  });
  invalidate(CACHE_KEYS.site);
}
