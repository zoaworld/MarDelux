/**
 * Migra o email nas coleções Firestore (clientes, marcações) após alteração no Firebase Auth.
 * O cliente deve chamar updateEmail() primeiro; depois esta API com o email antigo.
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Token em falta" }, { status: 401 });

    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Servidor não configurado (Firebase Admin)" },
        { status: 503 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const newEmail = ((decoded.email as string) ?? "").trim().toLowerCase();
    if (!newEmail) return NextResponse.json({ error: "Email não encontrado" }, { status: 401 });

    const body = (await request.json()) as { oldEmail?: string };
    const oldEmail = ((body.oldEmail as string) ?? "").trim().toLowerCase();
    if (!oldEmail) {
      return NextResponse.json({ error: "Email antigo em falta" }, { status: 400 });
    }

    // Só permite migrar para o email atual do token (o utilizador já alterou no Auth)
    if (oldEmail === newEmail) {
      return NextResponse.json({ error: "O email antigo é igual ao novo" }, { status: 400 });
    }

    const batch = adminDb.batch();

    // Atualizar cliente
    const clientesSnap = await adminDb
      .collection("clientes")
      .where("email", "==", oldEmail)
      .limit(1)
      .get();

    if (!clientesSnap.empty) {
      batch.update(clientesSnap.docs[0].ref, {
        email: newEmail,
        updatedAt: Timestamp.now(),
      });
    }

    // Atualizar marcações (query por ambos os campos para cobrir docs antigos e novos)
    const [snapLower, snapLegacy] = await Promise.all([
      adminDb.collection("marcacoes").where("clienteEmailLower", "==", oldEmail).get(),
      adminDb.collection("marcacoes").where("clienteEmail", "==", oldEmail).get(),
    ]);
    const seenIds = new Set<string>();
    const marcacoesToUpdate = [...snapLower.docs, ...snapLegacy.docs].filter((d) => {
      if (seenIds.has(d.id)) return false;
      seenIds.add(d.id);
      return true;
    });

    marcacoesToUpdate.forEach((doc) => {
      batch.update(doc.ref, {
        clienteEmail: newEmail,
        clienteEmailLower: newEmail,
        updatedAt: Timestamp.now(),
      });
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      clientesAtualizados: clientesSnap.empty ? 0 : 1,
      marcacoesAtualizadas: marcacoesToUpdate.length,
    });
  } catch (err) {
    console.error("[api/cliente/perfil/alterar-email]", err);
    return NextResponse.json({ error: "Erro ao alterar email" }, { status: 503 });
  }
}
