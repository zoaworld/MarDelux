/**
 * Valida um código de parceiro (referral).
 * API pública – sem autenticação. Usada no fluxo de agendamento.
 * Aceita email e telefone para verificar se é cliente existente (código exclusivo para novos).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase-admin";

const DESCONTO_PRIMEIRA_SESSAO = 10;

/** Normaliza telefone: remove espaços, traços, prefixo +351/00351; apenas dígitos */
function normalizarTelefone(tel: string): string {
  let s = tel.replace(/[\s\-\.]/g, "");
  s = s.replace(/^(\+351|00351|351)/i, "");
  return s.replace(/\D/g, "");
}

/** Verifica se existe cliente com marcação concluída por telefone ou email */
async function clienteExistente(
  adminDb: FirebaseFirestore.Firestore,
  telefone?: string | null,
  email?: string | null
): Promise<boolean> {
  const marcacoesRef = adminDb.collection("marcacoes");

  // 1. Procurar por telefone (principal) - ordem de verificação
  if (telefone?.trim()) {
    const telNorm = normalizarTelefone(telefone);
    if (telNorm.length >= 9) {
      const snapTel = await marcacoesRef
        .where("status", "==", "concluida")
        .limit(500)
        .get();
      const matchTel = snapTel.docs.some((d) => {
        const t = (d.data().clienteTelefone as string) ?? "";
        return normalizarTelefone(t) === telNorm;
      });
      if (matchTel) return true;
    }
  }

  // 2. Procurar por email (secundário)
  if (email?.trim()) {
    const emailNorm = email.trim().toLowerCase();
    const [snapLower, snapOld] = await Promise.all([
      marcacoesRef
        .where("status", "==", "concluida")
        .where("clienteEmailLower", "==", emailNorm)
        .limit(1)
        .get(),
      marcacoesRef
        .where("status", "==", "concluida")
        .where("clienteEmail", "==", emailNorm)
        .limit(1)
        .get(),
    ]);
    if (!snapLower.empty || !snapOld.empty) return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    const codigo = request.nextUrl.searchParams.get("codigo")?.trim().toUpperCase();
    if (!codigo) {
      return NextResponse.json({ valido: false }, { status: 400 });
    }

    const email = request.nextUrl.searchParams.get("email")?.trim() || null;
    const telefone = request.nextUrl.searchParams.get("telefone")?.trim() || null;

    const adminDb = getAdminFirestore();
    if (!adminDb) {
      return NextResponse.json({ valido: false }, { status: 503 });
    }

    const snap = await adminDb
      .collection("parceiros")
      .where("codigo", "==", codigo)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ valido: false });
    }

    const doc = snap.docs[0];
    const data = doc.data();
    const ativo = data.ativo === true;
    const eliminado = data.eliminado === true;

    if (!ativo || eliminado) {
      return NextResponse.json({ valido: false });
    }

    // Bloquear código para clientes existentes (telefone principal, email secundário)
    if (telefone || email) {
      const existente = await clienteExistente(adminDb, telefone, email);
      if (existente) {
        return NextResponse.json({
          valido: false,
          erroCodigoExclusivo:
            "Este código é exclusivo para novos clientes. Já é nosso cliente? Entre em contacto connosco para outras ofertas.",
        });
      }
    }

    return NextResponse.json({
      valido: true,
      parceiro: {
        id: doc.id,
        nome: (data.nome as string) ?? "",
        tipo: (data.tipo as "essencial" | "premium") ?? "essencial",
        codigo: (data.codigo as string) ?? codigo,
      },
      descontoPercentagem: DESCONTO_PRIMEIRA_SESSAO,
    });
  } catch (err) {
    console.error("[api/parceiros/validar]", err);
    return NextResponse.json({ valido: false }, { status: 500 });
  }
}
