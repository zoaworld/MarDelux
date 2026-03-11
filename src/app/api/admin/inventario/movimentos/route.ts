/**
 * API admin para movimentos de inventário.
 * GET: lista movimentos (filtro itemId)
 * POST: registar entrada ou saída (atualiza quantidade do item)
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

function toMovimento(doc: FirebaseFirestore.DocumentSnapshot) {
  const x = doc.data();
  return {
    id: doc.id,
    itemId: (x?.itemId as string) ?? "",
    tipo: (x?.tipo as "entrada" | "saida") ?? "entrada",
    quantidade: (x?.quantidade as number) ?? 0,
    motivo: (x?.motivo as string) ?? "",
    data: (x?.data as string) ?? "",
    referencia: (x?.referencia as string) ?? "",
    createdAt: (x?.createdAt as Timestamp)?.toDate?.()?.toISOString?.() ?? "",
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const itemId = request.nextUrl.searchParams.get("itemId");
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 500);

    let q = adminDb
      .collection("movimentos_inventario")
      .orderBy("createdAt", "desc")
      .limit(limit);
    if (itemId) {
      q = q.where("itemId", "==", itemId) as FirebaseFirestore.Query;
    }
    const snap = await q.get();

    const list = snap.docs.map((d) => toMovimento(d));
    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/admin/inventario/movimentos GET]", err);
    return NextResponse.json({ error: "Erro ao carregar movimentos" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { adminDb } = auth;

    const body = (await request.json()) as {
      itemId?: string;
      tipo?: "entrada" | "saida";
      quantidade?: number;
      motivo?: string;
      data?: string;
      referencia?: string;
    };
    const itemId = String(body.itemId ?? "").trim();
    const tipo = body.tipo === "saida" ? "saida" : "entrada";
    const quantidade = Number(body.quantidade) || 0;

    if (!itemId || quantidade <= 0) {
      return NextResponse.json({ error: "itemId e quantidade positiva obrigatórios" }, { status: 400 });
    }

    const dataStr = (body.data ?? new Date().toISOString().slice(0, 10)) as string;
    const motivo = String(body.motivo ?? "").trim();
    const referencia = String(body.referencia ?? "").trim();

    const itemRef = adminDb.collection("itens_inventario").doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    const itemData = itemSnap.data();
    const quantidadeAtual = (itemData?.quantidadeAtual as number) ?? 0;

    let novaQuantidade: number;
    if (tipo === "entrada") {
      novaQuantidade = quantidadeAtual + quantidade;
    } else {
      if (quantidadeAtual < quantidade) {
        return NextResponse.json(
          { error: `Stock insuficiente. Atual: ${quantidadeAtual}` },
          { status: 400 }
        );
      }
      novaQuantidade = quantidadeAtual - quantidade;
    }

    const batch = adminDb.batch();

    const movRef = adminDb.collection("movimentos_inventario").doc();
    batch.set(movRef, {
      itemId,
      tipo,
      quantidade,
      motivo,
      data: dataStr,
      referencia,
      createdAt: Timestamp.now(),
    });

    batch.update(itemRef, {
      quantidadeAtual: novaQuantidade,
      updatedAt: Timestamp.now(),
    });

    await batch.commit();

    return NextResponse.json({ id: movRef.id, ok: true });
  } catch (err) {
    console.error("[api/admin/inventario/movimentos POST]", err);
    return NextResponse.json({ error: "Erro ao registar movimento" }, { status: 503 });
  }
}
