"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  getServicos,
  getMarcacoesByDate,
  getSlotsDisponiveis,
  createMarcacao,
  getHorarioConfig,
} from "@/lib/firebase";
import { DEFAULT_SERVICOS } from "@/lib/default-servicos";
import type { Servico } from "@/types";
import type { HorarioConfig } from "@/lib/firebase";

const STEPS = ["Serviço", "Data e hora", "Confirmação"] as const;

type PeriodoHora = "manha" | "tarde" | "fimTarde";

/** Manhã: abertura → 13:00 | Tarde: 13:00 → 17:00 | Fim da Tarde: 17:00 → fecho */
const PERIODOS: { id: PeriodoHora; label: string; minInicio: number; minFim: number }[] = [
  { id: "manha", label: "Manhã", minInicio: 0, minFim: 13 * 60 },        // até 13:00 (exclusive)
  { id: "tarde", label: "Tarde", minInicio: 13 * 60, minFim: 17 * 60 },  // 13:00 até 17:00 (exclusive)
  { id: "fimTarde", label: "Fim da Tarde", minInicio: 17 * 60, minFim: 24 * 60 }, // 17:00 até fecho
];

function filterSlotsByPeriodo(slots: string[], periodo: PeriodoHora): string[] {
  const p = PERIODOS.find((x) => x.id === periodo);
  if (!p) return slots;
  return slots.filter((h) => {
    const m = horaToMinutes(h);
    return m >= p.minInicio && m < p.minFim;
  });
}

function formatDate(str: string): string {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function horaToMinutes(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

/** Calendário mensal para seleção de data */
function Calendario({
  selectedData,
  onSelect,
  minDate,
}: {
  selectedData: string | null;
  onSelect: (date: string) => void;
  minDate: string;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);

  const monthLabel = viewDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date().toISOString().slice(0, 10);
  const minTime = new Date(minDate + "T00:00:00").getTime();

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(prevMonth)}
          className="rounded-lg p-2 text-[var(--gray-dark)] hover:bg-[var(--gray-light)]"
          aria-label="Mês anterior"
        >
          ←
        </button>
        <span className="font-semibold capitalize text-[var(--foreground)]">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewDate(nextMonth)}
          className="rounded-lg p-2 text-[var(--gray-dark)] hover:bg-[var(--gray-light)]"
          aria-label="Mês seguinte"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekdays.map((w) => (
          <div key={w} className="py-1 font-medium text-[var(--gray-mid)]">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const cellDate = new Date(year, month, d);
          const cellTime = cellDate.getTime();
          const isPast = cellTime < minTime;
          const isSelected = selectedData === dateStr;
          const isToday = dateStr === today;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && onSelect(dateStr)}
              className={`aspect-square rounded-lg py-1 text-sm transition ${
                isPast
                  ? "cursor-not-allowed text-[var(--gray-mid)]/50"
                  : isSelected
                    ? "bg-[var(--rose-gold)] text-white"
                    : isToday
                      ? "bg-[var(--rose-gold-light)] font-semibold text-[var(--rose-gold)]"
                      : "text-[var(--foreground)] hover:bg-[var(--gray-light)]"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Converte hora início + duração em hora fim (HH:mm) */
function horaFim(horaInicio: string, duracaoMinutos: number): string {
  const [h, m] = horaInicio.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + duracaoMinutos;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function AgendarFlow() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedData, setSelectedData] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedHora, setSelectedHora] = useState<string | null>(null);
  const [periodoHora, setPeriodoHora] = useState<PeriodoHora>("manha");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "" });

  // Preencher email automaticamente quando o utilizador está logado
  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email ?? "" }));
    }
  }, [user?.email, form.email]);
  const [preferenciaPagamento, setPreferenciaPagamento] = useState<"na_sessao" | "agora">("na_sessao");
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [horarioConfig, setHorarioConfig] = useState<HorarioConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHorarioConfig(), getServicos()])
      .then(([config, list]) => {
        if (cancelled) return;
        setHorarioConfig(config);
        if (list.length > 0) setServicos(list);
        else setServicos(DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` })));
      })
      .catch(() => {
        if (!cancelled) setServicos(DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` })));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (step !== 2 || !selectedData || !selectedServico) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedHora(null);
    setPeriodoHora("manha");
    getMarcacoesByDate(selectedData)
      .then((ocupados) => {
        const config = horarioConfig ?? undefined;
        const disp = getSlotsDisponiveis(selectedData, selectedServico.duracaoMinutos, ocupados, config);
        setSlots(disp);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [step, selectedData, selectedServico, horarioConfig]);

  const handleConfirmar = async () => {
    if (!selectedServico || !selectedData || !selectedHora) return;
    if (!form.nome.trim() || !form.email.trim()) {
      setError("Por favor preencha nome e email.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const id = await createMarcacao({
        clienteNome: form.nome.trim(),
        clienteEmail: form.email.trim(),
        clienteTelefone: form.telefone.trim() || undefined,
        servicoId: selectedServico.id,
        servicoNome: selectedServico.nome,
        duracaoMinutos: selectedServico.duracaoMinutos,
        preco: selectedServico.preco,
        data: selectedData,
        horaInicio: selectedHora,
        preferenciaPagamento,
      });
      setCreatedId(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível guardar a marcação. Tente novamente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const mbWayPhone = process.env.NEXT_PUBLIC_MBWAY_PHONE ?? "";

  if (createdId && selectedServico) {
    return (
      <div className="card-elevated mx-auto max-w-lg p-8 text-center">
        <div className="text-5xl text-[var(--rose-gold)]">✓</div>
        <h2 className="font-display mt-4 text-xl font-semibold text-[var(--foreground)]">
          Marcação efetuada
        </h2>
        <p className="mt-2 text-[var(--gray-dark)]">
          A sua sessão foi registada. Enviaremos um email de confirmação para{" "}
          <strong>{form.email}</strong>.
        </p>
        {preferenciaPagamento === "agora" && (
          <div className="mt-6 rounded-xl border-2 border-[var(--rose-gold-light)] bg-[var(--rose-gold-light)]/30 p-5 text-left">
            <h3 className="font-display font-semibold text-[var(--foreground)]">
              Pagamento por MB Way
            </h3>
            <p className="mt-2 text-sm text-[var(--gray-dark)]">
              Envie <strong>{selectedServico.preco} €</strong>
              {mbWayPhone ? (
                <> para o número <strong>{mbWayPhone}</strong> (MarDelux).</>
              ) : (
                <> — entre em contacto connosco para obter o número de pagamento.</>
              )}
            </p>
            <p className="mt-1 text-sm text-[var(--gray-dark)]">
              Após o envio, iremos confirmar a sua marcação brevemente.
            </p>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/cliente?fresh=1" className="btn-primary">
            Ver as minhas marcações
          </Link>
          <Link href="/" className="btn-secondary">
            Voltar ao início
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreatedId(null);
              setStep(1);
              setSelectedServico(null);
              setSelectedData(null);
              setSelectedHora(null);
              setForm({ nome: "", email: "", telefone: "" });
              setPreferenciaPagamento("na_sessao");
            }}
            className="btn-secondary"
          >
            Nova marcação
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const bufferMin = horarioConfig?.bufferMinutes ?? 15;
  const slotsFiltrados = selectedData && slots.length > 0 ? filterSlotsByPeriodo(slots, periodoHora) : [];

  return (
    <div className="mx-auto max-w-2xl">
      {/* Indicador de passos */}
      <div className="mb-8 flex justify-between gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-center text-sm font-medium transition ${
              i + 1 === step
                ? "bg-[var(--rose-gold)] text-white shadow-md"
                : i + 1 < step
                  ? "bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                  : "bg-[var(--gray-light)] text-[var(--gray-mid)]"
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              {i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* Passo 1: Serviço */}
      {step === 1 && (
        <div className="card-elevated overflow-hidden p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Escolha o serviço
          </h2>
          <p className="mt-1 text-sm text-[var(--gray-dark)]">
            Selecione o tipo de sessão e duração.
          </p>
          {loading ? (
            <p className="mt-6 text-[var(--gray-mid)]">A carregar serviços...</p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-1">
              {servicos.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServico(s);
                      setStep(2);
                    }}
                    className={`flex w-full flex-col rounded-xl border-2 p-4 text-left transition-all ${
                      selectedServico?.id === s.id
                        ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)] shadow-sm"
                        : "border-[var(--gray-light)] hover:border-[var(--rose-gold)]/40 hover:bg-[var(--gray-light)]/80"
                    }`}
                  >
                    <span className="font-semibold text-[var(--foreground)]">{s.nome}</span>
                    {s.descricao && (
                      <p className="mt-1 text-sm text-[var(--gray-dark)]">{s.descricao}</p>
                    )}
                    <p className="mt-2 text-sm font-medium text-[var(--rose-gold)]">
                      {s.duracaoMinutos} min · {s.preco} €
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Passo 2: Data e hora + timeline */}
      {step === 2 && selectedServico && (
        <div className="card-elevated overflow-hidden p-6 md:p-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-4 text-sm font-medium text-[var(--rose-gold)] hover:underline"
          >
            ← Alterar serviço
          </button>
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Data e hora
          </h2>
          <p className="mt-1 text-sm text-[var(--gray-dark)]">
            {selectedServico.nome} · {selectedServico.duracaoMinutos} min. Intervalo de {bufferMin} min entre sessões para preparação.
          </p>

          <p className="mt-6 text-sm font-semibold text-[var(--foreground)]">Data</p>
          <div className="mt-2">
            <Calendario
              selectedData={selectedData}
              onSelect={setSelectedData}
              minDate={today}
            />
          </div>

          {selectedData && (
            <>
              <p className="mt-6 text-sm font-semibold text-[var(--foreground)]">Hora de início</p>
              {loadingSlots ? (
                <p className="mt-2 text-sm text-[var(--gray-dark)]">A carregar horários...</p>
              ) : slots.length === 0 ? (
                <p className="mt-2 rounded-lg bg-[var(--gray-light)] p-4 text-sm text-[var(--gray-dark)]">
                  Sem horários disponíveis neste dia. Escolha outra data.
                </p>
              ) : (
                <>
                  <div className="mt-2 flex gap-2">
                    {PERIODOS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPeriodoHora(p.id);
                          setSelectedHora(null);
                        }}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                          periodoHora === p.id
                            ? "bg-[var(--rose-gold)] text-white"
                            : "bg-[var(--gray-light)] text-[var(--foreground)] hover:bg-[var(--gray-mid)]/10"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {slotsFiltrados.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--gray-dark)]">
                      Nenhum horário disponível neste período. Tente outro período ou outra data.
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slotsFiltrados.map((h) => {
                        const fim = horaFim(h, selectedServico.duracaoMinutos);
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setSelectedHora(h)}
                            className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition ${
                              selectedHora === h
                                ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                                : "border-[var(--gray-light)] text-[var(--foreground)] hover:border-[var(--rose-gold)]/50"
                            }`}
                          >
                            <span className="block">{h}</span>
                            <span className="block text-xs opacity-80">– {fim}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {selectedData && selectedHora && (
                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-primary"
                  >
                    Continuar para confirmação
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Passo 3: Confirmação */}
      {step === 3 && selectedServico && selectedData && selectedHora && (
        <div className="card-elevated overflow-hidden p-6 md:p-8">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mb-4 text-sm font-medium text-[var(--rose-gold)] hover:underline"
          >
            ← Alterar data/hora
          </button>
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">Confirmação</h2>
          <div className="mt-4 rounded-xl border-2 border-[var(--rose-gold-light)] bg-[var(--rose-gold-light)]/50 p-5">
            <p className="font-semibold text-[var(--foreground)]">{selectedServico.nome}</p>
            <p className="mt-1 text-sm text-[var(--gray-dark)]">
              {formatDate(selectedData)}
            </p>
            <p className="text-sm font-medium text-[var(--rose-gold)]">
              {selectedHora} – {horaFim(selectedHora, selectedServico.duracaoMinutos)} · {selectedServico.duracaoMinutos} min · {selectedServico.preco} €
            </p>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Quando prefere liquidar?
            </p>
            <p className="mt-1 text-sm text-[var(--gray-dark)]">
              Pode pagar na sessão ou já agora, conforme for mais conveniente.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPreferenciaPagamento("na_sessao")}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                  preferenciaPagamento === "na_sessao"
                    ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                    : "border-[var(--gray-light)] text-[var(--foreground)] hover:border-[var(--rose-gold)]/40"
                }`}
              >
                Na sessão ou na próxima visita
              </button>
              <button
                type="button"
                onClick={() => setPreferenciaPagamento("agora")}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                  preferenciaPagamento === "agora"
                    ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                    : "border-[var(--gray-light)] text-[var(--foreground)] hover:border-[var(--rose-gold)]/40"
                }`}
              >
                Agora por MB Way
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)]">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="input-elegant mt-1"
                placeholder="O seu nome"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)]">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-elegant mt-1"
                placeholder="o seu@email.pt"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)]">Telefone</label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                className="input-elegant mt-1"
                placeholder="Opcional"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={submitting}
              className="btn-primary disabled:opacity-60"
            >
              {submitting ? "A guardar…" : "Confirmar marcação"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-[var(--gray-mid)]">
        <Link href="/" className="text-[var(--rose-gold)] hover:underline">
          ← Voltar ao início
        </Link>
      </p>
    </div>
  );
}
