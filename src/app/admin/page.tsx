"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminData } from "@/contexts/AdminDataContext";
import { TableSkeleton, CardsSkeleton } from "@/components/admin/AdminSkeleton";
import { ReagendarModal } from "@/components/admin/ReagendarModal";
import type { MetodoPagamento } from "@/types";

const METODOS_PAGAMENTO: { value: MetodoPagamento; label: string }[] = [
  { value: "Dinheiro", label: "Dinheiro (na loja)" },
  { value: "MB Way", label: "MB Way" },
  { value: "Multibanco", label: "Multibanco" },
  { value: "Cartão", label: "Cartão" },
];

function formatDate(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export default function AdminAgendaPage() {
  const { user } = useAuth();
  const { marcacoes, loading, refresh, updateMarcacaoStatus, updateMarcacaoPagamento } = useAdminData();
  const [filterData, setFilterData] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [pagamentoMenuId, setPagamentoMenuId] = useState<string | null>(null);
  const [reagendarId, setReagendarId] = useState<string | null>(null);

  const filtered = marcacoes.filter((m) => {
    if (filterData && m.data !== filterData) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = marcacoes.filter((m) => m.data === today && m.status !== "cancelada").length;
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekCount = marcacoes.filter((m) => {
    if (m.status === "cancelada") return false;
    const d = m.data;
    return d >= today && d < weekEnd.toISOString().slice(0, 10);
  }).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">Agenda Master</h1>
        <Link
          href="/"
          className="text-sm text-[#b76e79] hover:underline"
        >
          ← Voltar ao site
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow-sm">
        {loading ? (
          <CardsSkeleton />
        ) : (
          <>
            <div className="rounded-lg border border-[#eee] px-4 py-2">
              <span className="text-xs text-[#666]">Hoje</span>
              <p className="text-lg font-semibold text-[#171717]">{todayCount} marcações</p>
            </div>
            <div className="rounded-lg border border-[#eee] px-4 py-2">
              <span className="text-xs text-[#666]">Próximos 7 dias</span>
              <p className="text-lg font-semibold text-[#171717]">{weekCount} marcações</p>
            </div>
          </>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="date"
          value={filterData}
          onChange={(e) => setFilterData(e.target.value)}
          className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        >
          <option value="">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-[#666] shadow-sm">
          Nenhuma marcação encontrada.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#eee] bg-[#F5F5F5]">
                <th className="p-3 font-medium text-[#171717]">Data</th>
                <th className="p-3 font-medium text-[#171717]">Hora</th>
                <th className="p-3 font-medium text-[#171717]">Cliente</th>
                <th className="p-3 font-medium text-[#171717]">Serviço</th>
                <th className="p-3 font-medium text-[#171717]">Valor</th>
                <th className="p-3 font-medium text-[#171717]">Pagamento</th>
                <th className="p-3 font-medium text-[#171717]">Estado</th>
                <th className="p-3 font-medium text-[#171717]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-[#eee] hover:bg-[#fafafa]">
                  <td className="p-3 text-[#171717]">{formatDate(m.data)}</td>
                  <td className="p-3 text-[#666]">{m.horaInicio} – {m.horaFim}</td>
                  <td className="p-3">
                    <span className="font-medium text-[#171717]">{m.clienteNome}</span>
                    <br />
                    <span className="text-xs text-[#666]">{m.clienteEmail}</span>
                  </td>
                  <td className="p-3 text-[#171717]">{m.servicoNome}</td>
                  <td className="p-3 text-[#171717]">{m.preco} €</td>
                  <td className="p-3 text-sm">
                    {m.pagamentoRecebido && m.metodoPagamento ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">
                        ✓ {m.metodoPagamento}
                      </span>
                    ) : m.status !== "cancelada" ? (
                      <span className="text-[#999]">A pagar</span>
                    ) : (
                      <span className="text-[#999]">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === "confirmada"
                          ? "bg-green-100 text-green-800"
                          : m.status === "concluida"
                            ? "bg-slate-100 text-slate-700"
                            : m.status === "cancelada"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {!m.pagamentoRecebido && m.status !== "cancelada" && (
                      <div className="relative mr-2 inline-block">
                        <button
                          type="button"
                          onClick={() => setPagamentoMenuId(pagamentoMenuId === m.id ? null : m.id)}
                          className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200"
                          title="Escolha o método de pagamento ao marcar como recebido"
                        >
                          Marcar pago ▾
                        </button>
                        {pagamentoMenuId === m.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              aria-hidden
                              onClick={() => setPagamentoMenuId(null)}
                            />
                            <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-[#ddd] bg-white py-1 shadow-lg">
                              {METODOS_PAGAMENTO.map(({ value, label }) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    updateMarcacaoPagamento(m.id, {
                                      pagamentoRecebido: true,
                                      metodoPagamento: value,
                                      ...(m.status === "pendente" && { status: "confirmada" } as const),
                                    });
                                    setPagamentoMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-[#171717] hover:bg-[#f5f5f5]"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {(m.status === "pendente" || m.status === "confirmada") && (
                      <>
                        <button
                          type="button"
                          onClick={() => setReagendarId(m.id)}
                          className="mr-2 text-[#b76e79] hover:underline"
                        >
                          Reagendar
                        </button>
                        {m.status === "pendente" && (
                          <button
                            type="button"
                            onClick={() => updateMarcacaoStatus(m.id, "cancelada")}
                            className="text-red-600 hover:underline"
                          >
                            Cancelar
                          </button>
                        )}
                        {m.status === "confirmada" && (
                          <button
                            type="button"
                            onClick={() => updateMarcacaoStatus(m.id, "concluida")}
                            className="text-[#b76e79] hover:underline"
                          >
                            Marcar concluída
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reagendarId && (() => {
        const m = marcacoes.find((x) => x.id === reagendarId);
        if (!m) return null;
        return (
          <ReagendarModal
            marcacao={{
              id: m.id,
              clienteNome: m.clienteNome,
              servicoNome: m.servicoNome,
              data: m.data,
              horaInicio: m.horaInicio,
              horaFim: m.horaFim,
              duracaoMinutos: m.duracaoMinutos,
            }}
            onClose={() => setReagendarId(null)}
            onSuccess={() => refresh(true)}
            getToken={() => user?.getIdToken?.() ?? Promise.resolve(undefined)}
          />
        );
      })()}
    </div>
  );
}
