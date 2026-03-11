/**
 * API admin para categoria de inventário por ID.
 * PATCH: atualizar
 * DELETE: eliminar
 */

import { NextRequest, NextResponse } from "next/server";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const body = (await request.json()) as { nome?: string; descricao?: string; ordem?: number };
    const updates: Record<string, unknown> = {};
    if (typeof body.nome === "string") updates.nome = body.nome.trim();
    if (typeof body.descricao === "string") updates.descricao = body.descricao.trim();
    if (typeof body.ordem === "number") updates.ordem = body.ordem;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    await adminDb.collection("categorias_inventario").doc(id).update(updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/inventario/categorias/[id] PATCH]", err);
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

    await adminDb.collection("categorias_inventario").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/inventario/categorias/[id] DELETE]", err);
    return NextResponse.json({ error: "Erro ao eliminar" }, { status: 503 });
  }
}
