/**
 * API admin para item de inventário por ID.
 * GET: detalhe
 * PATCH: atualizar
 * DELETE: eliminar
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const doc = await adminDb.collection("itens_inventario").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    return NextResponse.json(toItem(doc));
  } catch (err) {
    console.error("[api/admin/inventario/itens/[id] GET]", err);
    return NextResponse.json({ error: "Erro ao carregar item" }, { status: 503 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const body = (await request.json()) as {
      nome?: string;
      categoriaId?: string;
      quantidadeAtual?: number;
      unidade?: string;
      stockMinimo?: number;
      custoUnitario?: number;
      ativo?: boolean;
    };
    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (typeof body.nome === "string") updates.nome = body.nome.trim();
    if (typeof body.categoriaId === "string") updates.categoriaId = body.categoriaId.trim();
    if (typeof body.quantidadeAtual === "number") updates.quantidadeAtual = body.quantidadeAtual;
    if (["un", "L", "kg", "ml"].includes(String(body.unidade ?? ""))) updates.unidade = body.unidade;
    if (typeof body.stockMinimo === "number") updates.stockMinimo = body.stockMinimo;
    if (typeof body.custoUnitario === "number") updates.custoUnitario = body.custoUnitario;
    if (typeof body.ativo === "boolean") updates.ativo = body.ativo;

    await adminDb.collection("itens_inventario").doc(id).update(updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/inventario/itens/[id] PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 503 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(_request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    await adminDb.collection("itens_inventario").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/inventario/itens/[id] DELETE]", err);
    return NextResponse.json({ error: "Erro ao eliminar" }, { status: 503 });
  }
}
