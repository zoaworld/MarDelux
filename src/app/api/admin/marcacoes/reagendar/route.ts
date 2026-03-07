/**
 * Reagendar marcação (admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { getSlotsDisponiveis } from "@/lib/firebase/marcacoes";
import type { HorarioConfig } from "@/lib/firebase/app-settings";
import { BUFFER_TIME_MINUTES } from "@/lib/constants";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
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

    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Acesso reservado ao administrador" }, { status: 403 });
    }

    const body = (await request.json()) as {
      id: string;
      data: string;
      horaInicio: string;
    };

    if (!body.id || !body.data || !body.horaInicio) {
      return NextResponse.json(
        { error: "Faltam id, data ou horaInicio" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("marcacoes").doc(body.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Marcação não encontrada" }, { status: 404 });
    }

    const m = docSnap.data()!;
    const duracaoMinutos = (m.duracaoMinutos as number) ?? 60;

    // Config horário
    const configSnap = await adminDb.collection("config").doc("horario").get();
    let horarioConfig: HorarioConfig | undefined;
    if (configSnap.exists) {
      const d = configSnap.data();
      const rawDias = (d?.diasSemana ?? []) as Array<{ diaSemana?: number; abre?: string; fecha?: string; fechado?: boolean }>;
      const diasSemana = [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => {
        const x = rawDias.find((item) => Number(item.diaSemana) === diaSemana);
        return {
          diaSemana,
          abre: typeof x?.abre === "string" ? x.abre : "09:00",
          fecha: typeof x?.fecha === "string" ? x.fecha : "18:00",
          fechado: Boolean(x?.fechado),
        };
      });
      horarioConfig = {
        startHour: typeof d?.startHour === "number" ? d.startHour : 9,
        endHour: typeof d?.endHour === "number" ? d.endHour : 18,
        bufferMinutes: typeof d?.bufferMinutes === "number" ? d.bufferMinutes : BUFFER_TIME_MINUTES,
        diasSemana,
        feriados: Array.isArray(d?.feriados) ? d.feriados : [],
      };
    }

    // Ocupados nesse dia (excluindo esta marcação)
    const ocupadosSnap = await adminDb
      .collection("marcacoes")
      .where("data", "==", body.data)
      .where("status", "in", ["pendente", "confirmada"])
      .get();

    const ocupados = ocupadosSnap.docs
      .filter((d) => d.id !== body.id)
      .map((doc) => {
        const x = doc.data();
        return {
          horaInicio: (x.horaInicio as string) ?? "",
          horaFim: (x.horaFim as string) ?? "",
        };
      });

    const slots = getSlotsDisponiveis(body.data, duracaoMinutos, ocupados, horarioConfig ?? undefined);

    if (!slots.includes(body.horaInicio)) {
      return NextResponse.json(
        { error: "O horário escolhido não está disponível." },
        { status: 400 }
      );
    }

    const [h, mh] = body.horaInicio.split(":").map(Number);
    const endMin = (h ?? 0) * 60 + (mh ?? 0) + duracaoMinutos;
    const horaFim = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    await docRef.update({
      data: body.data,
      horaInicio: body.horaInicio,
      horaFim,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/marcacoes/reagendar]", err);
    return NextResponse.json(
      { error: "Erro ao reagendar" },
      { status: 503 }
    );
  }
}
