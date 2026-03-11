/**
 * API admin para itens de inventário.
 * GET: lista itens (filtro categoriaId, ativo)
 * POST: criar item
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

function toItem(doc: FirebaseFirestore.DocumentSnapshot) {
  const x = doc.data();
  return {
    id: doc.id,
    nome: (x?.nome as string) ?? "",
    categoriaId: (x?.categoriaId as string) ?? "",
    quantidadeAtual: (x?.quantidadeAtual as number) ?? 0,
    unidade: (x?.unidade as string) ?? "un",
    stockMinimo: (x?.stockMinimo as number) ?? 0,
    custoUnitario: (x?.custoUnitario as number) ?? 0,
    ativo: (x?.ativo as boolean) ?? true,
    createdAt: (x?.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: (x?.updatedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const categoriaId = request.nextUrl.searchParams.get("categoriaId");
    const ativo = request.nextUrl.searchParams.get("ativo");

    let q: FirebaseFirestore.Query;
    if (categoriaId) {
      q = adminDb
        .collection("itens_inventario")
        .where("categoriaId", "==", categoriaId)
        .orderBy("nome", "asc");
    } else {
      q = adminDb.collection("itens_inventario").orderBy("nome", "asc");
    }
    const snap = await q.get();

    let list = snap.docs.map((d) => toItem(d));
    if (ativo === "true") list = list.filter((i) => i.ativo);
    if (ativo === "false") list = list.filter((i) => !i.ativo);

    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/inventario/itens GET]", err);
    return NextResponse.json({ error: "Erro ao carregar itens" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as {
      nome?: string;
      categoriaId?: string;
      quantidadeAtual?: number;
      unidade?: string;
      stockMinimo?: number;
      custoUnitario?: number;
    };
    const nome = String(body.nome ?? "").trim();
    if (!nome) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }

    const now = Timestamp.now();
    const ref = await adminDb.collection("itens_inventario").add({
      nome,
      categoriaId: String(body.categoriaId ?? "").trim(),
      quantidadeAtual: Number(body.quantidadeAtual) || 0,
      unidade: ["un", "L", "kg", "ml"].includes(String(body.unidade ?? "un")) ? (body.unidade as string) : "un",
      stockMinimo: Number(body.stockMinimo) || 0,
      custoUnitario: Number(body.custoUnitario) || 0,
      ativo: true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id: ref.id, ok: true });
  } catch (err) {
    console.error("[api/admin/inventario/itens POST]", err);
    return NextResponse.json({ error: "Erro ao criar item" }, { status: 503 });
  }
}
