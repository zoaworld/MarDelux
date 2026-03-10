/**
 * API admin para atualizar uma marcação (PATCH).
 * Ao marcar como concluída e paga, cria comissão se houver parceiro.
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { clearMarcacoesCache } from "../route";
import { maybeCreateComissao } from "@/lib/comissoes-logic";

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

    const body = (await request.json()) as {
      status?: string;
      motivoCancelamento?: "cliente_cancela" | "falha_tecnica" | "outro";
      motivoCancelamentoTexto?: string;
      pagamentoRecebido?: boolean;
      metodoPagamento?: "Dinheiro" | "MB Way" | "Multibanco" | "Cartão" | null;
      notasSessao?: string;
      parceiroId?: string;
      parceiroCodigo?: string;
      preco?: number;
      precoOriginal?: number;
      descontoParceiro?: number;
      primeiraSessaoIndicacao?: boolean;
    };

    const docRef = adminDb.collection("marcacoes").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (body.status !== undefined) updateData.status = body.status;
    if (body.motivoCancelamento !== undefined) updateData.motivoCancelamento = body.motivoCancelamento;
    if (body.motivoCancelamentoTexto !== undefined) updateData.motivoCancelamentoTexto = body.motivoCancelamentoTexto;
    if (body.pagamentoRecebido !== undefined) updateData.pagamentoRecebido = body.pagamentoRecebido;
    if (body.metodoPagamento !== undefined) updateData.metodoPagamento = body.metodoPagamento;
    if (body.notasSessao !== undefined) updateData.notasSessao = body.notasSessao;
    if (body.parceiroId !== undefined) updateData.parceiroId = body.parceiroId;
    if (body.parceiroCodigo !== undefined) updateData.parceiroCodigo = body.parceiroCodigo;
    if (body.preco !== undefined) updateData.preco = body.preco;
    if (body.precoOriginal !== undefined) updateData.precoOriginal = body.precoOriginal;
    if (body.descontoParceiro !== undefined) updateData.descontoParceiro = body.descontoParceiro;
    if (body.primeiraSessaoIndicacao !== undefined) updateData.primeiraSessaoIndicacao = body.primeiraSessaoIndicacao;

    await docRef.update(updateData);
    clearMarcacoesCache();

    const newStatus = body.status ?? docSnap.data()?.status;
    const newPagamento = body.pagamentoRecebido ?? docSnap.data()?.pagamentoRecebido;

    if (newStatus === "concluida" && newPagamento === true) {
      const merged = { ...docSnap.data(), ...updateData } as Record<string, unknown>;
      void maybeCreateComissao(adminDb, id, {
        parceiroId: merged.parceiroId as string | undefined,
        parceiroCodigo: merged.parceiroCodigo as string | undefined,
        preco: (merged.preco as number) ?? 0,
        precoOriginal: merged.precoOriginal as number | undefined,
        primeiraSessaoIndicacao: merged.primeiraSessaoIndicacao as boolean | undefined,
        clienteEmail: merged.clienteEmail as string | undefined,
        clienteEmailLower: merged.clienteEmailLower as string | undefined,
        clienteNome: merged.clienteNome as string | undefined,
        data: merged.data as string | undefined,
      }).catch((e) => console.error("[marcacoes PATCH] comissao:", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/marcacoes/[id] PATCH]", err);
    return NextResponse.json(
      { error: "Erro ao atualizar marcação" },
      { status: 503 }
    );
  }
}
