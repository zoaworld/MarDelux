import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { BUFFER_TIME_MINUTES } from "@/lib/constants";
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

/** Calcula slots disponíveis para um dia: início 09:00, fim 18:00, buffer 15 min entre sessões */
export function getSlotsDisponiveis(
  duracaoMinutos: number,
  ocupados: { horaInicio: string; horaFim: string }[]
): string[] {
  const START = 9 * 60; // 09:00
  const END = 18 * 60; // 18:00
  const buffer = BUFFER_TIME_MINUTES;
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
    pos += 30; // incrementar de 30 em 30 min para ter slots razoáveis
  }
  return slots;
}

/** Marcações de um cliente pelo email (para área do cliente) */
export async function getMarcacoesByClienteEmail(clienteEmail: string) {
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
  return docRef.id;
}
