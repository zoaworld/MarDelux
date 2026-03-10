/**
 * API admin para comissões de um parceiro.
 * GET: lista comissões do parceiro
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(_request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const snap = await adminDb
      .collection("comissoes")
      .where("parceiroId", "==", id)
      .orderBy("createdAt", "desc")
      .get();

    const list = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        marcacaoId: (x.marcacaoId as string) ?? "",
        clienteEmail: (x.clienteEmail as string) ?? "",
        tipo: (x.tipo as "primeira_sessao" | "sessao_seguinte") ?? "primeira_sessao",
        valorSessao: (x.valorSessao as number) ?? 0,
        percentagem: (x.percentagem as number) ?? 0,
        valorComissao: (x.valorComissao as number) ?? 0,
        status: (x.status as "pendente" | "pago") ?? "pendente",
        dataSessao: (x.dataSessao as string) ?? "",
        dataPago: x.dataPago as string | undefined,
        createdAt: (x.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
      };
    });

    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/parceiros/[id]/comissoes GET]", err);
    return NextResponse.json({ error: "Erro ao carregar comissões" }, { status: 503 });
  }
}
