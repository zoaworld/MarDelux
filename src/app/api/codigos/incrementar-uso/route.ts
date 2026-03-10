/**
 * Incrementa o contador de usos de um código promocional.
 * POST { codigoId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) return NextResponse.json({ error: "Erro de configuração" }, { status: 503 });

    const body = (await request.json().catch(() => ({}))) as { codigoId?: string };
    const codigoId = body.codigoId;
    if (!codigoId) {
      return NextResponse.json({ error: "codigoId em falta" }, { status: 400 });
    }

    const ref = adminDb.collection("codigos_promocionais").doc(codigoId);
    await ref.update({
      usosAtuais: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/codigos/incrementar-uso]", err);
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 503 });
  }
}
