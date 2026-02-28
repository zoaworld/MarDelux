"use client";

import { useState, useEffect } from "react";
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

function formatDate(str: string): string {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getNextDays(count: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function AgendarFlow() {
  const [step, setStep] = useState(1);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedData, setSelectedData] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedHora, setSelectedHora] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "" });
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
    getMarcacoesByDate(selectedData)
      .then((ocupados) => {
        const disp = getSlotsDisponiveis(selectedData, selectedServico.duracaoMinutos, ocupados, horarioConfig ?? undefined);
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
      });
      setCreatedId(id);
    } catch (e) {
      setError("Não foi possível guardar a marcação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdId) {
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
            }}
            className="btn-secondary"
          >
            Nova marcação
          </button>
        </div>
      </div>
    );
  }

  const days = getNextDays(21);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex justify-between gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition ${
              i + 1 === step
                ? "bg-[var(--rose-gold)] text-white"
                : i + 1 < step
                  ? "bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                  : "bg-[var(--gray-light)] text-[var(--gray-mid)]"
            }`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card-elevated p-6 md:p-8">
          <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
            Escolha o serviço
          </h2>
          {loading ? (
            <p className="mt-4 text-[var(--gray-mid)]">A carregar serviços...</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {servicos.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServico(s);
                      setStep(2);
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedServico?.id === s.id
                        ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)]"
                        : "border-[var(--gray-light)] hover:border-[var(--rose-gold)]/50 hover:bg-[var(--rose-gold-light)]/50"
                    }`}
                  >
                    <span className="font-medium text-[var(--foreground)]">{s.nome}</span>
                    {s.descricao && (
                      <p className="mt-1 text-sm text-[var(--gray-dark)]">{s.descricao}</p>
                    )}
                    <p className="mt-2 text-sm text-[var(--rose-gold)]">
                      {s.duracaoMinutos} min · {s.preco} €
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 2 && selectedServico && (
        <div className="card-elevated p-6 md:p-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-4 text-sm text-[var(--rose-gold)] hover:underline"
          >
            ← Alterar serviço
          </button>
          <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
            Data e hora — {selectedServico.nome}
          </h2>
          <p className="mt-1 text-sm text-[var(--gray-dark)]">
            O horário pode variar por dia da semana e em feriados. Intervalo entre sessões: {horarioConfig?.bufferMinutes ?? 15} min.
          </p>

          <p className="mt-6 text-sm font-medium text-[var(--foreground)]">Data</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedData(d)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  selectedData === d
                    ? "bg-[var(--rose-gold)] text-white"
                    : "bg-[var(--gray-light)] text-[var(--foreground)] hover:bg-[var(--gray-mid)]/10"
                }`}
              >
                {new Date(d + "T12:00:00").toLocaleDateString("pt-PT", {
                  day: "numeric",
                  month: "short",
                })}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium text-[var(--foreground)]">Hora</p>
          {!selectedData ? (
            <p className="mt-2 text-sm text-[var(--gray-dark)]">
              Selecione primeiro uma data.
            </p>
          ) : loadingSlots ? (
            <p className="mt-2 text-sm text-[var(--gray-dark)]">A carregar horários...</p>
          ) : slots.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--gray-dark)]">
              Sem horários disponíveis neste dia. Escolha outra data.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setSelectedHora(h)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    selectedHora === h
                      ? "bg-[var(--rose-gold)] text-white"
                      : "bg-[var(--gray-light)] text-[var(--foreground)] hover:bg-[var(--gray-mid)]/10"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
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
        </div>
      )}

      {step === 3 && selectedServico && selectedData && selectedHora && (
        <div className="card-elevated p-6 md:p-8">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mb-4 text-sm text-[var(--rose-gold)] hover:underline"
          >
            ← Alterar data/hora
          </button>
          <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">Confirmação</h2>
          <div className="mt-4 rounded-xl bg-[var(--gray-light)] p-4">
            <p className="font-medium text-[var(--foreground)]">{selectedServico.nome}</p>
            <p className="text-sm text-[var(--gray-dark)]">
              {formatDate(selectedData)} às {selectedHora} ·{" "}
              {selectedServico.duracaoMinutos} min · {selectedServico.preco} €
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Nome *
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="input-elegant mt-1"
                placeholder="O seu nome"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input-elegant mt-1"
                placeholder="o seu@email.pt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Telefone
              </label>
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
            <p className="mt-4 text-sm text-red-600">{error}</p>
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
