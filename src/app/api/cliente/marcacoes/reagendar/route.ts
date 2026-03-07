/**
 * Reagendar marcação (cliente) – com 24h de antecedência.
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { getSlotsDisponiveis } from "@/lib/firebase/marcacoes";
import type { HorarioConfig } from "@/lib/firebase/app-settings";
import { BUFFER_TIME_MINUTES } from "@/lib/constants";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Serviço indisponível" },
        { status: 503 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const clientEmail = (decoded.email ?? "").trim().toLowerCase();
    if (!clientEmail) {
      return NextResponse.json({ error: "Email não encontrado" }, { status: 401 });
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
    const marcacaoEmail = (m.clienteEmailLower as string) ?? normalizeEmail((m.clienteEmail as string) ?? "");

    if (marcacaoEmail !== clientEmail) {
      return NextResponse.json({ error: "Esta marcação não lhe pertence" }, { status: 403 });
    }

    const status = m.status as string;
    if (status !== "pendente" && status !== "confirmada") {
      return NextResponse.json(
        { error: "Só pode reagendar marcações pendentes ou confirmadas" },
        { status: 400 }
      );
    }

    // Verificar 24h de antecedência: nova data+hora deve ser pelo menos 24h no futuro
    const novaDataHora = new Date(`${body.data}T${body.horaInicio}:00`);
    const agora = new Date();
    const diffMs = novaDataHora.getTime() - agora.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) {
      return NextResponse.json(
        { error: "Reagendamento requer pelo menos 24 horas de antecedência" },
        { status: 400 }
      );
    }

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
    console.error("[cliente/marcacoes/reagendar]", err);
    return NextResponse.json(
      { error: "Erro ao reagendar" },
      { status: 503 }
    );
  }
}
