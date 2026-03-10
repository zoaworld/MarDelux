/**
 * API server-side para marcações do admin.
 * Executa no servidor – Firestore via Admin SDK (muito mais rápido que cliente).
 */

import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { sendConfirmacaoMarcacao } from "@/lib/email";
import { getSlotsDisponiveis } from "@/lib/firebase/marcacoes";
import type { HorarioConfig } from "@/lib/firebase/app-settings";
import { BUFFER_TIME_MINUTES } from "@/lib/constants";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const CACHE = new Map<string, { data: unknown[]; expires: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

export function clearMarcacoesCache() {
  CACHE.clear();
}

function getCached() {
  const entry = CACHE.get("admin");
  if (!entry || Date.now() > entry.expires) return undefined;
  return entry.data;
}

function setCache(data: unknown[]) {
  CACHE.set("admin", { data, expires: Date.now() + CACHE_TTL_MS });
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
        { error: "Firebase Admin não configurado" },
        { status: 503 }
      );
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Acesso reservado ao administrador" }, { status: 403 });
    }

    const cached = nocache ? undefined : getCached();
    if (cached !== undefined) {
      return NextResponse.json(cached);
    }

    const GDPR_DELETED_REGEX = /^deleted-.+@gdpr\.local$/;
    const snapshot = await adminDb.collection("marcacoes").get();
    const rawList = snapshot.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        clienteIdFromDoc: x.clienteId as string | undefined,
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
        preferenciaPagamento: (x.preferenciaPagamento as "na_sessao" | "agora") ?? "na_sessao",
        pagamentoRecebido: (x.pagamentoRecebido as boolean) ?? false,
        metodoPagamento: (x.metodoPagamento as "Dinheiro" | "MB Way" | "Multibanco" | "Cartão" | null) ?? null,
        motivoCancelamento: x.motivoCancelamento as "cliente_cancela" | "falha_tecnica" | "outro" | undefined,
        motivoCancelamentoTexto: x.motivoCancelamentoTexto as string | undefined,
        reagendadoCount: typeof x.reagendadoCount === "number" ? x.reagendadoCount : undefined,
        parceiroId: x.parceiroId as string | undefined,
        parceiroCodigo: x.parceiroCodigo as string | undefined,
        precoOriginal: typeof x.precoOriginal === "number" ? x.precoOriginal : undefined,
        descontoParceiro: typeof x.descontoParceiro === "number" ? x.descontoParceiro : undefined,
        primeiraSessaoIndicacao: x.primeiraSessaoIndicacao as boolean | undefined,
      };
    });

    const uniqueEmails = [...new Set(
      rawList
        .map((item) => ((item.clienteEmail as string) ?? "").trim().toLowerCase())
        .filter((e) => e && !GDPR_DELETED_REGEX.test(e))
    )];
    const emailToClienteId = new Map<string, string>();
    const clienteIdToFicha = new Map<string, { nome: string; indicadoPorParceiroId?: string }>();
    const BATCH_SIZE = 30;
    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      const batch = uniqueEmails.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;
      const q = await adminDb.collection("clientes").where("email", "in", batch).get();
      q.docs.forEach((doc) => {
        const d = doc.data();
        const email = ((d.email as string) ?? "").toLowerCase();
        if (email) emailToClienteId.set(email, doc.id);
        clienteIdToFicha.set(doc.id, {
          nome: (d.nome as string) ?? "",
          indicadoPorParceiroId: d.indicadoPorParceiroId as string | undefined,
        });
      });
    }

    // ClienteIds que vêm no documento da marcação (criadas pelo fluxo com ficha resolvida)
    const uniqueClienteIdsFromDocs = [...new Set(
      rawList
        .map((item) => item.clienteIdFromDoc as string | undefined)
        .filter((id): id is string => Boolean(id))
    )];
    for (const cid of uniqueClienteIdsFromDocs) {
      if (clienteIdToFicha.has(cid)) continue;
      const clientDoc = await adminDb.collection("clientes").doc(cid).get();
      if (clientDoc.exists) {
        const d = clientDoc.data();
        clienteIdToFicha.set(cid, {
          nome: (d?.nome as string) ?? "",
          indicadoPorParceiroId: d?.indicadoPorParceiroId as string | undefined,
        });
      }
    }

    const uniqueParceiroIds = new Set(
      rawList
        .map((item) => item.parceiroId as string | undefined)
        .filter((id): id is string => Boolean(id))
    );
    for (const [, ficha] of clienteIdToFicha) {
      if (ficha.indicadoPorParceiroId) uniqueParceiroIds.add(ficha.indicadoPorParceiroId);
    }
    const parceiroIdToNome = new Map<string, string>();
    for (const pid of uniqueParceiroIds) {
      const doc = await adminDb.collection("parceiros").doc(pid).get();
      const nome = doc.data()?.nome as string | undefined;
      if (nome) parceiroIdToNome.set(pid, nome);
    }

    const list = rawList.map((item) => {
      const email = ((item.clienteEmail as string) ?? "").trim().toLowerCase();
      const parceiroId = item.parceiroId as string | undefined;
      const clienteId = (item.clienteIdFromDoc ?? (email && !GDPR_DELETED_REGEX.test(email) ? emailToClienteId.get(email) : null)) ?? null;
      const ficha = clienteId ? clienteIdToFicha.get(clienteId) : undefined;
      return {
        ...item,
        clienteId,
        clienteNomeFicha: ficha?.nome,
        origemParceiroNome: ficha?.indicadoPorParceiroId ? parceiroIdToNome.get(ficha.indicadoPorParceiroId) : undefined,
        parceiroNome: parceiroId ? parceiroIdToNome.get(parceiroId) : undefined,
      };
    });

    list.sort((a, b) => {
      const cmp = (a.data as string).localeCompare(b.data as string);
      if (cmp !== 0) return cmp;
      return (a.horaInicio as string).localeCompare(b.horaInicio as string);
    });

    const result = list.slice(0, 200);
    setCache(result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/admin/marcacoes]", err);
    const status = err instanceof Error && err.message.includes("auth/") ? 401 : 503;
    return NextResponse.json(
      { error: "Token inválido ou erro do servidor" },
      { status }
    );
  }
}

/** Cria uma marcação (cenário loja / admin) */
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
      clienteNome: string;
      clienteEmail: string;
      clienteTelefone?: string;
      servicoId: string;
      servicoNome: string;
      duracaoMinutos: number;
      preco: number;
      data: string;
      horaInicio: string;
      preferenciaPagamento?: "na_sessao" | "agora";
      parceiroId?: string;
      parceiroCodigo?: string;
      precoOriginal?: number;
      descontoParceiro?: number;
      primeiraSessaoIndicacao?: boolean;
    };

    if (!body.clienteNome?.trim() || !body.clienteEmail?.trim() || !body.servicoId || !body.data || !body.horaInicio) {
      return NextResponse.json(
        { error: "Faltam dados obrigatórios: clienteNome, clienteEmail, servicoId, data, horaInicio" },
        { status: 400 }
      );
    }

    const preferenciaPagamento = body.preferenciaPagamento ?? "na_sessao";

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

    const ocupados = ocupadosSnap.docs.map((doc) => {
      const x = doc.data();
      return {
        horaInicio: (x.horaInicio as string) ?? "",
        horaFim: (x.horaFim as string) ?? "",
      };
    });

    const slots = getSlotsDisponiveis(
      body.data,
      body.duracaoMinutos,
      ocupados,
      horarioConfig ?? undefined
    );

    if (!slots.includes(body.horaInicio)) {
      return NextResponse.json(
        { error: "O horário escolhido não está disponível ou conflitua com outras marcações." },
        { status: 400 }
      );
    }

    const [h, m] = body.horaInicio.split(":").map(Number);
    const endMin = (h ?? 0) * 60 + (m ?? 0) + body.duracaoMinutos;
    const horaFim = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    const docData: Record<string, unknown> = {
      clienteEmail: body.clienteEmail.trim(),
      clienteNome: body.clienteNome.trim(),
      clienteTelefone: body.clienteTelefone?.trim() || null,
      servicoId: body.servicoId,
      servicoNome: body.servicoNome,
      duracaoMinutos: body.duracaoMinutos,
      preco: body.preco,
      data: body.data,
      horaInicio: body.horaInicio,
      horaFim,
      status: "confirmada",
      preferenciaPagamento,
      pagamentoRecebido: false,
      metodoPagamento: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    if (body.parceiroId) docData.parceiroId = body.parceiroId;
    if (body.parceiroCodigo) docData.parceiroCodigo = body.parceiroCodigo;
    if (typeof body.precoOriginal === "number") docData.precoOriginal = body.precoOriginal;
    if (typeof body.descontoParceiro === "number") docData.descontoParceiro = body.descontoParceiro;
    if (body.primeiraSessaoIndicacao === true) docData.primeiraSessaoIndicacao = true;

    const docRef = await adminDb.collection("marcacoes").add(docData);

    clearMarcacoesCache();
    void sendConfirmacaoMarcacao({
      clienteEmail: body.clienteEmail.trim(),
      clienteNome: body.clienteNome.trim(),
      data: body.data,
      horaInicio: body.horaInicio,
      horaFim,
      servicoNome: body.servicoNome,
      preco: body.preco,
    }).catch((e) => console.error("[admin marcacoes] email:", e));

    return NextResponse.json({ id: docRef.id });
  } catch (err) {
    console.error("[api/admin/marcacoes POST]", err);
    return NextResponse.json(
      { error: "Erro ao criar marcação. Tente novamente." },
      { status: 503 }
    );
  }
}
