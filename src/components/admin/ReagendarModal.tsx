"use client";

import { useState, useEffect } from "react";
import {
  getMarcacoesByDate,
  getSlotsDisponiveis,
  getHorarioConfig,
} from "@/lib/firebase";
import { SlotPicker } from "@/components/ui/SlotPicker";
import type { HorarioConfig } from "@/lib/firebase";

type MarcacaoForReagendar = {
  id: string;
  clienteNome: string;
  servicoNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  duracaoMinutos: number;
};

export function ReagendarModal({
  marcacao,
  onClose,
  onSuccess,
  getToken,
}: {
  marcacao: MarcacaoForReagendar;
  onClose: () => void;
  onSuccess: () => void;
  getToken: () => Promise<string | undefined>;
}) {
  const [data, setData] = useState(marcacao.data);
  const [horaInicio, setHoraInicio] = useState(marcacao.horaInicio);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horarioConfig, setHorarioConfig] = useState<HorarioConfig | null>(null);

  useEffect(() => {
    setHorarioConfig(null);
    getHorarioConfig().then(setHorarioConfig);
  }, []);

  useEffect(() => {
    if (!data) {
      setSlots([]);
      return;
    }
    setLoading(true);
    getMarcacoesByDate(data)
      .then((ocupados) => {
        const ocupadosExclThis = ocupados.filter((o) => o.id !== marcacao.id);
        const disp = getSlotsDisponiveis(
          data,
          marcacao.duracaoMinutos,
          ocupadosExclThis,
          horarioConfig ?? undefined
        );
        setSlots(disp);
        if (!disp.includes(horaInicio)) {
          setHoraInicio(disp[0] ?? "");
        }
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [data, marcacao.duracaoMinutos, marcacao.horaInicio, marcacao.horaFim, horarioConfig]);

  const today = new Date().toISOString().slice(0, 10);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !horaInicio) return;
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/marcacoes/reagendar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: marcacao.id, data, horaInicio }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erro ao reagendar");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reagendar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[#171717]">Reagendar marcação</h2>
        <p className="mt-1 text-sm text-[#666]">
          {marcacao.clienteNome} · {marcacao.servicoNome}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#171717]">Nova data</label>
            <input
              type="date"
              value={data}
              min={today}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#171717]">Novo horário</label>
            <div className="mt-2">
              <SlotPicker
                slots={slots}
                value={horaInicio}
                onChange={setHoraInicio}
                loading={loading}
                emptyMessage="Sem horários disponíveis nesta data."
                variant="admin"
                showPeriodTabs={slots.length > 8}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#f5f5f5]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !horaInicio || slots.length === 0}
              className="flex-1 rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-50"
            >
              {submitting ? "A guardar…" : "Reagendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
