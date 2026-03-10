import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./config";
import { getCached, invalidate, CACHE_KEYS, CACHE_TTL } from "./cache";
import type { HomeCard } from "@/types";

const CONFIG_COLLECTION = "config";
const HOME_CARDS_DOC_ID = "homeCards";

function toIso(v: unknown): string {
  if (!v) return "";
  if (typeof v === "object" && v && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof v === "string" ? v : "";
}

function mapRawToCard(x: Record<string, unknown>, id: string): HomeCard {
  return {
    id,
    ordem: typeof x.ordem === "number" ? x.ordem : 0,
    tipo: (x.tipo as "informativo" | "foto_link" | "evento") ?? "informativo",
    imagemUrl: typeof x.imagemUrl === "string" ? x.imagemUrl : undefined,
    titulo: typeof x.titulo === "string" ? x.titulo : undefined,
    descricao: typeof x.descricao === "string" ? x.descricao : undefined,
    conteudoExpandido: typeof x.conteudoExpandido === "string" ? x.conteudoExpandido : undefined,
    linkUrl: typeof x.linkUrl === "string" ? x.linkUrl : undefined,
    eventoId: typeof x.eventoId === "string" ? x.eventoId : undefined,
    createdAt: toIso(x.createdAt),
    updatedAt: toIso(x.updatedAt),
  };
}

async function fetchHomeCards(): Promise<HomeCard[]> {
  if (!db) return [];
  try {
    const ref = doc(db, CONFIG_COLLECTION, HOME_CARDS_DOC_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) return [];
    const data = snap.data();
    const raw = data?.cards as Record<string, unknown>[] | undefined;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw
      .map((item, idx) => mapRawToCard(item as Record<string, unknown>, `c${idx}`))
      .sort((a, b) => a.ordem - b.ordem)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/** Obtém os cards de destaque da homepage (público) */
export async function getHomeCards(): Promise<HomeCard[]> {
  return getCached(CACHE_KEYS.homeCards, CACHE_TTL.config, fetchHomeCards);
}

export interface HomeCardInput {
  ordem: number;
  tipo: "informativo" | "foto_link" | "evento";
  imagemUrl?: string;
  titulo?: string;
  descricao?: string;
  conteudoExpandido?: string;
  linkUrl?: string;
  eventoId?: string;
}

/** Guarda os cards de destaque no Firestore */
export async function setHomeCards(cards: HomeCardInput[]): Promise<void> {
  if (!db) throw new Error("Firebase não está configurado.");
  const now = Timestamp.now();
  const items = cards
    .slice(0, 3)
    .map((c, i) => ({
      ordem: i,
      tipo: c.tipo,
      imagemUrl: (c.imagemUrl ?? "").trim() || null,
      titulo: (c.titulo ?? "").trim() || null,
      descricao: (c.descricao ?? "").trim() || null,
      conteudoExpandido: (c.conteudoExpandido ?? "").trim() || null,
      linkUrl: (c.linkUrl ?? "").trim() || null,
      eventoId: (c.eventoId ?? "").trim() || null,
      createdAt: now,
      updatedAt: now,
    }));
  const ref = doc(db, CONFIG_COLLECTION, HOME_CARDS_DOC_ID);
  await setDoc(ref, { cards: items, updatedAt: now });
  invalidate(CACHE_KEYS.homeCards);
}
