/**
 * API server-side para marcações do admin.
 * Executa no servidor – Firestore via Admin SDK (muito mais rápido que cliente).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const CACHE = new Map<string, { data: unknown[]; expires: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

function getCached() {
  const entry = CACHE.get("admin");
  if (!entry || Date.now() > entry.expires) return undefined;
  return entry.data;
}

function setCache(data: unknown[]) {
  CACHE.set("admin", { data, expires: Date.now() + CACHE_TTL_MS });
}

export async function GET(request: NextRequest) {
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
      { error: "Firebase Admin não configurado" },
      { status: 503 }
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Acesso reservado ao administrador" }, { status: 403 });
    }

    const cached = nocache ? undefined : getCached();
    if (cached !== undefined) {
      return NextResponse.json(cached);
    }

    const snapshot = await adminDb.collection("marcacoes").get();
    const list = snapshot.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        clienteEmail: (x.clienteEmail as string) ?? "",
        clienteNome: (x.clienteNome as string) ?? "",
        clienteTelefone: x.clienteTelefone as string | undefined,
        servicoId: (x.servicoId as string) ?? "",
        servicoNome: (x.servicoNome as string) ?? "",
        duracaoMinutos: (x.duracaoMinutos as number) ?? 0,
        preco: (x.preco as number) ?? 0,
        data: (x.data as string) ?? "",
        horaInicio: (x.horaInicio as string) ?? "",
        horaFim: (x.horaFim as string) ?? "",
        status: (x.status as string) ?? "pendente",
        notasSessao: x.notasSessao as string | undefined,
      };
    });

    list.sort((a, b) => {
      const cmp = (b.data as string).localeCompare(a.data as string);
      if (cmp !== 0) return cmp;
      return (b.horaInicio as string).localeCompare(a.horaInicio as string);
    });

    const result = list.slice(0, 200);
    setCache(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/admin/marcacoes]", err);
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 401 }
    );
  }
}
