/**
 * API para o cliente editar o próprio perfil.
 * GET: obter dados do perfil (nome, email, telefone)
 * PATCH: atualizar nome e telefone
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export type PerfilCliente = {
  nome: string;
  email: string;
  telefone: string;
};

async function verifyCliente(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Token em falta", status: 401 } as const;

  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();

  if (!adminAuth || !adminDb) {
    return { error: "Servidor não configurado (Firebase Admin)", status: 503 } as const;
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = ((decoded.email as string) ?? "").trim().toLowerCase();
  if (!email) return { error: "Email não encontrado", status: 401 } as const;

  return { adminDb, email };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyCliente(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb, email } = auth;

    const clientesSnap = await adminDb
      .collection("clientes")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!clientesSnap.empty) {
      const d = clientesSnap.docs[0].data();
      return NextResponse.json({
        nome: (d.nome as string) ?? "",
        email,
        telefone: (d.telefone as string) ?? "",
      } satisfies PerfilCliente);
    }

    // Cliente não existe na coleção – tentar obter de marcação mais recente
    const [snapLower, snapLegacy] = await Promise.all([
      adminDb.collection("marcacoes").where("clienteEmailLower", "==", email).get(),
      adminDb.collection("marcacoes").where("clienteEmail", "==", email).get(),
    ]);
    const seen = new Set<string>();
    const allMarcacoes = [...snapLower.docs, ...snapLegacy.docs].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    if (allMarcacoes.length > 0) {
      const sorted = allMarcacoes.sort(
        (a, b) => ((b.data().data as string) ?? "").localeCompare((a.data().data as string) ?? "")
      );
      const m = sorted[0].data();
      const nome = (m.clienteNome as string) ?? "";
      const telefone = (m.clienteTelefone as string) ?? "";
      // Criar documento cliente para futuras edições
      await adminDb.collection("clientes").add({
        email,
        nome,
        telefone: telefone || null,
        clienteDesde: (m.data as string) ?? new Date().toISOString().slice(0, 10),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return NextResponse.json({
        nome,
        email,
        telefone,
      } satisfies PerfilCliente);
    }

    // Sem marcações – devolver dados mínimos (utilizador recém-registado)
    return NextResponse.json({
      nome: "",
      email,
      telefone: "",
    } satisfies PerfilCliente);
  } catch (err) {
    console.error("[api/cliente/perfil GET]", err);
    return NextResponse.json(
      { error: "Erro ao carregar perfil" },
      { status: 503 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyCliente(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb, email } = auth;

    const body = (await request.json()) as { nome?: string; telefone?: string };
    const nome = typeof body.nome === "string" ? body.nome.trim() : undefined;
    const telefone = typeof body.telefone === "string" ? body.telefone.trim() || null : undefined;

    if (nome === undefined && telefone === undefined) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const clientesSnap = await adminDb
      .collection("clientes")
      .where("email", "==", email)
      .limit(1)
      .get();

    const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (nome !== undefined) updateData.nome = nome;
    if (telefone !== undefined) updateData.telefone = telefone;

    if (clientesSnap.empty) {
      // Criar novo documento cliente
      await adminDb.collection("clientes").add({
        email,
        nome: nome ?? "",
        telefone: telefone ?? null,
        clienteDesde: new Date().toISOString().slice(0, 10),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return NextResponse.json({
        nome: nome ?? "",
        email,
        telefone: telefone ?? "",
      } satisfies PerfilCliente);
    }

    await clientesSnap.docs[0].ref.update(updateData);
    const data = clientesSnap.docs[0].data();
    return NextResponse.json({
      nome: nome ?? (data.nome as string) ?? "",
      email,
      telefone: telefone ?? (data.telefone as string) ?? "",
    } satisfies PerfilCliente);
  } catch (err) {
    console.error("[api/cliente/perfil PATCH]", err);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil" },
      { status: 503 }
    );
  }
}
