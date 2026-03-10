import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { invalidate, CACHE_KEYS } from "./cache";
import type { Evento } from "@/types";

const COLLECTION = "eventos";

export const CACHE_TTL_EVENTOS = 5 * 60 * 1000; // 5 min

function mapDocToEvento(d: { id: string; data: () => Record<string, unknown> | undefined }): Evento {
  const x = d.data() ?? {};
  const toIso = (v: unknown) =>
    typeof v === "object" && v && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function"
      ? (v as { toDate: () => Date }).toDate().toISOString()
      : typeof v === "string"
        ? v
        : "";
  return {
    id: d.id,
    modelo: (x.modelo as "interno" | "externo") ?? "externo",
    participacao: (x.participacao as "todos" | "users") ?? "todos",
    titulo: x.titulo as string | undefined,
    descricao: x.descricao as string | undefined,
    dataInicio: toIso(x.dataInicio) || "",
    dataFim: toIso(x.dataFim) || "",
    localTipo: x.localTipo as "mardelux" | "morada" | "link" | undefined,
    localValor: x.localValor as string | undefined,
    contactoInfo: x.contactoInfo as string | undefined,
    imagemUrl: x.imagemUrl as string | undefined,
    servicosIds: Array.isArray(x.servicosIds) ? (x.servicosIds as string[]) : [],
    servicosMaxEscolha: typeof x.servicosMaxEscolha === "number" ? x.servicosMaxEscolha : undefined,
    codigoAtivo: (x.codigoAtivo as boolean) ?? false,
    codigoPromocionalId: x.codigoPromocionalId as string | undefined,
    checkoutAtivo: (x.checkoutAtivo as boolean) ?? false,
    status: (x.status as "rascunho" | "publicado") ?? "rascunho",
    slug: (x.slug as string) ?? "",
    createdAt: toIso(x.createdAt),
    updatedAt: toIso(x.updatedAt),
  };
}

function toTimestamp(v: string | undefined): Timestamp | null {
  if (!v) return null;
  try {
    return Timestamp.fromDate(new Date(v));
  } catch {
    return null;
  }
}

export interface EventoInput {
  modelo: ModeloEvento;
  participacao: ParticipacaoEvento;
  titulo?: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  localTipo?: "mardelux" | "morada" | "link";
  localValor?: string;
  contactoInfo?: string;
  imagemUrl?: string;
  servicosIds?: string[];
  servicosMaxEscolha?: number;
  codigoAtivo?: boolean;
  codigoPromocionalId?: string;
  checkoutAtivo?: boolean;
  status?: "rascunho" | "publicado";
  slug: string;
}

type ModeloEvento = "interno" | "externo";
type ParticipacaoEvento = "todos" | "users";

/** Lista todos os eventos (admin) */
export async function getEventosAdmin(): Promise<Evento[]> {
  if (!db) return [];
  try {
    const ref = collection(db, COLLECTION);
    const q = query(ref, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDocToEvento(d));
  } catch {
    return [];
  }
}

/** Lista eventos publicados com data futura */
export async function getEventosPublicos(): Promise<Evento[]> {
  if (!db) return [];
  try {
    const ref = collection(db, COLLECTION);
    const q = query(ref, where("status", "==", "publicado"));
    const snap = await getDocs(q);
    const now = new Date();
    return snap.docs
      .map((d) => mapDocToEvento(d))
      .filter((e) => new Date(e.dataFim) >= now)
      .sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime());
  } catch {
    return [];
  }
}

/** Evento por ID */
export async function getEventoById(id: string): Promise<Evento | null> {
  if (!db) return null;
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists) return null;
  return mapDocToEvento(snap);
}

/** Evento por slug */
export async function getEventoBySlug(slug: string): Promise<Evento | null> {
  if (!db) return null;
  const ref = collection(db, COLLECTION);
  const q = query(ref, where("slug", "==", slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapDocToEvento(snap.docs[0]);
}

/** Gerar slug único a partir do título */
export function generateSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || `evento-${Date.now()}`;
}

/** Criar evento */
export async function createEvento(input: EventoInput): Promise<string> {
  if (!db) throw new Error("Firebase não configurado.");
  const now = Timestamp.now();
  const docData: Record<string, unknown> = {
    modelo: input.modelo,
    participacao: input.participacao,
    titulo: input.titulo ?? "",
    descricao: input.descricao ?? "",
    dataInicio: toTimestamp(input.dataInicio) ?? now,
    dataFim: toTimestamp(input.dataFim) ?? now,
    localTipo: input.localTipo ?? "mardelux",
    localValor: input.localValor ?? "",
    contactoInfo: input.contactoInfo ?? "",
    imagemUrl: input.imagemUrl ?? "",
    servicosIds: input.servicosIds ?? [],
    servicosMaxEscolha: input.servicosMaxEscolha ?? 1,
    codigoAtivo: input.codigoAtivo ?? false,
    codigoPromocionalId: input.codigoPromocionalId ?? null,
    checkoutAtivo: input.checkoutAtivo ?? false,
    status: input.status ?? "rascunho",
    slug: input.slug,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, COLLECTION), docData);
  invalidate(CACHE_KEYS.eventos);
  return ref.id;
}

/** Atualizar evento */
export async function updateEvento(
  id: string,
  data: Partial<EventoInput>
): Promise<void> {
  if (!db) throw new Error("Firebase não configurado.");
  const ref = doc(db, COLLECTION, id);
  const update: Record<string, unknown> = {
    ...data,
    updatedAt: Timestamp.now(),
  };
  if (data.dataInicio) update.dataInicio = toTimestamp(data.dataInicio) ?? undefined;
  if (data.dataFim) update.dataFim = toTimestamp(data.dataFim) ?? undefined;
  delete (update as Record<string, unknown>).id;
  await updateDoc(ref, update);
  invalidate(CACHE_KEYS.eventos);
}

/** Eliminar evento */
export async function deleteEvento(id: string): Promise<void> {
  if (!db) throw new Error("Firebase não configurado.");
  await deleteDoc(doc(db, COLLECTION, id));
  invalidate(CACHE_KEYS.eventos);
}
