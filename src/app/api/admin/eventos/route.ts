/**
 * API admin para eventos.
 * GET: lista eventos
 * POST: criar evento
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

function toIso(x: unknown): string {
  if (!x) return "";
  if (typeof x === "object" && "toDate" in x && typeof (x as { toDate: () => Date }).toDate === "function") {
    return (x as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof x === "string" ? x : "";
}

function toEvento(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const x = doc.data();
  return {
    id: doc.id,
    modelo: (x?.modelo as string) ?? "externo",
    participacao: (x?.participacao as string) ?? "todos",
    titulo: x?.titulo as string | undefined,
    descricao: x?.descricao as string | undefined,
    dataInicio: toIso(x?.dataInicio),
    dataFim: toIso(x?.dataFim),
    localTipo: (x?.localTipo as string) ?? "mardelux",
    localValor: x?.localValor as string | undefined,
    contactoInfo: x?.contactoInfo as string | undefined,
    imagemUrl: x?.imagemUrl as string | undefined,
    servicosIds: Array.isArray(x?.servicosIds) ? x.servicosIds : [],
    servicosMaxEscolha: typeof x?.servicosMaxEscolha === "number" ? x.servicosMaxEscolha : undefined,
    codigoAtivo: (x?.codigoAtivo as boolean) ?? false,
    codigoPromocionalId: x?.codigoPromocionalId as string | undefined,
    checkoutAtivo: (x?.checkoutAtivo as boolean) ?? false,
    status: (x?.status as string) ?? "rascunho",
    slug: (x?.slug as string) ?? "",
    createdAt: toIso(x?.createdAt),
    updatedAt: toIso(x?.updatedAt),
  };
}

function toTimestamp(v: string | undefined): Timestamp {
  if (!v) return Timestamp.now();
  try {
    return Timestamp.fromDate(new Date(v));
  } catch {
    return Timestamp.now();
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const snap = await adminDb.collection("eventos").orderBy("createdAt", "desc").get();
    const list = snap.docs.map((d) => toEvento(d));
    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/eventos GET]", err);
    return NextResponse.json({ error: "Erro ao carregar eventos" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as {
      modelo?: "interno" | "externo";
      participacao?: "todos" | "users";
      titulo?: string;
      descricao?: string;
      dataInicio: string;
      dataFim: string;
      localTipo?: "mardelux" | "morada" | "link";
      localValor?: string;
      contactoInfo?: string;
      imagemUrl?: string;
      servicosIds?: string[];
      servicosMaxEscolha?: number;
      codigoAtivo?: boolean;
      codigoPromocionalId?: string;
      checkoutAtivo?: boolean;
      status?: "rascunho" | "publicado";
      slug: string;
    };

    const modelo = body.modelo ?? "externo";
    const participacao = body.participacao ?? "todos";
    const titulo = (body.titulo ?? "").trim();
    const slug = (body.slug ?? "").trim();
    if (!slug) {
      return NextResponse.json({ error: "Slug é obrigatório" }, { status: 400 });
    }

    // Verificar slug único
    const existingSlug = await adminDb.collection("eventos").where("slug", "==", slug).limit(1).get();
    if (!existingSlug.empty) {
      return NextResponse.json({ error: "Já existe um evento com este slug" }, { status: 400 });
    }

    const now = Timestamp.now();
    const docData = {
      modelo,
      participacao,
      titulo: titulo || null,
      descricao: (body.descricao ?? "").trim() || null,
      dataInicio: toTimestamp(body.dataInicio),
      dataFim: toTimestamp(body.dataFim),
      localTipo: body.localTipo ?? "mardelux",
      localValor: (body.localValor ?? "").trim() || null,
      contactoInfo: (body.contactoInfo ?? "").trim() || null,
      imagemUrl: (body.imagemUrl ?? "").trim() || null,
      servicosIds: Array.isArray(body.servicosIds) ? body.servicosIds : [],
      servicosMaxEscolha: typeof body.servicosMaxEscolha === "number" ? body.servicosMaxEscolha : 1,
      codigoAtivo: body.codigoAtivo ?? false,
      codigoPromocionalId: body.codigoPromocionalId || null,
      checkoutAtivo: body.checkoutAtivo ?? false,
      status: body.status ?? "rascunho",
      slug,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection("eventos").add(docData);
    const doc = await ref.get();
    return NextResponse.json({ ...toEvento(doc), id: ref.id });
  } catch (err) {
    console.error("[api/admin/eventos POST]", err);
    return NextResponse.json({ error: "Erro ao criar evento" }, { status: 503 });
  }
}
