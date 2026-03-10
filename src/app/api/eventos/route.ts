/**
 * API pública para listar eventos publicados (sem auth).
 */

import { NextResponse } from "next/server";
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
    checkoutAtivo: (x?.checkoutAtivo as boolean) ?? false,
    status: (x?.status as string) ?? "rascunho",
    slug: (x?.slug as string) ?? "",
  };
}

export async function GET() {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) return NextResponse.json({ error: "Erro de configuração" }, { status: 503 });

    const snap = await adminDb.collection("eventos").where("status", "==", "publicado").get();
    const now = new Date();
    const list = snap.docs
      .map((d) => toEvento(d))
      .filter((e) => new Date((e.dataFim as string) || 0) >= now)
      .sort((a, b) => new Date((a.dataInicio as string) || 0).getTime() - new Date((b.dataInicio as string) || 0).getTime());

    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/eventos GET]", err);
    return NextResponse.json({ error: "Erro ao carregar eventos" }, { status: 503 });
  }
}
