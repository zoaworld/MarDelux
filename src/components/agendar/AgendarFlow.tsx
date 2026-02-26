"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getServicos,
  getMarcacoesByDate,
  getSlotsDisponiveis,
  createMarcacao,
} from "@/lib/firebase";
import { DEFAULT_SERVICOS } from "@/lib/default-servicos";
import type { Servico } from "@/types";

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

  useEffect(() => {
    getServicos()
      .then((list) => {
        if (list.length > 0) setServicos(list);
        else
          setServicos(
            DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` }))
          );
      })
      .catch(() => setServicos(DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` }))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (step !== 2 || !selectedData || !selectedServico) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedHora(null);
    getMarcacoesByDate(selectedData)
      .then((ocupados) => {
        const disp = getSlotsDisponiveis(selectedServico.duracaoMinutos, ocupados);
        setSlots(disp);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [step, selectedData, selectedServico]);

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
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="text-5xl text-[#b76e79]">✓</div>
        <h2 className="mt-4 text-xl font-semibold text-[#171717]">
          Marcação efetuada
        </h2>
        <p className="mt-2 text-[#666]">
          A sua sessão foi registada. Enviaremos um email de confirmação para{" "}
          <strong>{form.email}</strong>.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-full bg-[#b76e79] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a65d68]"
          >
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
            className="rounded-full border border-[#ddd] px-6 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-[#F5F5F5]"
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
            className={`flex-1 rounded-lg py-2 text-center text-sm font-medium ${
              i + 1 === step
                ? "bg-[#b76e79] text-white"
                : i + 1 < step
                  ? "bg-[#e8d4d6] text-[#b76e79]"
                  : "bg-[#F5F5F5] text-[#666]"
            }`}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-[#171717]">
            Escolha o serviço
          </h2>
          {loading ? (
            <p className="mt-4 text-[#666]">A carregar serviços...</p>
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
                        ? "border-[#b76e79] bg-[#fdf8f9]"
                        : "border-[#eee] hover:border-[#d4a5a5] hover:bg-[#fdf8f9]"
                    }`}
                  >
                    <span className="font-medium text-[#171717]">{s.nome}</span>
                    {s.descricao && (
                      <p className="mt-1 text-sm text-[#666]">{s.descricao}</p>
                    )}
                    <p className="mt-2 text-sm text-[#b76e79]">
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
        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-4 text-sm text-[#b76e79] hover:underline"
          >
            ← Alterar serviço
          </button>
          <h2 className="text-lg font-semibold text-[#171717]">
            Data e hora — {selectedServico.nome}
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            Horário de funcionamento: 09h–18h (15 min de intervalo entre sessões).
          </p>

          <p className="mt-6 text-sm font-medium text-[#171717]">Data</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedData(d)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  selectedData === d
                    ? "bg-[#b76e79] text-white"
                    : "bg-[#F5F5F5] text-[#171717] hover:bg-[#eee]"
                }`}
              >
                {new Date(d + "T12:00:00").toLocaleDateString("pt-PT", {
                  day: "numeric",
                  month: "short",
                })}
              </button>
            ))}
          </div>

          <p className="mt-6 text-sm font-medium text-[#171717]">Hora</p>
          {!selectedData ? (
            <p className="mt-2 text-sm text-[#666]">
              Selecione primeiro uma data.
            </p>
          ) : loadingSlots ? (
            <p className="mt-2 text-sm text-[#666]">A carregar horários...</p>
          ) : slots.length === 0 ? (
            <p className="mt-2 text-sm text-[#666]">
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
                      ? "bg-[#b76e79] text-white"
                      : "bg-[#F5F5F5] text-[#171717] hover:bg-[#eee]"
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
                className="rounded-full bg-[#b76e79] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a65d68]"
              >
                Continuar para confirmação
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && selectedServico && selectedData && selectedHora && (
        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mb-4 text-sm text-[#b76e79] hover:underline"
          >
            ← Alterar data/hora
          </button>
          <h2 className="text-lg font-semibold text-[#171717]">Confirmação</h2>
          <div className="mt-4 rounded-xl bg-[#F5F5F5] p-4">
            <p className="font-medium text-[#171717]">{selectedServico.nome}</p>
            <p className="text-sm text-[#666]">
              {formatDate(selectedData)} às {selectedHora} ·{" "}
              {selectedServico.duracaoMinutos} min · {selectedServico.preco} €
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#171717]">
                Nome *
              </label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717] focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
                placeholder="O seu nome"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">
                Email *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717] focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
                placeholder="o seu@email.pt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">
                Telefone
              </label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717] focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
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
              className="rounded-full bg-[#b76e79] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a65d68] disabled:opacity-60"
            >
              {submitting ? "A guardar…" : "Confirmar marcação"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-[#666]">
        <Link href="/" className="text-[#b76e79] hover:underline">
          ← Voltar ao início
        </Link>
      </p>
    </div>
  );
}
