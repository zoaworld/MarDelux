/**
 * API pública para validar código promocional.
 * GET ?codigo=XXX&tipo=site|evento&eventoId=YYY (eventoId só para tipo=evento)
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";

function toIso(x: unknown): string {
  if (!x) return "";
  if (typeof x === "object" && "toDate" in x && typeof (x as { toDate: () => Date }).toDate === "function") {
    return (x as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof x === "string" ? x : "";
}

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) return NextResponse.json({ error: "Erro de configuração" }, { status: 503 });

    const codigo = request.nextUrl.searchParams.get("codigo")?.trim().toUpperCase();
    const tipo = request.nextUrl.searchParams.get("tipo") || "evento";
    const eventoId = request.nextUrl.searchParams.get("eventoId") || undefined;

    if (!codigo) {
      return NextResponse.json({ valido: false, erro: "Código em falta" });
    }

    const snap = await adminDb
      .collection("codigos_promocionais")
      .where("codigo", "==", codigo)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ valido: false, erro: "Código inválido" });
    }

    const doc = snap.docs[0];
    const data = doc.data();

    if (!(data.ativo as boolean)) {
      return NextResponse.json({ valido: false, erro: "Código inativo" });
    }

    if ((data.tipoAplicacao as string) !== tipo) {
      return NextResponse.json({
        valido: false,
        erro: tipo === "evento" ? "Este código não é válido para este evento" : "Este código não é válido para o site",
      });
    }

    if (tipo === "evento" && eventoId && (data.eventoId as string) !== eventoId) {
      return NextResponse.json({ valido: false, erro: "Código não válido para este evento" });
    }

    const now = new Date();
    const validadeInicio = data.validadeInicio ? new Date(toIso(data.validadeInicio)) : null;
    const validadeFim = data.validadeFim ? new Date(toIso(data.validadeFim)) : null;
    if (validadeInicio && now < validadeInicio) {
      return NextResponse.json({ valido: false, erro: "Código ainda não está válido" });
    }
    if (validadeFim && now > validadeFim) {
      return NextResponse.json({ valido: false, erro: "Código expirado" });
    }

    const usosMaximos = data.usosMaximos as number | undefined;
    const usosAtuais = (data.usosAtuais as number) ?? 0;
    if (typeof usosMaximos === "number" && usosAtuais >= usosMaximos) {
      return NextResponse.json({ valido: false, erro: "Código esgotado" });
    }

    return NextResponse.json({
      valido: true,
      id: doc.id,
      codigo: data.codigo,
      descontoPercentagem: (data.descontoPercentagem as number) ?? 0,
    });
  } catch (err) {
    console.error("[api/codigos/validar]", err);
    return NextResponse.json({ valido: false, erro: "Erro ao validar código" });
  }
}
