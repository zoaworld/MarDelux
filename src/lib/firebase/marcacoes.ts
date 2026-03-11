import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { BUFFER_TIME_MINUTES, SLOT_STEP_MINUTES } from "@/lib/constants";
import { getHorarioParaData, getHorarioConfig, type HorarioConfig } from "./app-settings";
import { getCached, invalidate, CACHE_KEYS, CACHE_TTL, getCacheKeyForEmail } from "./cache";

const COLLECTION = "marcacoes";

export interface MarcacaoInput {
  clienteEmail: string;
  clienteNome: string;
  clienteTelefone?: string;
  /** Quando existe ficha do cliente (match email+telefone), enviar id para ligar a marcação à ficha */
  clienteId?: string;
  servicoId: string;
  servicoNome: string;
  duracaoMinutos: number;
  preco: number;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  /** Escolha do cliente: na_sessao (default) ou agora (MB Way) */
  preferenciaPagamento?: "na_sessao" | "agora";
  /** Parceiro que indicou (referral) */
  parceiroId?: string;
  parceiroCodigo?: string;
  /** Nome do parceiro que indicou o cliente (da ficha), para exibir "Origem" na agenda mesmo em fallback */
  origemParceiroNome?: string;
  precoOriginal?: number;
  descontoParceiro?: number;
  primeiraSessaoIndicacao?: boolean;
  /** Evento associado (checkout de evento) */
  eventoId?: string;
  /** Código promocional usado (evento ou site) */
  codigoPromocionalId?: string;
  /** Desconto em € aplicado por código promocional */
  descontoEvento?: number;
}

function timeToMinutes(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm ?? 0);
}

function minutesToTime(m: number): string {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Devolve marcações do dia (apenas confirmadas/pendentes para bloquear slots) */
export async function getMarcacoesByDate(dataStr: string) {
  if (!db) return [];
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where("data", "==", dataStr),
    where("status", "in", ["pendente", "confirmada"])
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      horaInicio: x.horaInicio as string,
      horaFim: x.horaFim as string,
      duracaoMinutos: x.duracaoMinutos as number,
    };
  });
}

/** Bloco de tempo consumido no dia (marcação + buffer). startMin/endMin em minutos desde 00:00. */
export interface BlocoOcupado {
  startMin: number;
  endMin: number;
  horaInicio: string;
  horaFim: string;
  /** Fim real do serviço (sem buffer); endMin = fim real + buffer */
  servicoFimMin: number;
}

/** Intervalo livre na timeline do dia */
export interface IntervaloDisponivel {
  startMin: number;
  endMin: number;
  horaInicio: string;
  horaFim: string;
}

/** Timeline do dia: horário de abertura/fecho, buffer, blocos ocupados (serviço+buffer) e intervalos livres */
export interface TimelineDia {
  dayStart: number;
  dayEnd: number;
  buffer: number;
  occupied: BlocoOcupado[];
  available: IntervaloDisponivel[];
  horaAbre: string;
  horaFecha: string;
}

function mergeOverlapping(blocks: { start: number; end: number }[]): { start: number; end: number }[] {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/**
 * Constrói a timeline de disponibilidade do dia: cada marcação consome serviço + buffer.
 * O próximo cliente só pode marcar a partir do fim do bloco (horaFim + buffer).
 */
export function getTimelineDia(
  dataStr: string,
  ocupados: { horaInicio: string; horaFim: string }[],
  config?: HorarioConfig | null
): TimelineDia | null {
  let START: number;
  let END: number;
  let buffer: number;

  if (config) {
    const horario = getHorarioParaData(dataStr, config);
    if (!horario) return null;
    START = horario.start;
    END = horario.end;
    buffer = horario.buffer;
  } else {
    START = 9 * 60;
    END = 18 * 60;
    buffer = BUFFER_TIME_MINUTES;
  }

  const blocosOcupados: BlocoOcupado[] = ocupados.map((o) => {
    const startMin = timeToMinutes(o.horaInicio);
    const servicoFimMin = timeToMinutes(o.horaFim);
    const endMin = servicoFimMin + buffer;
    return {
      startMin,
      endMin,
      horaInicio: o.horaInicio,
      horaFim: o.horaFim,
      servicoFimMin,
    };
  });

  const merged = mergeOverlapping(blocosOcupados.map((b) => ({ start: b.startMin, end: b.endMin })));

  const available: IntervaloDisponivel[] = [];
  let pos = START;
  for (const block of merged) {
    if (pos < block.start && block.start - pos >= 1) {
      available.push({
        startMin: pos,
        endMin: block.start,
        horaInicio: minutesToTime(pos),
        horaFim: minutesToTime(block.start),
      });
    }
    pos = Math.max(pos, block.end);
  }
  if (pos < END) {
    available.push({
      startMin: pos,
      endMin: END,
      horaInicio: minutesToTime(pos),
      horaFim: minutesToTime(END),
    });
  }

  return {
    dayStart: START,
    dayEnd: END,
    buffer,
    occupied: blocosOcupados,
    available,
    horaAbre: minutesToTime(START),
    horaFecha: minutesToTime(END),
  };
}

/**
 * Calcula slots disponíveis com base na timeline: tempo consumido = serviço + buffer.
 * Slots gerados em passos de SLOT_STEP_MINUTES para que o próximo disponível seja exatamente após o buffer.
 */
export function getSlotsDisponiveis(
  dataStr: string,
  duracaoMinutos: number,
  ocupados: { horaInicio: string; horaFim: string }[],
  config?: HorarioConfig | null
): string[] {
  const timeline = getTimelineDia(dataStr, ocupados, config);
  if (!timeline) return [];

  const slots: string[] = [];
  for (const gap of timeline.available) {
    let pos = gap.startMin;
    while (pos + duracaoMinutos <= gap.endMin && pos + duracaoMinutos <= timeline.dayEnd) {
      slots.push(minutesToTime(pos));
      pos += SLOT_STEP_MINUTES;
    }
  }
  return slots;
}

async function fetchAllMarcacoes(max = 200) {
  if (!db) return [];
  const ref = collection(db, COLLECTION);
  try {
    const snap = await getDocs(ref);
    const list = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        clienteEmail: (x.clienteEmail as string) ?? "",
        clienteNome: (x.clienteNome as string) ?? "",
        clienteTelefone: x.clienteTelefone as string | undefined,
        servicoId: (x.servicoId as string) ?? "",
        servicoNome: (x.servicoNome as string) ?? "",
        duracaoMinutos: (x.duracaoMinutos as number) ?? 0,
        preco: (x.preco as number) ?? 0,
        data: (x.data as string) ?? "",
        horaInicio: (x.horaInicio as string) ?? "",
        horaFim: (x.horaFim as string) ?? "",
        status: (x.status as string) ?? "pendente",
        notasSessao: x.notasSessao as string | undefined,
        preferenciaPagamento: (x.preferenciaPagamento as "na_sessao" | "agora") ?? "na_sessao",
        pagamentoRecebido: (x.pagamentoRecebido as boolean) ?? false,
        metodoPagamento: (x.metodoPagamento as "Dinheiro" | "MB Way" | "Multibanco" | "Cartão" | null) ?? null,
        motivoCancelamento: x.motivoCancelamento as "cliente_cancela" | "falha_tecnica" | "outro" | undefined,
        motivoCancelamentoTexto: x.motivoCancelamentoTexto as string | undefined,
        reagendadoCount: typeof x.reagendadoCount === "number" ? x.reagendadoCount : undefined,
        parceiroId: x.parceiroId as string | undefined,
        parceiroCodigo: x.parceiroCodigo as string | undefined,
        origemParceiroNome: (x.origemParceiroNome as string) || undefined,
        precoOriginal: typeof x.precoOriginal === "number" ? x.precoOriginal : undefined,
        descontoParceiro: typeof x.descontoParceiro === "number" ? x.descontoParceiro : undefined,
        primeiraSessaoIndicacao: x.primeiraSessaoIndicacao as boolean | undefined,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
      };
    });
    list.sort((a, b) => {
      const cmp = (a.data as string).localeCompare(b.data as string);
      if (cmp !== 0) return cmp;
      return (a.horaInicio as string).localeCompare(b.horaInicio as string);
    });
    return list.slice(0, max);
  } catch {
    return [];
  }
}

/** Todas as marcações para o admin (com cache 1 min) */
export async function getAllMarcacoes(max = 200) {
  return getCached(
    CACHE_KEYS.marcacoes,
    CACHE_TTL.marcacoes,
    () => fetchAllMarcacoes(max)
  );
}

/** Atualizar marcação (status, notas, pagamento, reagendamento, motivo cancelamento) */
export async function updateMarcacao(
  id: string,
  data: {
    status?: string;
    notasSessao?: string;
    pagamentoRecebido?: boolean;
    metodoPagamento?: "Dinheiro" | "MB Way" | "Multibanco" | "Cartão" | null;
    data?: string;
    horaInicio?: string;
    horaFim?: string;
    motivoCancelamento?: "cliente_cancela" | "falha_tecnica" | "outro";
    motivoCancelamentoTexto?: string;
  }
): Promise<void> {
  if (!db) throw new Error("Firebase não está configurado.");
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
  invalidate(CACHE_KEYS.marcacoes);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function fetchMarcacoesByClienteEmail(clienteEmail: string) {
  if (!db) return [];
  const normalized = normalizeEmail(clienteEmail);
  const ref = collection(db, COLLECTION);
  const statusFilter = where("status", "in", ["pendente", "confirmada", "concluida", "cancelada"]);
  // Query por clienteEmailLower (marcações novas) e por clienteEmail (compatibilidade com antigas)
  const [snapNew, snapOld] = await Promise.all([
    getDocs(query(ref, where("clienteEmailLower", "==", normalized), statusFilter)),
    getDocs(query(ref, where("clienteEmail", "==", normalized), statusFilter)),
  ]);
  const seen = new Set<string>();
  const docs = [...snapNew.docs, ...snapOld.docs].filter((d) => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
  return docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      servicoNome: x.servicoNome,
      data: x.data,
      horaInicio: x.horaInicio,
      horaFim: x.horaFim,
      status: x.status,
      duracaoMinutos: x.duracaoMinutos,
      preco: x.preco,
    };
  });
}

/** Marcações de um cliente pelo email (para área do cliente) – com cache 2 min */
export async function getMarcacoesByClienteEmail(clienteEmail: string) {
  const key = getCacheKeyForEmail(normalizeEmail(clienteEmail));
  return getCached(key, 2 * 60 * 1000, () => fetchMarcacoesByClienteEmail(clienteEmail));
}

export async function createMarcacao(input: MarcacaoInput): Promise<string> {
  if (!db) throw new Error("Firebase não está configurado. Configure as variáveis de ambiente.");

  const startMin = timeToMinutes(input.horaInicio);
  const endMin = startMin + input.duracaoMinutos;

  // Validar horário de funcionamento e intervalo de limpeza (buffer)
  const config = await getHorarioConfig();
  const horario = getHorarioParaData(input.data, config);
  if (!horario) {
    throw new Error("Não é possível agendar nesta data (estabelecimento fechado).");
  }
  if (startMin < horario.start || endMin > horario.end) {
    throw new Error("O horário escolhido está fora do horário de funcionamento.");
  }

  const ocupados = await getMarcacoesByDate(input.data);
  const buffer = horario.buffer;
  for (const o of ocupados) {
    const blocoStart = timeToMinutes(o.horaInicio);
    const blocoEnd = timeToMinutes(o.horaFim) + buffer;
    const conflito = startMin < blocoEnd && endMin > blocoStart;
    if (conflito) {
      throw new Error(
        `Não há tempo suficiente para o intervalo de limpeza (${buffer} min). ` +
        `Já existe uma marcação até ${o.horaFim}; a próxima só pode começar após ${minutesToTime(timeToMinutes(o.horaFim) + buffer)}.`
      );
    }
  }

  const horaFim = minutesToTime(endMin);

  const preferenciaPagamento = input.preferenciaPagamento ?? "na_sessao";

  const clienteEmailNorm = normalizeEmail(input.clienteEmail);
  const docData: Record<string, unknown> = {
    clienteEmail: input.clienteEmail.trim(),
    clienteEmailLower: clienteEmailNorm,
    clienteNome: input.clienteNome,
    clienteTelefone: input.clienteTelefone ?? null,
    servicoId: input.servicoId,
    servicoNome: input.servicoNome,
    duracaoMinutos: input.duracaoMinutos,
    preco: input.preco,
    data: input.data,
    horaInicio: input.horaInicio,
    horaFim,
    status: "confirmada",
    preferenciaPagamento,
    pagamentoRecebido: false,
    metodoPagamento: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  if (input.clienteId) docData.clienteId = input.clienteId;
  if (input.parceiroId) docData.parceiroId = input.parceiroId;
  if (input.parceiroCodigo) docData.parceiroCodigo = input.parceiroCodigo;
  if (input.origemParceiroNome?.trim()) docData.origemParceiroNome = input.origemParceiroNome.trim();
  if (typeof input.precoOriginal === "number") docData.precoOriginal = input.precoOriginal;
  if (typeof input.descontoParceiro === "number") docData.descontoParceiro = input.descontoParceiro;
  if (input.primeiraSessaoIndicacao === true) docData.primeiraSessaoIndicacao = true;
  if (input.eventoId) docData.eventoId = input.eventoId;
  if (input.codigoPromocionalId) docData.codigoPromocionalId = input.codigoPromocionalId;
  if (typeof input.descontoEvento === "number") docData.descontoEvento = input.descontoEvento;

  const docRef = await addDoc(collection(db, COLLECTION), docData);
  invalidate(CACHE_KEYS.marcacoes);
  invalidate(getCacheKeyForEmail(clienteEmailNorm));
  return docRef.id;
}
