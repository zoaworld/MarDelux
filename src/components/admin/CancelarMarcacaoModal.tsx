"use client";

import { useState } from "react";

const MOTIVOS = [
  { value: "cliente_cancela" as const, label: "Cliente Cancela" },
  { value: "falha_tecnica" as const, label: "Falha técnica" },
  { value: "outro" as const, label: "Outro" },
];

export function CancelarMarcacaoModal({
  marcacaoResumo,
  onClose,
  onConfirm,
}: {
  marcacaoResumo: { clienteNome: string; servicoNome: string; data: string; horaInicio: string };
  onClose: () => void;
  onConfirm: (payload: { motivo: "cliente_cancela" | "falha_tecnica" | "outro"; motivoTexto?: string }) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState<"cliente_cancela" | "falha_tecnica" | "outro">("cliente_cancela");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (motivo === "outro" && !motivoTexto.trim()) {
      setError("Indique o motivo.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({
        motivo,
        motivoTexto: motivo === "outro" ? motivoTexto.trim() : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao cancelar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[#171717]">Cancelar marcação</h2>
        <p className="mt-1 text-sm text-[#666]">
          {marcacaoResumo.clienteNome} · {marcacaoResumo.servicoNome} · {marcacaoResumo.data} {marcacaoResumo.horaInicio}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#171717]">Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as "cliente_cancela" | "falha_tecnica" | "outro")}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
            >
              {MOTIVOS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {motivo === "outro" && (
            <div>
              <label className="block text-sm font-medium text-[#171717]">Indique o motivo</label>
              <textarea
                value={motivoTexto}
                onChange={(e) => setMotivoTexto(e.target.value)}
                placeholder="Descreva o motivo do cancelamento…"
                rows={3}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#f5f5f5]"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "A cancelar…" : "Confirmar cancelamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
