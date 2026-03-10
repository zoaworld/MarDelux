/**
 * Lógica de criação de comissões quando uma marcação é concluída e paga.
 */

import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

interface MarcacaoData {
  parceiroId?: string;
  parceiroCodigo?: string;
  preco: number;
  precoOriginal?: number;
  primeiraSessaoIndicacao?: boolean;
  clienteEmail?: string;
  clienteEmailLower?: string;
  clienteNome?: string;
  data?: string;
}

export async function maybeCreateComissao(
  db: Firestore,
  marcacaoId: string,
  data: MarcacaoData
): Promise<{ created: boolean; error?: string }> {
  if (!data.parceiroId || !data.clienteEmail?.trim()) {
    return { created: false };
  }

  const clienteEmail = (data.clienteEmailLower ?? data.clienteEmail.trim().toLowerCase()) || "";
  const valorSessao = typeof data.preco === "number" ? data.preco : 0;
  if (valorSessao <= 0) return { created: false };

  // Idempotência: já existe comissão para esta marcação?
  const existingSnap = await db
    .collection("comissoes")
    .where("marcacaoId", "==", marcacaoId)
    .limit(1)
    .get();
  if (!existingSnap.empty) return { created: false };

  const parceiroSnap = await db.collection("parceiros").doc(data.parceiroId).get();
  if (!parceiroSnap.exists) return { created: false };

  const parceiroData = parceiroSnap.data();
  const parceiroEmail = ((parceiroData?.email as string) ?? "").trim().toLowerCase();
  const tipo = (parceiroData?.tipo as "essencial" | "premium") ?? "essencial";
  const dataSessao = (data.data as string) ?? "";

  /** Parceiro estava ativo na data da sessão (comissões de inativos/eliminados são registadas mas não pagas) */
  const parceiroAtivoNaData = (() => {
    const ativo = parceiroData?.ativo === true;
    const eliminado = parceiroData?.eliminado === true;
    const dataEliminacao = (parceiroData?.dataEliminacao as string) ?? "";
    if (!ativo) return false;
    if (!eliminado) return true;
    return !!dataEliminacao && dataEliminacao > dataSessao; // eliminado depois da sessão = estava ativo
  })();

  // Self-referral: cliente e parceiro não podem ter o mesmo email
  if (parceiroEmail && clienteEmail === parceiroEmail) {
    return { created: false, error: "Self-referral não permitido" };
  }

  let percentagem: number;
  let tipoComissao: "primeira_sessao" | "sessao_seguinte";

  if (data.primeiraSessaoIndicacao === true) {
    tipoComissao = "primeira_sessao";
    percentagem = tipo === "premium" ? 20 : 15;
  } else {
    // Sessão seguinte - só Premium tem comissão
    if (tipo !== "premium") return { created: false };
    // Verificar se o cliente foi indicado por este parceiro
    const clientesSnap = await db
      .collection("clientes")
      .where("email", "==", clienteEmail)
      .limit(1)
      .get();
    const clienteDoc = clientesSnap.docs[0];
    const indicadoPor = clienteDoc?.data?.()?.indicadoPorParceiroId as string | undefined;
    if (indicadoPor !== data.parceiroId) return { created: false };
    tipoComissao = "sessao_seguinte";
    percentagem = 10;
  }

  const valorComissao = Math.round(valorSessao * (percentagem / 100) * 100) / 100;

  await db.collection("comissoes").add({
    parceiroId: data.parceiroId,
    marcacaoId,
    clienteEmail: data.clienteEmail.trim(),
    tipo: tipoComissao,
    valorSessao,
    percentagem,
    valorComissao,
    status: "pendente",
    dataSessao,
    parceiroAtivoNaData,
    createdAt: Timestamp.now(),
  });

  // Se primeira sessão indicada (essencial ou premium): associar cliente ao parceiro (indicadoPorParceiroId)
  if (data.primeiraSessaoIndicacao === true && clienteEmail) {
    const clientesSnap = await db
      .collection("clientes")
      .where("email", "==", clienteEmail)
      .limit(1)
      .get();
    const clienteDoc = clientesSnap.docs[0];
    if (clienteDoc?.exists) {
      const existing = clienteDoc.data()?.indicadoPorParceiroId;
      if (!existing) {
        await clienteDoc.ref.update({
          indicadoPorParceiroId: data.parceiroId,
          origem: "Parceiro",
          updatedAt: Timestamp.now(),
        });
      }
    } else {
      // Cliente não existe - criar com indicadoPorParceiroId para sessões seguintes Premium
      const nome = (data.clienteNome as string)?.trim() ?? "";
      const clienteDesde = (data.data as string) || new Date().toISOString().slice(0, 10);
      await db.collection("clientes").add({
        email: clienteEmail,
        nome: nome || "A preencher",
        indicadoPorParceiroId: data.parceiroId,
        origem: "Parceiro",
        clienteDesde,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  }

  return { created: true };
}
