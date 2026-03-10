/**
 * API admin para os cards de destaque da homepage.
 * GET: lista cards
 * POST: guardar cards
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { invalidate, CACHE_KEYS } from "@/lib/firebase/cache";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const CONFIG_COLLECTION = "config";
const HOME_CARDS_DOC_ID = "homeCards";

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Token em falta", status: 401 } as const;
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();
  if (!adminAuth || !adminDb)
    return { error: "Firebase Admin não configurado", status: 503 } as const;
  const decoded = await adminAuth.verifyIdToken(token);
  const email = (decoded.email ?? "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email))
    return { error: "Acesso reservado ao administrador", status: 403 } as const;
  return { adminDb };
}

function toIso(x: unknown): string {
  if (!x) return "";
  if (
    typeof x === "object" &&
    x &&
    "toDate" in x &&
    typeof (x as { toDate: () => Date }).toDate === "function"
  ) {
    return (x as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof x === "string" ? x : "";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const adminDb = auth.adminDb;
    const snap = await adminDb
      .collection(CONFIG_COLLECTION)
      .doc(HOME_CARDS_DOC_ID)
      .get();
    if (!snap.exists()) {
      return NextResponse.json([]);
    }
    const data = snap.data();
    const raw = (data?.cards ?? []) as Record<string, unknown>[];
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json([]);
    }
    const list = raw
      .map((item, idx) => ({
        id: `c${idx}`,
        ordem: typeof item.ordem === "number" ? item.ordem : idx,
        tipo: (item.tipo as string) ?? "informativo",
        imagemUrl: typeof item.imagemUrl === "string" ? item.imagemUrl : undefined,
        titulo: typeof item.titulo === "string" ? item.titulo : undefined,
        descricao: typeof item.descricao === "string" ? item.descricao : undefined,
        conteudoExpandido:
          typeof item.conteudoExpandido === "string"
            ? item.conteudoExpandido
            : undefined,
        linkUrl: typeof item.linkUrl === "string" ? item.linkUrl : undefined,
        eventoId: typeof item.eventoId === "string" ? item.eventoId : undefined,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
      }))
      .sort((a, b) => a.ordem - b.ordem)
      .slice(0, 3);
    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/home-cards GET]", err);
    return NextResponse.json(
      { error: "Erro ao carregar cards" },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const adminDb = auth.adminDb;

    const body = (await request.json()) as {
      cards: Array<{
        ordem?: number;
        tipo?: "informativo" | "foto_link" | "evento";
        imagemUrl?: string;
        titulo?: string;
        descricao?: string;
        conteudoExpandido?: string;
        linkUrl?: string;
        eventoId?: string;
      }>;
    };

    const cards = Array.isArray(body.cards) ? body.cards : [];
    const now = Timestamp.now();
    const items = cards.slice(0, 3).map((c, i) => ({
      ordem: i,
      tipo: c.tipo ?? "informativo",
      imagemUrl: (c.imagemUrl ?? "").trim() || null,
      titulo: (c.titulo ?? "").trim() || null,
      descricao: (c.descricao ?? "").trim() || null,
      conteudoExpandido: (c.conteudoExpandido ?? "").trim() || null,
      linkUrl: (c.linkUrl ?? "").trim() || null,
      eventoId: (c.eventoId ?? "").trim() || null,
      createdAt: now,
      updatedAt: now,
    }));

    await adminDb
      .collection(CONFIG_COLLECTION)
      .doc(HOME_CARDS_DOC_ID)
      .set({ cards: items, updatedAt: now });

    invalidate(CACHE_KEYS.homeCards);
    return NextResponse.json({ ok: true, count: items.length });
  } catch (err) {
    console.error("[api/admin/home-cards POST]", err);
    return NextResponse.json(
      { error: "Erro ao guardar cards" },
      { status: 503 }
    );
  }
}
