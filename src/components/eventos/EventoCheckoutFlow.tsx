"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  getServicos,
  getMarcacoesByDate,
  getSlotsDisponiveis,
  createMarcacao,
  getHorarioConfig,
} from "@/lib/firebase";
import { SlotPicker } from "@/components/ui/SlotPicker";
import type { Servico } from "@/types";
import type { HorarioConfig } from "@/lib/firebase";

function horaFim(horaInicio: string, duracaoMinutos: number): string {
  const [h, m] = horaInicio.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + duracaoMinutos;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatDate(str: string): string {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getDatesInRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const curr = new Date(start);
  curr.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  while (curr <= endDate) {
    out.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }
  return out;
}

function filterSlotsByEventWindow(
  slots: string[],
  dataStr: string,
  eventStart: Date,
  eventEnd: Date,
  duracaoMinutos: number
): string[] {
  const eventStartTime = eventStart.getTime();
  const eventEndTime = eventEnd.getTime();
  return slots.filter((hora) => {
    const slotStart = new Date(dataStr + "T" + hora + ":00");
    const slotEnd = new Date(slotStart.getTime() + duracaoMinutos * 60 * 1000);
    return slotStart.getTime() >= eventStartTime && slotEnd.getTime() <= eventEndTime;
  });
}

/** Calendário com min e max date */
function CalendarioEvento({
  selectedData,
  onSelect,
  minDate,
  maxDate,
}: {
  selectedData: string | null;
  onSelect: (date: string) => void;
  minDate: string;
  maxDate: string;
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

  const minTime = new Date(minDate + "T00:00:00").getTime();
  const maxTime = new Date(maxDate + "T23:59:59").getTime();

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
          const isDisabled = cellTime < minTime || cellTime > maxTime;
          const isSelected = selectedData === dateStr;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onSelect(dateStr)}
              className={`aspect-square rounded-lg py-1 text-sm transition ${
                isDisabled
                  ? "cursor-not-allowed text-[var(--gray-mid)]/50"
                  : isSelected
                    ? "bg-[var(--rose-gold)] text-white"
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

type EventoData = {
  id: string;
  titulo?: string;
  slug: string;
  dataInicio: string;
  dataFim: string;
  servicosIds: string[];
  servicosMaxEscolha: number;
  codigoAtivo?: boolean;
  codigoPromocionalId?: string;
  codigoDescontoPercentagem?: number;
};

type SlotPorServico = { servicoId: string; data: string; horaInicio: string };

interface EventoCheckoutFlowProps {
  slug: string;
}

export default function EventoCheckoutFlow({ slug }: EventoCheckoutFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [evento, setEvento] = useState<EventoData | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [slotsPorServico, setSlotsPorServico] = useState<SlotPorServico[]>([]);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [selectedData, setSelectedData] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedHora, setSelectedHora] = useState<string>("");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "" });
  const [clienteResolvido, setClienteResolvido] = useState<{ id: string; nome: string } | null>(null);
  const [resolvendoCliente, setResolvendoCliente] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [horarioConfig, setHorarioConfig] = useState<HorarioConfig | null>(null);

  useEffect(() => {
    fetch(`/api/eventos/${slug}`)
      .then((r) => r.json())
      .then((data) => setEvento(data))
      .catch(() => setEvento(null));
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getServicos(), getHorarioConfig()])
      .then(([list, config]) => {
        if (cancelled) return;
        setServicos(list);
        setHorarioConfig(config);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email ?? "" }));
    }
  }, [user?.email, form.email]);

  useEffect(() => {
    if (step !== 3 || !form.email.trim() || !form.telefone.trim()) return;
    setResolvendoCliente(true);
    const params = new URLSearchParams({
      email: form.email.trim().toLowerCase(),
      telefone: form.telefone.trim(),
    });
    fetch(`/api/agendar/resolver-cliente?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.encontrado && data.cliente) {
          setClienteResolvido({
            id: data.cliente.id,
            nome: data.cliente.nome ?? "",
          });
          setForm((f) => ({ ...f, nome: (data.cliente.nome ?? "").trim() }));
        } else {
          setClienteResolvido(null);
        }
      })
      .catch(() => setClienteResolvido(null))
      .finally(() => setResolvendoCliente(false));
  }, [step, form.email, form.telefone]);

  const eventoServicos = servicos.filter((s) => evento?.servicosIds?.includes(s.id));
  const selectedServicos = eventoServicos.filter((s) => selectedIds.includes(s.id));

  const eventStart = evento ? new Date(evento.dataInicio) : null;
  const eventEnd = evento ? new Date(evento.dataFim) : null;
  const minDateStr = eventStart ? eventStart.toISOString().slice(0, 10) : "";
  const maxDateStr = eventEnd ? eventEnd.toISOString().slice(0, 10) : "";

  const currentServico = selectedServicos[currentSlotIndex];

  const loadSlots = useCallback(() => {
    if (!selectedData || !currentServico || !horarioConfig) return;
    setLoadingSlots(true);
    getMarcacoesByDate(selectedData)
      .then((ocupados) => {
        const disp = getSlotsDisponiveis(
          selectedData,
          currentServico.duracaoMinutos,
          ocupados.map((o) => ({ horaInicio: o.horaInicio, horaFim: o.horaFim })),
          horarioConfig
        );
        const filtered =
          eventStart && eventEnd
            ? filterSlotsByEventWindow(
                disp,
                selectedData,
                eventStart,
                eventEnd,
                currentServico.duracaoMinutos
              )
            : disp;
        setSlots(filtered);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedData, currentServico, horarioConfig, eventStart, eventEnd]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const toggleServico = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= (evento?.servicosMaxEscolha ?? 1)) return prev;
      return [...prev, id];
    });
  };

  const confirmarDataHora = () => {
    if (!selectedData || !selectedHora || !currentServico) return;
    setSlotsPorServico((prev) => {
      const next = [...prev];
      next[currentSlotIndex] = {
        servicoId: currentServico.id,
        data: selectedData,
        horaInicio: selectedHora,
      };
      return next;
    });
    if (currentSlotIndex + 1 < selectedServicos.length) {
      setCurrentSlotIndex((i) => i + 1);
      setSelectedData(null);
      setSelectedHora("");
    } else {
      setStep(3);
    }
  };

  const descontoPct = evento?.codigoAtivo ? (evento.codigoDescontoPercentagem ?? 0) : 0;
  const totalOriginal = selectedServicos.reduce((s, sv) => s + sv.preco, 0);
  const descontoValor = (totalOriginal * descontoPct) / 100;
  const totalFinal = Math.round((totalOriginal - descontoValor) * 100) / 100;

  const handleConfirmar = async () => {
    if (!evento) return;
    const completed = selectedServicos.every((s) =>
      slotsPorServico.some((x) => x.servicoId === s.id)
    );
    if (!completed) {
      setError("Preencha data e hora para todos os serviços.");
      return;
    }
    if (!form.nome.trim() || !form.email.trim() || !form.telefone.trim()) {
      setError("Preencha nome, email e telefone.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const ids: string[] = [];
      for (const sv of selectedServicos) {
        const slot = slotsPorServico.find((x) => x.servicoId === sv.id);
        if (!slot) continue;
        const precoOriginal = sv.preco;
        const desc = (precoOriginal * descontoPct) / 100;
        const precoFinal = Math.round((precoOriginal - desc) * 100) / 100;

        const id = await createMarcacao({
          clienteNome: form.nome.trim(),
          clienteEmail: form.email.trim(),
          clienteTelefone: form.telefone.trim(),
          clienteId: clienteResolvido?.id,
          servicoId: sv.id,
          servicoNome: sv.nome,
          duracaoMinutos: sv.duracaoMinutos,
          preco: precoFinal,
          precoOriginal: descontoPct > 0 ? precoOriginal : undefined,
          descontoEvento: descontoPct > 0 ? desc : undefined,
          codigoPromocionalId: evento.codigoPromocionalId,
          eventoId: evento.id,
          data: slot.data,
          horaInicio: slot.horaInicio,
        });
        ids.push(id);
      }
      setCreatedIds(ids);
      if (evento.codigoPromocionalId) {
        try {
          await fetch(`/api/codigos/incrementar-uso`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigoId: evento.codigoPromocionalId }),
          });
        } catch {
          /* ignorar */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao guardar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!evento) {
    return <p className="text-[var(--gray-mid)]">A carregar evento…</p>;
  }

  if (createdIds.length > 0) {
    return (
      <div className="card-elevated mx-auto max-w-lg p-8 text-center">
        <div className="text-5xl text-[var(--rose-gold)]">✓</div>
        <h2 className="font-display mt-4 text-xl font-semibold text-[var(--foreground)]">
          Reserva efetuada
        </h2>
        <p className="mt-2 text-[var(--gray-dark)]">
          As suas sessões foram registadas e receberá um email de confirmação em{" "}
          <strong>{form.email}</strong>.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/cliente" className="btn-primary">
            Ver as minhas marcações
          </Link>
          <Link href={`/eventos/${evento.slug}`} className="btn-secondary">
            Voltar ao evento
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
        {evento.titulo || "Reservar"}
      </h2>

      {step === 1 && (
        <>
          <p className="text-[var(--gray-dark)]">
            Escolha até {evento.servicosMaxEscolha} serviço(s):
          </p>
          <div className="space-y-2">
            {eventoServicos.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                  selectedIds.includes(s.id)
                    ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)]/30"
                    : "border-[var(--gray-light)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleServico(s.id)}
                  disabled={
                    !selectedIds.includes(s.id) &&
                    selectedIds.length >= evento.servicosMaxEscolha
                  }
                />
                <span className="font-medium">{s.nome}</span>
                <span className="text-[var(--rose-gold)]">{s.preco} €</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={selectedIds.length === 0}
            className="rounded-lg bg-[var(--rose-gold)] px-6 py-2 text-sm font-medium text-white hover:bg-[var(--rose-gold)]/90 disabled:opacity-50"
          >
            Continuar →
          </button>
        </>
      )}

      {step === 2 && currentServico && (
        <>
          <p className="text-[var(--gray-dark)]">
            Data e hora para <strong>{currentServico.nome}</strong> ({" "}
            {currentSlotIndex + 1} / {selectedServicos.length}):
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <CalendarioEvento
              selectedData={selectedData}
              onSelect={(d) => {
                setSelectedData(d);
                setSelectedHora("");
              }}
              minDate={minDateStr}
              maxDate={maxDateStr}
            />
            <div>
              <SlotPicker
                slots={slots}
                value={selectedHora}
                onChange={setSelectedHora}
                loading={loadingSlots}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                if (currentSlotIndex > 0) {
                  setCurrentSlotIndex((i) => i - 1);
                  const prev = slotsPorServico[currentSlotIndex - 1];
                  setSelectedData(prev?.data ?? null);
                  setSelectedHora(prev?.horaInicio ?? "");
                } else {
                  setStep(1);
                }
              }}
              className="rounded-lg border border-[var(--gray-light)] px-4 py-2 text-sm"
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={confirmarDataHora}
              disabled={!selectedData || !selectedHora}
              className="rounded-lg bg-[var(--rose-gold)] px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {currentSlotIndex + 1 < selectedServicos.length ? "Próximo serviço →" : "Continuar →"}
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="rounded-xl border border-[var(--gray-light)] bg-white p-4">
            <h3 className="font-medium text-[var(--foreground)]">Resumo</h3>
            <ul className="mt-2 space-y-1 text-sm text-[var(--gray-dark)]">
              {selectedServicos.map((s) => {
                const slot = slotsPorServico.find((x) => x.servicoId === s.id);
                return (
                  <li key={s.id}>
                    {s.nome} — {slot ? formatDate(slot.data) : ""} {slot?.horaInicio} — {s.preco} €
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 font-medium">
              Total: {totalOriginal} €
              {descontoPct > 0 && (
                <span className="text-[var(--rose-gold)]">
                  {" "}
                  → {totalFinal} € (desconto {descontoPct}%)
                </span>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nome *"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              className="w-full rounded-lg border border-[var(--gray-light)] px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email *"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-[var(--gray-light)] px-3 py-2"
            />
            <input
              type="tel"
              placeholder="Telefone *"
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              className="w-full rounded-lg border border-[var(--gray-light)] px-3 py-2"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-[var(--gray-light)] px-4 py-2 text-sm"
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={submitting}
              className="rounded-lg bg-[var(--rose-gold)] px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "A guardar…" : "Confirmar reserva"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
