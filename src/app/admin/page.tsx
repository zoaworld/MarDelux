"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminData } from "@/contexts/AdminDataContext";
import { TableSkeleton, CardsSkeleton } from "@/components/admin/AdminSkeleton";
import { ReagendarModal } from "@/components/admin/ReagendarModal";
import { CancelarMarcacaoModal } from "@/components/admin/CancelarMarcacaoModal";
import type { MetodoPagamento } from "@/types";

const METODOS_PAGAMENTO: { value: MetodoPagamento; label: string }[] = [
  { value: "Dinheiro", label: "Dinheiro (na loja)" },
  { value: "MB Way", label: "MB Way" },
  { value: "Multibanco", label: "Multibanco" },
  { value: "Cartão", label: "Cartão" },
];

type FilterPeriodo = "" | "hoje" | "7dias" | "mes" | "proximo_mes";

function formatDate(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Agendada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "confirmada", label: "Agendada" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

function getMesLimits(offsetMonths: number): { start: string; end: string } {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  d.setDate(1);
  const start = d.toISOString().slice(0, 10);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  const end = d.toISOString().slice(0, 10);
  return { start, end };
}

export default function AdminAgendaPage() {
  const { user } = useAuth();
  const { marcacoes, loading, refresh, updateMarcacaoStatus, updateMarcacaoPagamento } = useAdminData();
  const [filterData, setFilterData] = useState("");
  const [filterPeriodo, setFilterPeriodo] = useState<FilterPeriodo>("");
  const [filterStatus, setFilterStatus] = useState("");
  const [pagamentoMenuId, setPagamentoMenuId] = useState<string | null>(null);
  const [maisMenuId, setMaisMenuId] = useState<string | null>(null);
  const [reagendarId, setReagendarId] = useState<string | null>(null);
  const [cancelarId, setCancelarId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const { start: mesStart, end: mesEnd } = getMesLimits(0);
  const { start: proxMesStart, end: proxMesEnd } = getMesLimits(1);

  const todayCount = marcacoes.filter((m) => m.data === today && m.status !== "cancelada").length;
  const weekCount = marcacoes.filter((m) => {
    if (m.status === "cancelada") return false;
    return m.data >= today && m.data < weekEndStr;
  }).length;
  const mesCount = marcacoes.filter((m) => {
    if (m.status === "cancelada") return false;
    return m.data >= mesStart && m.data <= mesEnd;
  }).length;
  const proxMesCount = marcacoes.filter((m) => {
    if (m.status === "cancelada") return false;
    return m.data >= proxMesStart && m.data <= proxMesEnd;
  }).length;

  const filtered = marcacoes.filter((m) => {
    if (!filterStatus && m.status === "cancelada") return false;
    if (filterData && m.data !== filterData) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    if (filterPeriodo === "hoje" && m.data !== today) return false;
    if (filterPeriodo === "7dias") {
      if (m.data < today || m.data >= weekEndStr) return false;
    }
    if (filterPeriodo === "mes") {
      if (m.data < mesStart || m.data > mesEnd) return false;
    }
    if (filterPeriodo === "proximo_mes") {
      if (m.data < proxMesStart || m.data > proxMesEnd) return false;
    }
    return true;
  });

  const setPeriodo = (p: FilterPeriodo) => {
    setFilterPeriodo(p);
    setFilterData("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[#171717]">Agenda Master</h1>
        <Link
          href="/"
          className="text-sm text-[#b76e79] hover:underline"
        >
          ← Voltar ao site
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {loading ? (
          <CardsSkeleton />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPeriodo("hoje")}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                filterPeriodo === "hoje"
                  ? "border-[#b76e79] bg-[#fef5f6] shadow-sm"
                  : "border-[#eee] bg-white hover:border-[#ddd] hover:bg-[#fafafa]"
              }`}
            >
              <span className="block text-xs font-medium text-[#666]">Hoje</span>
              <p className="text-lg font-semibold text-[#171717]">{todayCount} marcações</p>
            </button>
            <button
              type="button"
              onClick={() => setPeriodo("7dias")}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                filterPeriodo === "7dias"
                  ? "border-[#b76e79] bg-[#fef5f6] shadow-sm"
                  : "border-[#eee] bg-white hover:border-[#ddd] hover:bg-[#fafafa]"
              }`}
            >
              <span className="block text-xs font-medium text-[#666]">Próximos 7 dias</span>
              <p className="text-lg font-semibold text-[#171717]">{weekCount} marcações</p>
            </button>
            <button
              type="button"
              onClick={() => setPeriodo("mes")}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                filterPeriodo === "mes"
                  ? "border-[#b76e79] bg-[#fef5f6] shadow-sm"
                  : "border-[#eee] bg-white hover:border-[#ddd] hover:bg-[#fafafa]"
              }`}
            >
              <span className="block text-xs font-medium text-[#666]">Este mês</span>
              <p className="text-lg font-semibold text-[#171717]">{mesCount} marcações</p>
            </button>
            <button
              type="button"
              onClick={() => setPeriodo("proximo_mes")}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                filterPeriodo === "proximo_mes"
                  ? "border-[#b76e79] bg-[#fef5f6] shadow-sm"
                  : "border-[#eee] bg-white hover:border-[#ddd] hover:bg-[#fafafa]"
              }`}
            >
              <span className="block text-xs font-medium text-[#666]">Próximo mês</span>
              <p className="text-lg font-semibold text-[#171717]">{proxMesCount} marcações</p>
            </button>
          </>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={filterData}
          onChange={(e) => {
            setFilterData(e.target.value);
            setFilterPeriodo("");
          }}
          className="rounded-lg border border-[#ddd] px-3 py-2 text-sm transition-colors focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-[#ddd] px-3 py-2 text-sm transition-colors focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
        >
          <option value="">Todos os estados</option>
          {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#eee] bg-white p-8 text-center shadow-sm">
          <p className="text-[#666]">Nenhuma marcação encontrada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#eee] bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-[#eee] bg-[#F8F8F8]">
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
                <tr key={m.id} className="border-b border-[#eee] transition-colors hover:bg-[#f9f9f9]">
                  <td className="p-3 text-[#171717]">{formatDate(m.data)}</td>
                  <td className="p-3 text-[#666]">{m.horaInicio} – {m.horaFim}</td>
                  <td className="p-3">
                    {m.clienteId ? (
                      <Link
                        href={`/admin/clientes/${m.clienteId}`}
                        className="block text-[#b76e79] hover:underline"
                      >
                        <span className="font-medium">{m.clienteNome}</span>
                        <br />
                        <span className="text-xs opacity-90">{m.clienteEmail}</span>
                      </Link>
                    ) : (
                      <>
                        <span className="font-medium text-[#171717]">{m.clienteNome}</span>
                        <br />
                        <span className="text-xs text-[#666]">{m.clienteEmail}</span>
                      </>
                    )}
                  </td>
                  <td className="p-3 text-[#171717]">{m.servicoNome}</td>
                  <td className="p-3 text-[#171717]">{m.preco} €</td>
                  <td className="p-3 text-sm">
                    {m.pagamentoRecebido && m.metodoPagamento ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                        ✓ {m.metodoPagamento}
                      </span>
                    ) : m.status !== "cancelada" ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setPagamentoMenuId(pagamentoMenuId === m.id ? null : m.id);
                            setMaisMenuId(null);
                          }}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200"
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
                            <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-md">
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
                    ) : (
                      <span className="text-[#999]">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === "confirmada"
                          ? "bg-[#f0f0f0] text-[#555]"
                          : m.status === "concluida"
                            ? "bg-green-100 text-green-800"
                            : m.status === "cancelada"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.status === "confirmada" && (
                        <button
                          type="button"
                          onClick={() => updateMarcacaoStatus(m.id, "concluida")}
                          className="rounded-md border border-[#e5e5e5] px-2 py-1 text-xs font-medium text-[#666] transition-colors hover:bg-[#f5f5f5]"
                        >
                          Concluída
                        </button>
                      )}
                      {(m.status === "pendente" || m.status === "confirmada") && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setMaisMenuId(maisMenuId === m.id ? null : m.id);
                              setPagamentoMenuId(null);
                            }}
                            className="rounded-md border border-[#e5e5e5] px-2 py-1 text-xs font-medium text-[#666] transition-colors hover:bg-[#f5f5f5]"
                          >
                            Mais ▾
                          </button>
                          {maisMenuId === m.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                aria-hidden
                                onClick={() => setMaisMenuId(null)}
                              />
                              <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-[#e5e5e5] bg-white py-1 shadow-md">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReagendarId(m.id);
                                    setMaisMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-[#b76e79] hover:bg-[#fef5f6]"
                                >
                                  Reagendar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelarId(m.id);
                                    setMaisMenuId(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
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

      {cancelarId && (() => {
        const m = marcacoes.find((x) => x.id === cancelarId);
        if (!m) return null;
        return (
          <CancelarMarcacaoModal
            marcacaoResumo={{
              clienteNome: m.clienteNome,
              servicoNome: m.servicoNome,
              data: m.data,
              horaInicio: m.horaInicio,
            }}
            onClose={() => setCancelarId(null)}
            onConfirm={async (payload) => {
              await updateMarcacaoStatus(m.id, "cancelada", {
                motivoCancelamento: payload.motivo,
                motivoCancelamentoTexto: payload.motivoTexto,
              });
              await refresh(true);
            }}
          />
        );
      })()}
    </div>
  );
}
