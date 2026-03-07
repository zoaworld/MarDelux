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
  servicoNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  duracaoMinutos: number;
};

export function ClienteReagendarModal({
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
    getHorarioConfig().then(setHorarioConfig);
  }, []);

  const now = new Date();
  const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  useEffect(() => {
    if (!data) {
      setSlots([]);
      return;
    }
    setLoading(true);
    getMarcacoesByDate(data)
      .then((ocupados) => {
        const ocupadosExclThis = ocupados.filter((o) => o.id !== marcacao.id);
        let disp = getSlotsDisponiveis(
          data,
          marcacao.duracaoMinutos,
          ocupadosExclThis,
          horarioConfig ?? undefined
        );
        const minDateStrLocal = `${minDateTime.getFullYear()}-${String(minDateTime.getMonth() + 1).padStart(2, "0")}-${String(minDateTime.getDate()).padStart(2, "0")}`;
        if (data === minDateStrLocal) {
          disp = disp.filter((h) => {
            const slotDt = new Date(`${data}T${h}:00`);
            return slotDt.getTime() >= minDateTime.getTime();
          });
        }
        setSlots(disp);
        if (!disp.includes(horaInicio)) {
          setHoraInicio(disp[0] ?? "");
        }
      })
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [data, marcacao.id, marcacao.duracaoMinutos, horarioConfig]);

  const minDateStr = `${minDateTime.getFullYear()}-${String(minDateTime.getMonth() + 1).padStart(2, "0")}-${String(minDateTime.getDate()).padStart(2, "0")}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !horaInicio) return;
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/cliente/marcacoes/reagendar", {
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
        <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
          Reagendar marcação
        </h2>
        <p className="mt-1 text-sm text-[var(--gray-dark)]">{marcacao.servicoNome}</p>
        <p className="mt-2 text-xs text-[var(--gray-mid)]">
          O reagendamento requer pelo menos 24 horas de antecedência.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Nova data
            </label>
            <input
              type="date"
              value={data}
              min={minDateStr}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--gray-light)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Novo horário
            </label>
            <div className="mt-2">
              <SlotPicker
                slots={slots}
                value={horaInicio}
                onChange={setHoraInicio}
                loading={loading}
                emptyMessage="Sem horários disponíveis nesta data."
                variant="default"
                showPeriodTabs={slots.length > 8}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !horaInicio || slots.length === 0}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submitting ? "A guardar…" : "Reagendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
