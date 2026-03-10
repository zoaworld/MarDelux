/**
 * API admin para comissões (todas).
 * GET: lista comissões com filtros
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

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const statusFilter = request.nextUrl.searchParams.get("status");
    const parceiroId = request.nextUrl.searchParams.get("parceiroId");

    const snap = parceiroId
      ? await adminDb.collection("comissoes").where("parceiroId", "==", parceiroId).orderBy("createdAt", "desc").get()
      : await adminDb.collection("comissoes").orderBy("createdAt", "desc").get();

    let list = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        parceiroId: (x.parceiroId as string) ?? "",
        marcacaoId: (x.marcacaoId as string) ?? "",
        clienteEmail: (x.clienteEmail as string) ?? "",
        tipo: (x.tipo as "primeira_sessao" | "sessao_seguinte") ?? "primeira_sessao",
        valorSessao: (x.valorSessao as number) ?? 0,
        percentagem: (x.percentagem as number) ?? 0,
        valorComissao: (x.valorComissao as number) ?? 0,
        status: (x.status as "pendente" | "pago") ?? "pendente",
        parceiroAtivoNaData: (x.parceiroAtivoNaData as boolean) ?? true,
        dataSessao: (x.dataSessao as string) ?? "",
        dataPago: x.dataPago as string | undefined,
        createdAt: (x.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
      };
    });

    if (statusFilter === "pendente") list = list.filter((c) => c.status === "pendente");
    if (statusFilter === "pago") list = list.filter((c) => c.status === "pago");

    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/comissoes GET]", err);
    return NextResponse.json({ error: "Erro ao carregar comissões" }, { status: 503 });
  }
}
