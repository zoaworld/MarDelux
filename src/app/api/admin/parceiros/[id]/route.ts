/**
 * API admin para um parceiro específico.
 * GET: obter parceiro
 * PATCH: atualizar parceiro
 * DELETE: eliminar parceiro
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
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

function toParceiro(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const x = doc.data();
  return {
    id: doc.id,
    codigo: (x?.codigo as string) ?? "",
    nome: (x?.nome as string) ?? "",
    tipo: (x?.tipo as "essencial" | "premium") ?? "essencial",
    email: (x?.email as string) ?? "",
    telefone: x?.telefone as string | undefined,
    estabelecimento: x?.estabelecimento as string | undefined,
    notas: x?.notas as string | undefined,
    sessaoGratuitaUtilizada: (x?.sessaoGratuitaUtilizada as boolean) ?? false,
    ativo: (x?.ativo as boolean) ?? true,
    eliminado: (x?.eliminado as boolean) ?? false,
    motivoEliminacao: x?.motivoEliminacao as string | undefined,
    dataEliminacao: x?.dataEliminacao as string | undefined,
    createdAt: (x?.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: (x?.updatedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(_request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const doc = await adminDb.collection("parceiros").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });
    }
    return NextResponse.json(toParceiro(doc));
  } catch (err) {
    console.error("[api/admin/parceiros/[id] GET]", err);
    return NextResponse.json({ error: "Erro ao carregar parceiro" }, { status: 503 });
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

    const body = (await request.json()) as Record<string, unknown>;
    const allowed = ["nome", "tipo", "email", "telefone", "estabelecimento", "notas", "sessaoGratuitaUtilizada", "ativo"] as const;
    const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (body.codigo !== undefined) {
      const codigo = String(body.codigo).trim().toUpperCase();
      if (!codigo) return NextResponse.json({ error: "Código não pode ser vazio" }, { status: 400 });
      const existing = await adminDb.collection("parceiros").where("codigo", "==", codigo).get();
      const other = existing.docs.find((d) => d.id !== id);
      if (other) return NextResponse.json({ error: "Já existe outro parceiro com este código" }, { status: 400 });
      update.codigo = codigo;
    }
    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    await adminDb.collection("parceiros").doc(id).update(update);
    const doc = await adminDb.collection("parceiros").doc(id).get();
    return NextResponse.json(toParceiro(doc));
  } catch (err) {
    console.error("[api/admin/parceiros/[id] PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar parceiro" }, { status: 503 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const doc = await adminDb.collection("parceiros").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { motivoEliminacao?: string };
    const motivoEliminacao = typeof body.motivoEliminacao === "string" ? body.motivoEliminacao.trim() : "";
    const dataEliminacao = new Date().toISOString().slice(0, 10);

    // Soft delete: marcar eliminado, motivo, data; desativar
    await adminDb.collection("parceiros").doc(id).update({
      eliminado: true,
      motivoEliminacao: motivoEliminacao || null,
      dataEliminacao,
      ativo: false,
      updatedAt: Timestamp.now(),
    });

    // Limpar indicadoPorParceiroId nos clientes que tinham este parceiro
    const clientesSnap = await adminDb
      .collection("clientes")
      .where("indicadoPorParceiroId", "==", id)
      .get();
    const batch = adminDb.batch();
    for (const d of clientesSnap.docs) {
      batch.update(d.ref, { indicadoPorParceiroId: FieldValue.delete(), updatedAt: Timestamp.now() });
    }
    if (!clientesSnap.empty) await batch.commit();

    return NextResponse.json({ ok: true, clientesAtualizados: clientesSnap.size });
  } catch (err) {
    console.error("[api/admin/parceiros/[id] DELETE]", err);
    return NextResponse.json({ error: "Erro ao eliminar parceiro" }, { status: 503 });
  }
}
