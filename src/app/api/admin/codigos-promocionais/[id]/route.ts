/**
 * API admin para um código promocional específico.
 * PATCH: atualizar código
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
      "codigo", "descontoPercentagem", "tipoAplicacao", "eventoId",
      "validadeInicio", "validadeFim", "usosMaximos", "ativo",
    ] as const;

    const update: Record<string, unknown> = { updatedAt: Timestamp.now() };
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === "validadeInicio" || k === "validadeFim") {
          const ts = body[k] ? toTimestamp(body[k] as string) : null;
          update[k] = ts;
        } else {
          update[k] = body[k];
        }
      }
    }

    if (body.codigo !== undefined) {
      const codigo = String(body.codigo).trim().toUpperCase();
      if (!codigo) return NextResponse.json({ error: "Código não pode ser vazio" }, { status: 400 });
      const existing = await adminDb.collection("codigos_promocionais").where("codigo", "==", codigo).get();
      const other = existing.docs.find((d) => d.id !== id);
      if (other) return NextResponse.json({ error: "Já existe outro código com este valor" }, { status: 400 });
      update.codigo = codigo;
    }

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    await adminDb.collection("codigos_promocionais").doc(id).update(update);
    const doc = await adminDb.collection("codigos_promocionais").doc(id).get();
    return NextResponse.json(toCodigo(doc));
  } catch (err) {
    console.error("[api/admin/codigos-promocionais/[id] PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar código" }, { status: 503 });
  }
}
