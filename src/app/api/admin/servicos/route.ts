/**
 * API server-side para CRUD de serviços.
 * Usa Firebase Admin – ignora regras Firestore e evita erros de escrita.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { Servico } from "@/types";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const COLLECTION = "servicos";

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Token em falta", status: 401 as const };

  const adminAuth = getAdminAuth();
  const adminDb = getAdminFirestore();

  if (!adminAuth || !adminDb) {
    return { error: "Firebase Admin não configurado", status: 503 as const };
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const email = (decoded.email ?? "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return { error: "Acesso reservado ao administrador", status: 403 as const };
  }

  return { adminDb };
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    const adminDb = authResult.adminDb;

    const body = (await request.json()) as {
      action: "create" | "update" | "delete";
      id?: string;
      servico?: Partial<Omit<Servico, "id">>;
    };

    if (body.action === "create" && body.servico) {
      const ref = adminDb.collection(COLLECTION).doc();
      await ref.set({
        nome: body.servico.nome ?? "",
        descricao: body.servico.descricao ?? null,
        duracaoMinutos: body.servico.duracaoMinutos ?? 60,
        preco: body.servico.preco ?? 0,
        ativo: body.servico.ativo ?? true,
        ordem: body.servico.ordem ?? 0,
        categoria: body.servico.categoria ?? null,
        imagemUrl: body.servico.imagemUrl ?? null,
        destaque: body.servico.destaque ?? false,
        createdAt: Timestamp.now(),
      });
      return NextResponse.json({ ok: true, id: ref.id });
    }

    if (body.action === "update" && body.id && body.servico) {
      const ref = adminDb.collection(COLLECTION).doc(body.id);
      await ref.update({
        ...body.servico,
        descricao: body.servico.descricao ?? null,
        categoria: body.servico.categoria ?? null,
        imagemUrl: body.servico.imagemUrl ?? null,
        updatedAt: Timestamp.now(),
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete" && body.id) {
      const ref = adminDb.collection(COLLECTION).doc(body.id);
      await ref.update({
        ativo: false,
        updatedAt: Timestamp.now(),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Parâmetros inválidos. Use action: create|update|delete e os campos necessários." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[api/admin/servicos]", err);
    return NextResponse.json(
      { error: "Erro ao guardar serviço. Tente novamente." },
      { status: 503 }
    );
  }
}
