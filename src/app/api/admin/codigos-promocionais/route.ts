/**
 * API admin para códigos promocionais.
 * GET: lista códigos (opcional: ?eventoId=X)
 * POST: criar código
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

function toCodigo(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const x = doc.data();
  return {
    id: doc.id,
    codigo: (x?.codigo as string) ?? "",
    descontoPercentagem: (x?.descontoPercentagem as number) ?? 0,
    tipoAplicacao: (x?.tipoAplicacao as string) ?? "evento",
    eventoId: x?.eventoId as string | undefined,
    validadeInicio: x?.validadeInicio ? toIso(x.validadeInicio) : undefined,
    validadeFim: x?.validadeFim ? toIso(x.validadeFim) : undefined,
    usosMaximos: typeof x?.usosMaximos === "number" ? x.usosMaximos : undefined,
    usosAtuais: (x?.usosAtuais as number) ?? 0,
    ativo: (x?.ativo as boolean) ?? true,
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

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const eventoId = request.nextUrl.searchParams.get("eventoId");
    const coll = adminDb.collection("codigos_promocionais");
    const snap = eventoId
      ? await coll.where("eventoId", "==", eventoId).get()
      : await coll.get();
    const list = snap.docs.map((d) => toCodigo(d));
    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/codigos-promocionais GET]", err);
    return NextResponse.json({ error: "Erro ao carregar códigos" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as {
      codigo: string;
      descontoPercentagem: number;
      tipoAplicacao: "site" | "evento";
      eventoId?: string;
      validadeInicio?: string;
      validadeFim?: string;
      usosMaximos?: number;
      ativo?: boolean;
    };

    const codigo = (body.codigo ?? "").trim().toUpperCase();
    if (!codigo) return NextResponse.json({ error: "Código é obrigatório" }, { status: 400 });
    const desconto = typeof body.descontoPercentagem === "number" ? body.descontoPercentagem : 0;
    const tipoAplicacao = body.tipoAplicacao === "site" ? "site" : "evento";

    const existing = await adminDb.collection("codigos_promocionais").where("codigo", "==", codigo).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: "Já existe um código com este valor" }, { status: 400 });
    }

    const now = Timestamp.now();
    const docData: Record<string, unknown> = {
      codigo,
      descontoPercentagem: desconto,
      tipoAplicacao,
      eventoId: body.eventoId || null,
      validadeInicio: body.validadeInicio ? toTimestamp(body.validadeInicio) : null,
      validadeFim: body.validadeFim ? toTimestamp(body.validadeFim) : null,
      usosMaximos: typeof body.usosMaximos === "number" ? body.usosMaximos : null,
      usosAtuais: 0,
      ativo: body.ativo !== false,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb.collection("codigos_promocionais").add(docData);
    const doc = await ref.get();
    return NextResponse.json({ ...toCodigo(doc), id: ref.id });
  } catch (err) {
    console.error("[api/admin/codigos-promocionais POST]", err);
    return NextResponse.json({ error: "Erro ao criar código" }, { status: 503 });
  }
}
