/**
 * API admin para parceiros.
 * GET: lista parceiros
 * POST: criar parceiro
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function generateCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "MARD-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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

function toParceiro(doc: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  const x = doc.data();
  return {
    id: doc.id,
    codigo: (x?.codigo as string) ?? "",
    nome: (x?.nome as string) ?? "",
    tipo: (x?.tipo as "essencial" | "premium") ?? "essencial",
    email: (x?.email as string) ?? "",
    telefone: x?.telefone as string | undefined,
    estabelecimento: x?.estabelecimento as string | undefined,
    notas: x?.notas as string | undefined,
    sessaoGratuitaUtilizada: (x?.sessaoGratuitaUtilizada as boolean) ?? false,
    ativo: (x?.ativo as boolean) ?? true,
    eliminado: (x?.eliminado as boolean) ?? false,
    motivoEliminacao: x?.motivoEliminacao as string | undefined,
    createdAt: (x?.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: (x?.updatedAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
  };
}

async function getTotalReferencias(
  adminDb: FirebaseFirestore.Firestore,
  parceiroIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of parceiroIds) {
    const snap = await adminDb
      .collection("clientes")
      .where("indicadoPorParceiroId", "==", id)
      .get();
    map.set(id, snap.size);
  }
  return map;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const tipo = request.nextUrl.searchParams.get("tipo");
    const ativo = request.nextUrl.searchParams.get("ativo");
    const estado = request.nextUrl.searchParams.get("estado");

    let q = adminDb.collection("parceiros").orderBy("nome", "asc");
    const snap = await q.get();

    let list = snap.docs.map((d) => toParceiro(d));
    if (tipo === "essencial" || tipo === "premium") {
      list = list.filter((p) => p.tipo === tipo);
    }
    const filtro = estado ?? (ativo === "false" ? "inativos" : ativo === "true" ? "ativos" : "ativos");
    if (filtro === "ativos") {
      list = list.filter((p) => p.ativo === true && p.eliminado !== true);
    } else if (filtro === "inativos") {
      list = list.filter((p) => p.ativo === false && p.eliminado !== true);
    } else if (filtro === "eliminados") {
      list = list.filter((p) => p.eliminado === true);
    }

    const parceiroIds = list.map((p) => p.id as string);
    const referenciasMap = await getTotalReferencias(adminDb, parceiroIds);
    const listWithRefs = list.map((p) => ({
      ...p,
      totalReferencias: referenciasMap.get(p.id as string) ?? 0,
    }));

    return NextResponse.json(listWithRefs);
  } catch (err) {
    console.error("[api/admin/parceiros GET]", err);
    return NextResponse.json({ error: "Erro ao carregar parceiros" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as {
      codigo?: string;
      nome: string;
      tipo?: "essencial" | "premium";
      email: string;
      telefone?: string;
      estabelecimento?: string;
      notas?: string;
      ativo?: boolean;
    };

    const nome = (body.nome ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    if (!nome || !email) {
      return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 400 });
    }

    let codigo = (body.codigo ?? "").trim().toUpperCase();
    if (!codigo) {
      for (let attempt = 0; attempt < 10; attempt++) {
        codigo = generateCodigo();
        const existing = await adminDb.collection("parceiros").where("codigo", "==", codigo).limit(1).get();
        if (existing.empty) break;
      }
    }
    if (!codigo) {
      return NextResponse.json({ error: "Não foi possível gerar um código único" }, { status: 500 });
    }

    const existing = await adminDb.collection("parceiros").where("codigo", "==", codigo).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: "Já existe um parceiro com este código" }, { status: 400 });
    }

    const now = Timestamp.now();
    const ref = await adminDb.collection("parceiros").add({
      codigo,
      nome,
      tipo: body.tipo === "premium" ? "premium" : "essencial",
      email,
      telefone: (body.telefone ?? "").trim() || null,
      estabelecimento: (body.estabelecimento ?? "").trim() || null,
      notas: (body.notas ?? "").trim() || null,
      sessaoGratuitaUtilizada: false,
      ativo: body.ativo !== false,
      createdAt: now,
      updatedAt: now,
    });

    const doc = await ref.get();
    return NextResponse.json(toParceiro(doc));
  } catch (err) {
    console.error("[api/admin/parceiros POST]", err);
    return NextResponse.json({ error: "Erro ao criar parceiro" }, { status: 503 });
  }
}
