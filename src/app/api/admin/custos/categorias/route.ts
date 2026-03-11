/**
 * API admin para categorias de custos.
 * GET: lista categorias
 * POST: criar categoria
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Token em falta", status: 401 } as const;
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();
  if (!adminAuth || !adminDb) return { error: "Firebase Admin não configurado", status: 503 } as const;
  const decoded = await adminAuth.verifyIdToken(token);
  const email = (decoded.email ?? "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) return { error: "Acesso reservado ao administrador", status: 403 } as const;
  return { adminDb };
}

function toCategoria(doc: FirebaseFirestore.DocumentSnapshot) {
  const x = doc.data();
  return {
    id: doc.id,
    nome: (x?.nome as string) ?? "",
    tipo: (x?.tipo as "fixo" | "variavel") ?? "fixo",
    ordem: (x?.ordem as number) ?? 0,
    ativo: (x?.ativo as boolean) ?? true,
    createdAt: (x?.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const snap = await adminDb
      .collection("categorias_custos")
      .orderBy("ordem", "asc")
      .orderBy("nome", "asc")
      .get();

    const list = snap.docs.map((d) => toCategoria(d));
    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/custos/categorias GET]", err);
    return NextResponse.json({ error: "Erro ao carregar categorias" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as { nome?: string; tipo?: "fixo" | "variavel"; ordem?: number };
    const nome = String(body.nome ?? "").trim();
    if (!nome) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }
    const tipo = body.tipo === "variavel" ? "variavel" : "fixo";

    const ref = await adminDb.collection("categorias_custos").add({
      nome,
      tipo,
      ordem: Number(body.ordem) || 0,
      ativo: true,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ id: ref.id, ok: true });
  } catch (err) {
    console.error("[api/admin/custos/categorias POST]", err);
    return NextResponse.json({ error: "Erro ao criar categoria" }, { status: 503 });
  }
}
