/**
 * API server-side para marcações do cliente.
 * Executa no servidor (Vercel/serverless) – conexão Firestore é muito mais rápida
 * que browser→Firestore. Inclui cache em memória (TTL 2 min por email).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

const CACHE = new Map<string, { data: unknown[]; expires: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

function getCached(email: string) {
  const entry = CACHE.get(email);
  if (!entry || Date.now() > entry.expires) return undefined;
  return entry.data;
}

function setCache(email: string, data: unknown[]) {
  CACHE.set(email, { data, expires: Date.now() + CACHE_TTL_MS });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const nocache = request.nextUrl.searchParams.get("nocache") === "1";

    if (!token) {
      return NextResponse.json({ error: "Token em falta" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Servidor não configurado (Firebase Admin)" },
        { status: 503 }
      );
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email;
    if (!email) {
      return NextResponse.json({ error: "Email não encontrado" }, { status: 401 });
    }

    const cached = nocache ? undefined : getCached(email);
    if (cached !== undefined) {
      return NextResponse.json(cached);
    }

    const marcacoesRef = adminDb.collection("marcacoes");
    const snapshot = await marcacoesRef
      .where("clienteEmail", "==", email)
      .where("status", "in", ["pendente", "confirmada", "concluida"])
      .get();

    const list = snapshot.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        servicoNome: x.servicoNome,
        data: x.data,
        horaInicio: x.horaInicio,
        horaFim: x.horaFim,
        status: x.status,
        duracaoMinutos: x.duracaoMinutos,
        preco: x.preco,
      };
    });

    list.sort(
      (a, b) =>
        (a.data as string).localeCompare(b.data as string) ||
        (a.horaInicio as string).localeCompare(b.horaInicio as string)
    );

    setCache(email, list);
    return NextResponse.json(list);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/cliente/marcacoes]", err);
    return NextResponse.json(
      {
        error: "Token inválido ou erro do servidor",
        ...(process.env.NODE_ENV === "development" && { debug: msg }),
      },
      { status: 503 }
    );
  }
}
