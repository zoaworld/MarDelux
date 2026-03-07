/**
 * Envio de emails (Resend).
 */

import { Resend } from "resend";
import { getAdminFirestore } from "./firebase-admin";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const FROM_NAME = process.env.RESEND_FROM_NAME ?? "MarDelux";

async function getNomeEmpresa(): Promise<string> {
  const db = getAdminFirestore();
  if (!db) return "MarDelux";
  try {
    const snap = await db.collection("config").doc("site").get();
    const nome = snap.data()?.nomeEmpresa;
    return typeof nome === "string" && nome.trim() ? nome.trim() : "MarDelux";
  } catch {
    return "MarDelux";
  }
}

function formatDate(str: string): string {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export interface ConfirmacaoMarcacaoInput {
  clienteEmail: string;
  clienteNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  servicoNome: string;
  preco?: number;
}

/** Envia email de confirmação de marcação ao cliente. Retorna true se enviado ou se Resend não está configurado. */
export async function sendConfirmacaoMarcacao(input: ConfirmacaoMarcacaoInput): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    return { ok: true };
  }
  if (!input.clienteEmail?.trim() || !input.data || !input.horaInicio || !input.horaFim || !input.servicoNome) {
    return { ok: false, error: "Dados insuficientes" };
  }
  try {
    const nomeEmpresa = await getNomeEmpresa();
    const dataFormatada = formatDate(input.data);
    const precoText = input.preco != null ? ` · ${input.preco} €` : "";

    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [input.clienteEmail.trim()],
      subject: `Confirmação da sua marcação – ${nomeEmpresa}`,
      html: `
        <p>Olá ${input.clienteNome || "Cliente"},</p>
        <p>A sua marcação foi confirmada.</p>
        <p><strong>Serviço:</strong> ${input.servicoNome}</p>
        <p><strong>Data:</strong> ${dataFormatada}</p>
        <p><strong>Hora:</strong> ${input.horaInicio} – ${input.horaFim}${precoText}</p>
        <p>Obrigada por escolher ${nomeEmpresa}. Até breve!</p>
      `,
    });

    if (error) {
      console.error("[email confirmacao]", error);
      return { ok: false, error: "Falha no envio" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email confirmacao]", err);
    return { ok: false, error: "Erro no envio" };
  }
}
