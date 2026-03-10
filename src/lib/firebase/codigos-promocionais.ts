import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { invalidate, CACHE_KEYS } from "./cache";
import type { CodigoPromocional } from "@/types";

const COLLECTION = "codigos_promocionais";

function mapDocToCodigo(d: { id: string; data: () => Record<string, unknown> | undefined }): CodigoPromocional {
  const x = d.data() ?? {};
  const toIso = (v: unknown) =>
    typeof v === "object" && v && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function"
      ? (v as { toDate: () => Date }).toDate().toISOString()
      : typeof v === "string"
        ? v
        : "";
  return {
    id: d.id,
    codigo: (x.codigo as string) ?? "",
    descontoPercentagem: (x.descontoPercentagem as number) ?? 0,
    tipoAplicacao: (x.tipoAplicacao as "site" | "evento") ?? "evento",
    eventoId: x.eventoId as string | undefined,
    validadeInicio: x.validadeInicio ? toIso(x.validadeInicio) : undefined,
    validadeFim: x.validadeFim ? toIso(x.validadeFim) : undefined,
    usosMaximos: typeof x.usosMaximos === "number" ? x.usosMaximos : undefined,
    usosAtuais: (x.usosAtuais as number) ?? 0,
    ativo: (x.ativo as boolean) ?? true,
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

export interface CodigoPromocionalInput {
  codigo: string;
  descontoPercentagem: number;
  tipoAplicacao: "site" | "evento";
  eventoId?: string;
  validadeInicio?: string;
  validadeFim?: string;
  usosMaximos?: number;
  ativo?: boolean;
}

/** Lista códigos (admin) */
export async function getCodigosPromocionais(eventoId?: string): Promise<CodigoPromocional[]> {
  if (!db) return [];
  try {
    const ref = collection(db, COLLECTION);
    const q = eventoId
      ? query(ref, where("eventoId", "==", eventoId))
      : query(ref);
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDocToCodigo(d));
  } catch {
    return [];
  }
}

/** Código por ID */
export async function getCodigoPromocionalById(id: string): Promise<CodigoPromocional | null> {
  if (!db) return null;
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists) return null;
  return mapDocToCodigo(snap);
}

/** Código por código (ex: "VERAO25") */
export async function getCodigoByCodigo(codigo: string): Promise<CodigoPromocional | null> {
  if (!db) return null;
  const ref = collection(db, COLLECTION);
  const q = query(ref, where("codigo", "==", codigo.trim().toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return mapDocToCodigo(snap.docs[0]);
}

/** Criar código promocional */
export async function createCodigoPromocional(input: CodigoPromocionalInput): Promise<string> {
  if (!db) throw new Error("Firebase não configurado.");
  const now = Timestamp.now();
  const docData: Record<string, unknown> = {
    codigo: input.codigo.trim().toUpperCase(),
    descontoPercentagem: input.descontoPercentagem,
    tipoAplicacao: input.tipoAplicacao,
    eventoId: input.eventoId ?? null,
    validadeInicio: input.validadeInicio ? toTimestamp(input.validadeInicio) : null,
    validadeFim: input.validadeFim ? toTimestamp(input.validadeFim) : null,
    usosMaximos: input.usosMaximos ?? null,
    usosAtuais: 0,
    ativo: input.ativo ?? true,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, COLLECTION), docData);
  invalidate(CACHE_KEYS.codigosPromocionais);
  return ref.id;
}

/** Atualizar código promocional */
export async function updateCodigoPromocional(
  id: string,
  data: Partial<CodigoPromocionalInput>
): Promise<void> {
  if (!db) throw new Error("Firebase não configurado.");
  const ref = doc(db, COLLECTION, id);
  const update: Record<string, unknown> = {
    ...data,
    updatedAt: Timestamp.now(),
  };
  if (data.validadeInicio !== undefined) update.validadeInicio = data.validadeInicio ? toTimestamp(data.validadeInicio) : null;
  if (data.validadeFim !== undefined) update.validadeFim = data.validadeFim ? toTimestamp(data.validadeFim) : null;
  delete (update as Record<string, unknown>).id;
  await updateDoc(ref, update);
  invalidate(CACHE_KEYS.codigosPromocionais);
}

/** Incrementar usos do código */
export async function incrementarUsoCodigo(id: string): Promise<void> {
  if (!db) throw new Error("Firebase não configurado.");
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists) throw new Error("Código não encontrado");
  const data = snap.data();
  const usosAtuais = ((data?.usosAtuais as number) ?? 0) + 1;
  await updateDoc(ref, { usosAtuais, updatedAt: Timestamp.now() });
  invalidate(CACHE_KEYS.codigosPromocionais);
}
