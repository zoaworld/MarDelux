/**
 * API admin para clientes.
 * GET: lista clientes (sincroniza a partir de marcações se necessário)
 * POST: criar cliente
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

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const GDPR_DELETED_REGEX = /^deleted-.+@gdpr\.local$/;
    const clientesSnap = await adminDb.collection("clientes").get();
    const clientesMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    clientesSnap.docs.forEach((d) => {
      const email = (d.data().email as string)?.toLowerCase?.() ?? "";
      if (email) clientesMap.set(email, d);
    });

    // Sincronizar: criar cliente para cada email em marcações que ainda não existe
    const marcacoesSnap = await adminDb.collection("marcacoes").get();
    const emailsFromMarcacoes = new Map<string, { nome: string; telefone?: string; minData: string; parceiroId?: string }>();
    marcacoesSnap.docs.forEach((d) => {
      const x = d.data();
      const email = ((x.clienteEmail as string) ?? "").trim().toLowerCase();
      if (!email || GDPR_DELETED_REGEX.test(email)) return;
      const data = (x.data as string) ?? "";
      const parceiroId = x.parceiroId as string | undefined;
      const existing = emailsFromMarcacoes.get(email);
      if (!existing || data < existing.minData) {
        emailsFromMarcacoes.set(email, {
          nome: (x.clienteNome as string) ?? "",
          telefone: x.clienteTelefone as string | undefined,
          minData: data,
          parceiroId: parceiroId ?? existing?.parceiroId,
        });
      }
    });

    for (const [email, info] of emailsFromMarcacoes) {
      if (clientesMap.has(email)) continue;
      const docData: Record<string, unknown> = {
        email,
        nome: info.nome,
        telefone: info.telefone ?? null,
        clienteDesde: info.minData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      if (info.parceiroId) {
        docData.indicadoPorParceiroId = info.parceiroId;
        docData.origem = "Parceiro";
      }
      const ref = await adminDb.collection("clientes").add(docData);
      const newDoc = await ref.get();
      if (newDoc.exists) clientesMap.set(email, newDoc);
    }

    const rawList = Array.from(clientesMap.values())
      .filter((d) => !GDPR_DELETED_REGEX.test(((d.data()?.email as string) ?? "").toLowerCase()))
      .map(toCliente);

    const uniqueParceiroIds = [...new Set(
      rawList
        .map((c) => c.indicadoPorParceiroId as string | undefined)
        .filter((id): id is string => Boolean(id))
    )];
    const parceiroIdToNome = new Map<string, string>();
    for (const pid of uniqueParceiroIds) {
      const doc = await adminDb.collection("parceiros").doc(pid).get();
      const nome = doc.data()?.nome as string | undefined;
      if (nome) parceiroIdToNome.set(pid, nome);
    }

    const list = rawList.map((c) => ({
      ...c,
      indicadoPorParceiroNome: (c.indicadoPorParceiroId as string | undefined)
        ? parceiroIdToNome.get(c.indicadoPorParceiroId as string)
        : undefined,
    })) as Array<Record<string, unknown>>;
    list.sort((a, b) => (a.nome as string).localeCompare(b.nome as string));
    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/clientes GET]", err);
    return NextResponse.json({ error: "Erro ao carregar clientes" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as {
      nome: string;
      email: string;
      telefone?: string;
      dataNascimento?: string;
      origem?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const nome = (body.nome ?? "").trim();
    if (!email || !nome) {
      return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 });
    }

    // Verificar se já existe cliente com este email
    const existing = await adminDb.collection("clientes").where("email", "==", email).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: "Já existe um cliente com este email" }, { status: 400 });
    }

    const now = Timestamp.now();
    const clienteDesde = new Date().toISOString().slice(0, 10);
    const ref = await adminDb.collection("clientes").add({
      email,
      nome,
      telefone: (body.telefone ?? "").trim() || null,
      dataNascimento: (body.dataNascimento ?? "").trim() || null,
      clienteDesde,
      origem: (body.origem ?? "").trim() || null,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await ref.get();
    return NextResponse.json(toCliente(doc));
  } catch (err) {
    console.error("[api/admin/clientes POST]", err);
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 503 });
  }
}
