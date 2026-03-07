"use client";

import { useState } from "react";

type PeriodoHora = "manha" | "tarde" | "fimTarde";

const PERIODOS: { id: PeriodoHora; label: string; minInicio: number; minFim: number }[] = [
  { id: "manha", label: "Manhã", minInicio: 0, minFim: 13 * 60 },
  { id: "tarde", label: "Tarde", minInicio: 13 * 60, minFim: 17 * 60 },
  { id: "fimTarde", label: "Fim da tarde", minInicio: 17 * 60, minFim: 24 * 60 },
];

function horaToMinutes(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function filterByPeriod(slots: string[], periodo: PeriodoHora): string[] {
  const p = PERIODOS.find((x) => x.id === periodo);
  if (!p) return slots;
  return slots.filter((h) => {
    const m = horaToMinutes(h);
    return m >= p.minInicio && m < p.minFim;
  });
}

export function SlotPicker({
  slots,
  value,
  onChange,
  loading,
  emptyMessage = "Sem horários disponíveis.",
  variant = "default",
  showPeriodTabs = true,
}: {
  slots: string[];
  value: string;
  onChange: (h: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  variant?: "default" | "admin";
  showPeriodTabs?: boolean;
}) {
  const [periodo, setPeriodo] = useState<PeriodoHora>("manha");
  const slotsFiltrados = showPeriodTabs ? filterByPeriod(slots, periodo) : slots;

  const isAdmin = variant === "admin";

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl bg-gray-50/80 text-sm text-gray-500">
        A carregar horários…
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-xl bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-600">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showPeriodTabs && slots.length > 6 && (
        <div className="flex gap-1.5 rounded-xl bg-gray-100/80 p-1">
          {PERIODOS.map((p) => {
            const hasSlots = filterByPeriod(slots, p.id).length > 0;
            const isActive = periodo === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!hasSlots}
                onClick={() => {
                  setPeriodo(p.id);
                  const filtered = filterByPeriod(slots, p.id);
                  if (filtered.length && !filtered.includes(value)) {
                    onChange(filtered[0]);
                  }
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm"
                    : hasSlots
                      ? "text-gray-600 hover:text-gray-900"
                      : "cursor-not-allowed text-gray-400"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {slotsFiltrados.length === 0 ? (
        <p className="text-center text-sm text-gray-500">
          Nenhum horário neste período. Tente outro período.
        </p>
      ) : (
        <div
          className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto rounded-xl p-1 sm:grid-cols-4"
          style={{ scrollbarGutter: "stable" }}
        >
          {slotsFiltrados.map((h) => {
            const isSelected = value === h;
            return (
              <button
                key={h}
                type="button"
                onClick={() => onChange(h)}
                className={`min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isSelected
                    ? isAdmin
                      ? "border-2 border-[#b76e79] bg-[#b76e79]/10 text-[#b76e79] shadow-sm"
                      : "border-2 border-[var(--rose-gold)] bg-[var(--rose-gold-light)] text-[var(--rose-gold)] shadow-sm"
                    : "border-2 border-transparent bg-white text-gray-700 hover:border-gray-200 hover:bg-gray-50 active:scale-[0.98]"
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
