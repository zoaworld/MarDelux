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
import { BUFFER_TIME_MINUTES } from "@/lib/constants";
import { getHorarioParaData, type HorarioConfig } from "./app-settings";
import { getCached, invalidate, CACHE_KEYS, CACHE_TTL } from "./cache";

const COLLECTION = "marcacoes";

export interface MarcacaoInput {
  clienteEmail: string;
  clienteNome: string;
  clienteTelefone?: string;
  servicoId: string;
  servicoNome: string;
  duracaoMinutos: number;
  preco: number;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
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

/** Calcula slots disponíveis para um dia. dataStr = YYYY-MM-DD. Se config for omitido, usa constantes. */
export function getSlotsDisponiveis(
  dataStr: string,
  duracaoMinutos: number,
  ocupados: { horaInicio: string; horaFim: string }[],
  config?: HorarioConfig | null
): string[] {
  let START: number;
  let END: number;
  let buffer: number;

  if (config) {
    const horario = getHorarioParaData(dataStr, config);
    if (!horario) return [];
    START = horario.start;
    END = horario.end;
    buffer = horario.buffer;
  } else {
    START = 9 * 60;
    END = 18 * 60;
    buffer = BUFFER_TIME_MINUTES;
  }

  const blocosOcupados = ocupados.map((o) => ({
    start: timeToMinutes(o.horaInicio),
    end: timeToMinutes(o.horaFim) + buffer,
  }));

  const slots: string[] = [];
  let pos = START;
  while (pos + duracaoMinutos <= END) {
    const conflito = blocosOcupados.some(
      (b) => (pos >= b.start && pos < b.end) || (pos + duracaoMinutos > b.start && pos + duracaoMinutos <= b.end) || (pos <= b.start && pos + duracaoMinutos >= b.end)
    );
    if (!conflito) slots.push(minutesToTime(pos));
    pos += 30;
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
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
      };
    });
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
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

/** Atualizar marcação (status, notas de sessão SOAP) */
export async function updateMarcacao(
  id: string,
  data: { status?: string; notasSessao?: string }
): Promise<void> {
  if (!db) throw new Error("Firebase não está configurado.");
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: Timestamp.now(),
  });
  invalidate(CACHE_KEYS.marcacoes);
}

/** Marcações de um cliente pelo email (para área do cliente) */
export async function getMarcacoesByClienteEmail(clienteEmail: string) {
  if (!db) return [];
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where("clienteEmail", "==", clienteEmail),
    where("status", "in", ["pendente", "confirmada", "concluida"])
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
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

export async function createMarcacao(input: MarcacaoInput): Promise<string> {
  if (!db) throw new Error("Firebase não está configurado. Configure as variáveis de ambiente.");
  const startMin = timeToMinutes(input.horaInicio);
  const horaFim = minutesToTime(startMin + input.duracaoMinutos);

  const docRef = await addDoc(collection(db, COLLECTION), {
    clienteEmail: input.clienteEmail,
    clienteNome: input.clienteNome,
    clienteTelefone: input.clienteTelefone ?? null,
    servicoId: input.servicoId,
    servicoNome: input.servicoNome,
    duracaoMinutos: input.duracaoMinutos,
    preco: input.preco,
    data: input.data,
    horaInicio: input.horaInicio,
    horaFim,
    status: "pendente",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  invalidate(CACHE_KEYS.marcacoes);
  return docRef.id;
}
