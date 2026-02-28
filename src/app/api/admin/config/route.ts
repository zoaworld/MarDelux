/**
 * API server-side para guardar configurações (horário e site).
 * Usa Firebase Admin – ignora regras Firestore e evita erros de escrita.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import type { HorarioConfig, SiteConfig } from "@/lib/firebase/app-settings";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const CONFIG_COLLECTION = "config";
const HORARIO_DOC_ID = "horario";
const SITE_DOC_ID = "site";

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
      type?: "horario" | "site";
      bufferMinutes?: number;
      diasSemana?: HorarioConfig["diasSemana"];
      feriados?: HorarioConfig["feriados"];
      startHour?: number;
      endHour?: number;
      nomeEmpresa?: string;
      email?: string;
      telefone?: string;
    };

    if (body.type === "horario") {
      const rawDias = (body.diasSemana ?? []) as Array<{ diaSemana?: number; abre?: string; fecha?: string; fechado?: boolean }>;
      // Garantir 7 dias com fechado explícito (Firestore não grava undefined)
      const diasSemana = [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => {
        const d = rawDias.find((x) => Number(x.diaSemana) === diaSemana);
        return {
          diaSemana,
          abre: typeof d?.abre === "string" ? d.abre : "09:00",
          fecha: typeof d?.fecha === "string" ? d.fecha : "18:00",
          fechado: Boolean(d?.fechado),
        };
      });
      const ref = adminDb.collection(CONFIG_COLLECTION).doc(HORARIO_DOC_ID);
      await ref.set({
        startHour: body.startHour ?? 9,
        endHour: body.endHour ?? 18,
        bufferMinutes: body.bufferMinutes ?? 15,
        diasSemana,
        feriados: body.feriados ?? [],
      });
      return NextResponse.json({ ok: true });
    }

    if (body.type === "site") {
      const ref = adminDb.collection(CONFIG_COLLECTION).doc(SITE_DOC_ID);
      await ref.set({
        nomeEmpresa: body.nomeEmpresa ?? "",
        email: body.email ?? "",
        telefone: body.telefone ?? "",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Especifica type: 'horario' ou 'site'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[api/admin/config]", err);
    return NextResponse.json(
      { error: "Erro ao guardar. Tente novamente." },
      { status: 503 }
    );
  }
}
