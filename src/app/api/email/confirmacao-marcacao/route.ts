/**
 * API para envio de email de confirmação.
 * Usado pelo fluxo de agendamento do cliente (após createMarcacao no cliente).
 * O admin usa sendConfirmacaoMarcacao diretamente no servidor.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendConfirmacaoMarcacao } from "@/lib/email";

function formatDate(str: string): string {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      clienteEmail: string;
      clienteNome: string;
      data: string;
      horaInicio: string;
      horaFim: string;
      servicoNome: string;
      preco?: number;
    };

    const result = await sendConfirmacaoMarcacao(body);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Falha no envio do email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email/confirmacao]", err);
    return NextResponse.json(
      { error: "Erro no servidor" },
      { status: 500 }
    );
  }
}
