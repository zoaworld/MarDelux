"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminData } from "@/contexts/AdminDataContext";
import {
  getServicosAdmin,
  getHorarioConfig,
  getMarcacoesByDate,
  getSlotsDisponiveis,
} from "@/lib/firebase";
import { SlotPicker } from "@/components/ui/SlotPicker";
import type { Servico } from "@/types";
import type { HorarioConfig } from "@/lib/firebase";

function formatDate(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function horaFim(horaInicio: string, duracaoMinutos: number): string {
  const [h, m] = horaInicio.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + duracaoMinutos;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function AdminNovaMarcacaoPage() {
  const { user } = useAuth();
  const { refresh } = useAdminData();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [horarioConfig, setHorarioConfig] = useState<HorarioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    clienteNome: "",
    clienteEmail: "",
    clienteTelefone: "",
    servicoId: "",
    data: "",
    horaInicio: "",
    preferenciaPagamento: "na_sessao" as "na_sessao" | "agora",
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdPreferencia, setCreatedPreferencia] = useState<"na_sessao" | "agora">("na_sessao");
  const [createdPreco, setCreatedPreco] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const mbWayPhone = process.env.NEXT_PUBLIC_MBWAY_PHONE ?? "";
  const selectedServico = servicos.find((s) => s.id === form.servicoId);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getServicosAdmin(), getHorarioConfig()])
      .then(([list, config]) => {
        if (cancelled) return;
        setServicos(list);
        setHorarioConfig(config);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!form.data || !selectedServico) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSlots([]);
    setForm((f) => ({ ...f, horaInicio: "" }));
    getMarcacoesByDate(form.data)
      .then((ocupados) => {
        const disp = getSlotsDisponiveis(
          form.data,
          selectedServico.duracaoMinutos,
          ocupados,
          horarioConfig ?? undefined
        );
        setSlots(disp);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [form.data, selectedServico, horarioConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServico || !form.clienteNome.trim() || !form.clienteEmail.trim() || !form.data || !form.horaInicio) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/marcacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clienteNome: form.clienteNome.trim(),
          clienteEmail: form.clienteEmail.trim(),
          clienteTelefone: form.clienteTelefone.trim() || undefined,
          servicoId: selectedServico.id,
          servicoNome: selectedServico.nome,
          duracaoMinutos: selectedServico.duracaoMinutos,
          preco: selectedServico.preco,
          data: form.data,
          horaInicio: form.horaInicio,
          preferenciaPagamento: form.preferenciaPagamento,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar marcação");
      setCreatedPreferencia(form.preferenciaPagamento);
      setCreatedPreco(selectedServico.preco);
      setSuccess(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar marcação.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#171717]">Nova marcação</h1>
          <Link href="/admin" className="text-sm text-[#b76e79] hover:underline">
            ← Agenda
          </Link>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-sm">
          <div className="text-center">
            <p className="text-5xl text-[#b76e79]">✓</p>
            <h2 className="mt-4 text-xl font-semibold text-[#171717]">Marcação criada</h2>
            <p className="mt-2 text-[#666]">
              A marcação para <strong>{form.clienteNome}</strong> foi registada.
            </p>
            {createdPreferencia === "agora" && mbWayPhone && (
              <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 text-left">
                <h3 className="font-semibold text-[#171717]">Pagamento por MB Way</h3>
                <p className="mt-2 text-sm text-[#666]">
                  Informe o cliente: envie <strong>{createdPreco} €</strong> para{" "}
                  <strong>{mbWayPhone}</strong> (MarDelux).
                </p>
                <p className="mt-1 text-sm text-[#666]">
                  Após o envio, marque &quot;Pagamento recebido&quot; na agenda.
                </p>
              </div>
            )}
            <div className="mt-8 flex gap-4 justify-center">
              <Link
                href="/admin/nova-marcacao"
                onClick={() => {
                  setSuccess(false);
                  setForm({
                    clienteNome: "",
                    clienteEmail: "",
                    clienteTelefone: "",
                    servicoId: "",
                    data: "",
                    horaInicio: "",
                    preferenciaPagamento: "na_sessao",
                  });
                }}
                className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#666] hover:bg-[#F5F5F5]"
              >
                Nova marcação
              </Link>
              <Link
                href="/admin"
                className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
              >
                Ver agenda
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#171717]">Nova marcação</h1>
        <Link href="/admin" className="text-sm text-[#b76e79] hover:underline">
          ← Agenda
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#171717]">Cliente</label>
            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              <input
                type="text"
                required
                value={form.clienteNome}
                onChange={(e) => setForm((f) => ({ ...f, clienteNome: e.target.value }))}
                className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Nome *"
              />
              <input
                type="email"
                required
                value={form.clienteEmail}
                onChange={(e) => setForm((f) => ({ ...f, clienteEmail: e.target.value }))}
                className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Email *"
              />
              <input
                type="tel"
                value={form.clienteTelefone}
                onChange={(e) => setForm((f) => ({ ...f, clienteTelefone: e.target.value }))}
                className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Telefone"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#171717]">Serviço</label>
            <select
              required
              value={form.servicoId}
              onChange={(e) => setForm((f) => ({ ...f, servicoId: e.target.value, horaInicio: "" }))}
              className="mt-2 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
            >
              <option value="">Selecione um serviço</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · {s.duracaoMinutos} min · {s.preco} €
                </option>
              ))}
            </select>
            {servicos.length === 0 && !loading && (
              <p className="mt-2 text-sm text-amber-600">Configure serviços em Configurações.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#171717]">Data</label>
            <input
              type="date"
              required
              min={today}
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value, horaInicio: "" }))}
              className="mt-2 rounded-lg border border-[#ddd] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#171717]">Hora de início</label>
            {form.data && selectedServico ? (
              <div className="mt-2">
                <SlotPicker
                  slots={slots}
                  value={form.horaInicio}
                  onChange={(h) => setForm((f) => ({ ...f, horaInicio: h }))}
                  loading={loadingSlots}
                  emptyMessage={`Sem horários disponíveis em ${formatDate(form.data)}.`}
                  variant="admin"
                  showPeriodTabs={slots.length > 8}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#666]">Selecione serviço e data primeiro.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-[#171717]">Quando prefere liquidar?</p>
            <p className="mt-1 text-sm text-[#666]">
              Pode pagar na sessão ou já agora, conforme for mais conveniente.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, preferenciaPagamento: "na_sessao" }))}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                  form.preferenciaPagamento === "na_sessao"
                    ? "border-[#b76e79] bg-[#b76e79]/10 text-[#b76e79]"
                    : "border-[#ddd] text-[#666] hover:border-[#b76e79]/40"
                }`}
              >
                Na sessão ou na próxima visita
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, preferenciaPagamento: "agora" }))}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                  form.preferenciaPagamento === "agora"
                    ? "border-[#b76e79] bg-[#b76e79]/10 text-[#b76e79]"
                    : "border-[#ddd] text-[#666] hover:border-[#b76e79]/40"
                }`}
              >
                Agora por MB Way
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            disabled={submitting || loading}
            className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60"
          >
            {submitting ? "A guardar…" : "Criar marcação"}
          </button>
          <Link
            href="/admin"
            className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#666] hover:bg-[#F5F5F5]"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
