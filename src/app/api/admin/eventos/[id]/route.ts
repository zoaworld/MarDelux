/**
 * API admin para um evento específico.
 * GET: obter evento
 * PATCH: atualizar evento
 * DELETE: eliminar evento
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

function toTimestamp(v: string | undefined): Timestamp | null {
  if (!v) return null;
  try {
    return Timestamp.fromDate(new Date(v));
  } catch {
    return null;
  }
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

    const doc = await adminDb.collection("eventos").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }
    return NextResponse.json(toEvento(doc));
  } catch (err) {
    console.error("[api/admin/eventos/[id] GET]", err);
    return NextResponse.json({ error: "Erro ao carregar evento" }, { status: 503 });
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
    const allowed = [
      "modelo", "participacao", "titulo", "descricao", "dataInicio", "dataFim",
      "localTipo", "localValor", "contactoInfo", "imagemUrl", "servicosIds",
      "servicosMaxEscolha", "codigoAtivo", "codigoPromocionalId", "checkoutAtivo", "status", "slug",
    ] as const;

    const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === "dataInicio" || k === "dataFim") {
          const ts = toTimestamp(body[k] as string);
          if (ts) update[k] = ts;
        } else {
          update[k] = body[k];
        }
      }
    }

    if (body.slug !== undefined) {
      const slug = String(body.slug).trim();
      if (!slug) return NextResponse.json({ error: "Slug não pode ser vazio" }, { status: 400 });
      const existing = await adminDb.collection("eventos").where("slug", "==", slug).get();
      const other = existing.docs.find((d) => d.id !== id);
      if (other) return NextResponse.json({ error: "Já existe outro evento com este slug" }, { status: 400 });
      update.slug = slug;
    }

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    await adminDb.collection("eventos").doc(id).update(update);
    const doc = await adminDb.collection("eventos").doc(id).get();
    return NextResponse.json(toEvento(doc));
  } catch (err) {
    console.error("[api/admin/eventos/[id] PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar evento" }, { status: 503 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAdmin(_request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;
    const { id } = await params;

    const doc = await adminDb.collection("eventos").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    }

    await adminDb.collection("eventos").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/eventos/[id] DELETE]", err);
    return NextResponse.json({ error: "Erro ao eliminar evento" }, { status: 503 });
  }
}
