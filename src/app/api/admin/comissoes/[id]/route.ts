/**
 * API admin para uma comissão específica.
 * PATCH: marcar como pago
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

    const body = (await request.json()) as { status?: "pago" };
    if (body.status !== "pago") {
      return NextResponse.json({ error: "Apenas status 'pago' é suportado" }, { status: 400 });
    }

    const ref = adminDb.collection("comissoes").doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Comissão não encontrada" }, { status: 404 });
    }

    const docData = doc.data();
    const parceiroAtivoNaData = docData?.parceiroAtivoNaData !== false;
    if (!parceiroAtivoNaData) {
      return NextResponse.json(
        { error: "Comissão de parceiro inativo na data da sessão não pode ser paga" },
        { status: 400 }
      );
    }

    const dataPago = new Date().toISOString().slice(0, 10);
    await ref.update({ status: "pago", dataPago });

    const updated = await ref.get();
    const x = updated.data();
    return NextResponse.json({
      id: updated.id,
      status: "pago",
      dataPago,
      valorComissao: (x?.valorComissao as number) ?? 0,
    });
  } catch (err) {
    console.error("[api/admin/comissoes/[id] PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar comissão" }, { status: 503 });
  }
}
