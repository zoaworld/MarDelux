/**
 * API pública para resolver cliente por email + telefone (sem auth).
 * Usado no fluxo de agendamento: se já existe ficha com esse email e telefone,
 * devolve nome e origem para preencher a marcação e ligar à ficha.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

function normalizePhone(telefone: string): string {
  return (telefone ?? "").replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return NextResponse.json({ encontrado: false });
    }

    const email = (request.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
    const telefone = (request.nextUrl.searchParams.get("telefone") ?? "").trim();
    if (!email) {
      return NextResponse.json({ encontrado: false });
    }

    const telefoneNorm = normalizePhone(telefone);
    const clientesSnap = await adminDb
      .collection("clientes")
      .where("email", "==", email)
      .limit(5)
      .get();

    if (clientesSnap.empty) {
      return NextResponse.json({ encontrado: false });
    }

    // Match por email + telefone (telefone normalizado). Se não tiver telefone na query, aceita o primeiro por email.
    for (const doc of clientesSnap.docs) {
      const d = doc.data();
      const telFicha = (d.telefone as string) ?? "";
      const telFichaNorm = normalizePhone(telFicha);
      if (telefoneNorm && telFichaNorm) {
        if (telFichaNorm !== telefoneNorm) continue;
      }
      // Match: mesmo email e (sem telefone na query ou telefone coincide)
      const indicadoPorParceiroId = d.indicadoPorParceiroId as string | undefined;
      let indicadoPorParceiroNome: string | undefined;
      let indicadoPorParceiroCodigo: string | undefined;
      if (indicadoPorParceiroId) {
        const parceiroDoc = await adminDb.collection("parceiros").doc(indicadoPorParceiroId).get();
        const parceiroData = parceiroDoc.data();
        indicadoPorParceiroNome = parceiroData?.nome as string | undefined;
        indicadoPorParceiroCodigo = parceiroData?.codigo as string | undefined;
      }
      return NextResponse.json({
        encontrado: true,
        cliente: {
          id: doc.id,
          nome: (d.nome as string) ?? "",
          origem: (d.origem as string) ?? undefined,
          indicadoPorParceiroId: indicadoPorParceiroId ?? undefined,
          indicadoPorParceiroNome: indicadoPorParceiroNome ?? undefined,
          indicadoPorParceiroCodigo: indicadoPorParceiroCodigo ?? undefined,
        },
      });
    }

    return NextResponse.json({ encontrado: false });
  } catch (err) {
    console.error("[api/agendar/resolver-cliente]", err);
    return NextResponse.json({ encontrado: false });
  }
}
