/**
 * API admin para um cliente específico.
 * GET: obter cliente
 * PATCH: atualizar cliente
 * DELETE: eliminar cliente e anonimizar dados nas marcações (RGPD)
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Token em falta", status: 401 } as const;
  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();
  if (!adminAuth || !adminDb) return { error: "Firebase Admin não configurado", status: 503 } as const;
  const decoded = await adminAuth.verifyIdToken(token);
  const email = (decoded.email ?? "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) return { error: "Acesso reservado ao administrador", status: 403 } as const;
  return { adminDb };
}

function toCliente(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const x = doc.data();
  return {
    id: doc.id,
    email: (x?.email as string) ?? "",
    nome: (x?.nome as string) ?? "",
    indicadoPorParceiroId: x?.indicadoPorParceiroId as string | undefined,
    telefone: x?.telefone as string | undefined,
    dataNascimento: x?.dataNascimento as string | undefined,
    clienteDesde: x?.clienteDesde as string | undefined,
    origem: x?.origem as string | undefined,
    problemasSaude: x?.problemasSaude as string | undefined,
    medicacao: x?.medicacao as string | undefined,
    contraindicatedoes: x?.contraindicatedoes as string | undefined,
    sensibilidadeDor: x?.sensibilidadeDor as string | undefined,
    preferenciasAmbiente: x?.preferenciasAmbiente as string | undefined,
    reacoes: x?.reacoes as string | undefined,
    horarioPreferido: x?.horarioPreferido as string | undefined,
    notasPessoais: x?.notasPessoais as string | undefined,
    createdAt: (x?.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: (x?.updatedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(_request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const doc = await adminDb.collection("clientes").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    const cliente = toCliente(doc);
    const parceiroId = cliente.indicadoPorParceiroId as string | undefined;
    if (parceiroId) {
      const parceiroDoc = await adminDb.collection("parceiros").doc(parceiroId).get();
      cliente.indicadoPorParceiroNome = parceiroDoc.data()?.nome as string | undefined;
    }
    return NextResponse.json(cliente);
  } catch (err) {
    console.error("[api/admin/clientes/[id] GET]", err);
    return NextResponse.json({ error: "Erro ao carregar cliente" }, { status: 503 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const body = (await request.json()) as Record<string, unknown>;
    const allowed: (keyof typeof body)[] = [
      "nome", "telefone", "dataNascimento", "clienteDesde", "origem", "indicadoPorParceiroId",
      "problemasSaude", "medicacao", "contraindicatedoes", "sensibilidadeDor",
      "preferenciasAmbiente", "reacoes", "horarioPreferido", "notasPessoais",
    ];
    const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    await adminDb.collection("clientes").doc(id).update(update);
    const doc = await adminDb.collection("clientes").doc(id).get();
    return NextResponse.json(toCliente(doc));
  } catch (err) {
    console.error("[api/admin/clientes/[id] PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar cliente" }, { status: 503 });
  }
}

const GDPR_DELETED_REGEX = /^deleted-.+@gdpr\.local$/;

/** Elimina cliente. Se já anonimizado ([Removido RGPD]), remove permanentemente. Senão, anonimiza marcações (RGPD). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(_request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const clientDoc = await adminDb.collection("clientes").doc(id).get();
    if (!clientDoc.exists) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }
    const email = ((clientDoc.data()?.email as string) ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Cliente sem email" }, { status: 400 });
    }

    const batch = adminDb.batch();
    batch.delete(adminDb.collection("clientes").doc(id));

    const marcacoesSnap = await adminDb
      .collection("marcacoes")
      .where("clienteEmail", "==", email)
      .get();

    const isAlreadyAnonymized = GDPR_DELETED_REGEX.test(email);
    if (isAlreadyAnonymized) {
      marcacoesSnap.docs.forEach((doc) => batch.delete(doc.ref));
    } else {
      const anonId = `deleted-${id}@gdpr.local`;
      marcacoesSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          clienteEmail: anonId,
          clienteEmailLower: anonId,
          clienteNome: "[Removido RGPD]",
          clienteTelefone: null,
          updatedAt: Timestamp.now(),
        });
      });
    }

    await batch.commit();
    return NextResponse.json({
      ok: true,
      marcacoesAnonimizadas: isAlreadyAnonymized ? 0 : marcacoesSnap.size,
      marcacoesEliminadas: isAlreadyAnonymized ? marcacoesSnap.size : 0,
    });
  } catch (err) {
    console.error("[api/admin/clientes/[id] DELETE]", err);
    return NextResponse.json({ error: "Erro ao eliminar cliente" }, { status: 503 });
  }
}
