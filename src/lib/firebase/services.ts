import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  addDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { getCached, invalidate, CACHE_KEYS, CACHE_TTL } from "./cache";
import type { Servico } from "@/types";

const COLLECTION = "servicos";

async function fetchServicos(): Promise<Servico[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, COLLECTION),
      where("ativo", "==", true)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => mapDocToServico(d));
    list.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.nome.localeCompare(b.nome));
    return list;
  } catch {
    return [];
  }
}

async function fetchServicosAdmin(): Promise<Servico[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    const list = snap.docs.map((d) => mapDocToServico(d));
    list.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.nome.localeCompare(b.nome));
    return list;
  } catch {
    return [];
  }
}

export async function getServicos(): Promise<Servico[]> {
  return getCached(CACHE_KEYS.servicos, CACHE_TTL.servicos, fetchServicos);
}

/** Lista todos os serviços (incluindo inativos) para o admin */
export async function getServicosAdmin(): Promise<Servico[]> {
  return getCached(CACHE_KEYS.servicosAdmin, CACHE_TTL.servicos, fetchServicosAdmin);
}

function mapDocToServico(d: { id: string; data: () => Record<string, unknown> }): Servico {
  const data = d.data();
  return {
    id: d.id,
    nome: (data.nome as string) ?? "",
    descricao: data.descricao as string | undefined,
    duracaoMinutos: (data.duracaoMinutos as number) ?? 60,
    preco: (data.preco as number) ?? 0,
    ativo: (data.ativo as boolean) ?? true,
    ordem: data.ordem as number | undefined,
    categoria: data.categoria as string | undefined,
    imagemUrl: data.imagemUrl as string | undefined,
    destaque: (data.destaque as boolean) ?? false,
  };
}

export async function getServicoById(id: string): Promise<Servico | null> {
  if (!db) return null;
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapDocToServico(snap);
}

export type ServicoInput = Omit<Servico, "id">;

export async function createServico(input: ServicoInput): Promise<string> {
  if (!db) throw new Error("Firebase não está configurado.");
  const ref = await addDoc(collection(db, COLLECTION), {
    nome: input.nome,
    descricao: input.descricao ?? null,
    duracaoMinutos: input.duracaoMinutos,
    preco: input.preco,
    ativo: input.ativo ?? true,
    ordem: input.ordem ?? 0,
    categoria: input.categoria ?? null,
    imagemUrl: input.imagemUrl ?? null,
    destaque: input.destaque ?? false,
  });
  invalidate(CACHE_KEYS.servicos);
  invalidate(CACHE_KEYS.servicosAdmin);
  return ref.id;
}

export async function updateServico(
  id: string,
  input: Partial<ServicoInput>
): Promise<void> {
  if (!db) throw new Error("Firebase não está configurado.");
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...input,
    updatedAt: Timestamp.now(),
  });
  invalidate(CACHE_KEYS.servicos);
  invalidate(CACHE_KEYS.servicosAdmin);
}

/** Desativa um serviço (não apaga, para manter histórico) */
export async function deleteServico(id: string): Promise<void> {
  if (!db) throw new Error("Firebase não está configurado.");
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, { ativo: false, updatedAt: Timestamp.now() });
  invalidate(CACHE_KEYS.servicos);
  invalidate(CACHE_KEYS.servicosAdmin);
}
