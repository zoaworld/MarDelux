/**
 * API admin para custos mensais.
 * GET: lista custos do mês (?mes=YYYY-MM)
 * POST: registar ou atualizar custo por categoria e mês
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

function toCusto(doc: FirebaseFirestore.DocumentSnapshot) {
  const x = doc.data();
  return {
    id: doc.id,
    categoriaId: (x?.categoriaId as string) ?? "",
    mes: (x?.mes as string) ?? "",
    valor: (x?.valor as number) ?? 0,
    notas: (x?.notas as string) ?? "",
    updatedAt: (x?.updatedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const mes = request.nextUrl.searchParams.get("mes");
    const mesStr = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);

    const snap = await adminDb
      .collection("custos_mensais")
      .where("mes", "==", mesStr)
      .get();

    const list = snap.docs.map((d) => toCusto(d));
    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/custos/mensais GET]", err);
    return NextResponse.json({ error: "Erro ao carregar custos" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as {
      categoriaId?: string;
      mes?: string;
      valor?: number;
      notas?: string;
    };
    const categoriaId = String(body.categoriaId ?? "").trim();
    const mes = body.mes && /^\d{4}-\d{2}$/.test(body.mes) ? body.mes : new Date().toISOString().slice(0, 7);
    const valor = Number(body.valor) || 0;
    const notas = String(body.notas ?? "").trim();

    if (!categoriaId) {
      return NextResponse.json({ error: "categoriaId obrigatório" }, { status: 400 });
    }

    const existing = await adminDb
      .collection("custos_mensais")
      .where("categoriaId", "==", categoriaId)
      .where("mes", "==", mes)
      .limit(1)
      .get();

    const now = Timestamp.now();
    const data = { categoriaId, mes, valor, notas, updatedAt: now };

    if (existing.empty) {
      const ref = await adminDb.collection("custos_mensais").add(data);
      return NextResponse.json({ id: ref.id, ok: true });
    } else {
      await existing.docs[0].ref.update(data);
      return NextResponse.json({ id: existing.docs[0].id, ok: true });
    }
  } catch (err) {
    console.error("[api/admin/custos/mensais POST]", err);
    return NextResponse.json({ error: "Erro ao guardar custo" }, { status: 503 });
  }
}
