/**
 * API pública para obter evento por slug (sem auth).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

function toIso(x: unknown): string {
  if (!x) return "";
  if (typeof x === "object" && "toDate" in x && typeof (x as { toDate: () => Date }).toDate === "function") {
    return (x as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof x === "string" ? x : "";
}

function toEvento(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const x = doc.data();
  return {
    id: doc.id,
    modelo: (x?.modelo as string) ?? "externo",
    participacao: (x?.participacao as string) ?? "todos",
    titulo: x?.titulo as string | undefined,
    descricao: x?.descricao as string | undefined,
    dataInicio: toIso(x?.dataInicio),
    dataFim: toIso(x?.dataFim),
    localTipo: (x?.localTipo as string) ?? "mardelux",
    localValor: x?.localValor as string | undefined,
    contactoInfo: x?.contactoInfo as string | undefined,
    imagemUrl: x?.imagemUrl as string | undefined,
    servicosIds: Array.isArray(x?.servicosIds) ? x.servicosIds : [],
    servicosMaxEscolha: typeof x?.servicosMaxEscolha === "number" ? x.servicosMaxEscolha : undefined,
    codigoAtivo: (x?.codigoAtivo as boolean) ?? false,
    codigoPromocionalId: (x?.codigoPromocionalId as string) ?? undefined,
    checkoutAtivo: (x?.checkoutAtivo as boolean) ?? false,
    status: (x?.status as string) ?? "rascunho",
    slug: (x?.slug as string) ?? "",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) return NextResponse.json({ error: "Erro de configuração" }, { status: 503 });

    const { slug } = await params;
    const snap = await adminDb.collection("eventos").where("slug", "==", slug).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }
    const evento = toEvento(snap.docs[0]);
    if ((evento.status as string) !== "publicado") {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }
    if (evento.codigoAtivo && evento.codigoPromocionalId) {
      try {
        const codSnap = await adminDb.collection("codigos_promocionais").doc(evento.codigoPromocionalId as string).get();
        if (codSnap.exists) {
          (evento as Record<string, unknown>).codigoDescontoPercentagem = codSnap.data()?.descontoPercentagem ?? 0;
        }
      } catch {
        /* ignorar */
      }
    }
    return NextResponse.json(evento);
  } catch (err) {
    console.error("[api/eventos/[slug] GET]", err);
    return NextResponse.json({ error: "Erro ao carregar evento" }, { status: 503 });
  }
}
