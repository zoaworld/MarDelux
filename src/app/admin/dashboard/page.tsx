"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminData } from "@/contexts/AdminDataContext";
import { DashboardSkeleton } from "@/components/admin/AdminSkeleton";

function formatMonth(str: string) {
  return new Date(str + "-01").toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { marcacoes, loading } = useAdminData();
  const [clientesCount, setClientesCount] = useState<number | null>(null);

  const fetchClientesCount = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token) return;
    try {
      const res = await fetch("/api/admin/clientes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as { id: string }[];
        setClientesCount(list.length);
      } else {
        setClientesCount(0);
      }
    } catch {
      setClientesCount(0);
    }
  }, [user]);

  useEffect(() => {
    fetchClientesCount();
  }, [fetchClientesCount]);

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const marcacoesEstaSemana = marcacoes.filter((m) => {
    if (m.status === "cancelada") return false;
    return m.data >= today && m.data < weekEndStr;
  });

  const concluidas = marcacoes.filter(
    (m) => m.status === "concluida" || m.status === "confirmada"
  );
  const pagas = concluidas.filter((m) => m.pagamentoRecebido);
  const pendentesPagamento = concluidas.filter((m) => !m.pagamentoRecebido);

  const porMetodo = pagas.reduce<Record<string, number>>((acc, m) => {
    const metodo = m.metodoPagamento ?? "Não especificado";
    acc[metodo] = (acc[metodo] ?? 0) + m.preco;
    return acc;
  }, {});

  const porDia = concluidas.reduce<Record<string, number>>((acc, m) => {
    acc[m.data] = (acc[m.data] ?? 0) + m.preco;
    return acc;
  }, {});

  const porMes = concluidas.reduce<Record<string, number>>((acc, m) => {
    const mes = m.data.slice(0, 7);
    acc[mes] = (acc[mes] ?? 0) + m.preco;
    return acc;
  }, {});

  const totalGeral = concluidas.reduce((s, m) => s + m.preco, 0);
  const totalPendente = pendentesPagamento.reduce((s, m) => s + m.preco, 0);
  const diasOrdenados = Object.keys(porDia).sort().slice(-14);
  const mesesOrdenados = Object.keys(porMes).sort().slice(-6);

  const proximasMarcacoes = marcacoes
    .filter((m) => m.data >= today && m.status !== "cancelada")
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio))
    .slice(0, 5);

  const isLoading = loading;
  const isLoadingClientes = clientesCount === null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#171717]">Dashboard</h1>
        <Link href="/" className="text-sm text-[#b76e79] hover:underline">
          ← Voltar ao site
        </Link>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
          {/* Cards de resumo */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/admin/clientes"
              className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm transition hover:border-[#b76e79]/30 hover:shadow-md"
            >
              <p className="text-sm text-[#666]">Total de clientes</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">
                {isLoadingClientes ? "…" : clientesCount ?? 0}
              </p>
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm transition hover:border-[#b76e79]/30 hover:shadow-md"
            >
              <p className="text-sm text-[#666]">Marcações esta semana</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">
                {marcacoesEstaSemana.length}
              </p>
            </Link>
            <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#666]">Total faturado</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">
                {totalGeral.toFixed(2)} €
              </p>
            </div>
            <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#666]">Pendente de cobrança</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">
                {totalPendente.toFixed(2)} €
              </p>
            </div>
          </div>

          {/* Próximas marcações e Pagamentos pendentes */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 flex items-center justify-between text-lg font-medium text-[#171717]">
                Próximas marcações
                <Link
                  href="/admin"
                  className="text-sm font-normal text-[#b76e79] hover:underline"
                >
                  Ver agenda →
                </Link>
              </h2>
              {proximasMarcacoes.length === 0 ? (
                <p className="text-sm text-[#666]">Sem marcações futuras.</p>
              ) : (
                <ul className="space-y-3">
                  {proximasMarcacoes.map((m) => (
                    <li
                      key={m.id}
                      className="flex justify-between rounded-lg border border-[#eee] px-3 py-2 text-sm"
                    >
                      <span className="text-[#171717]">
                        {new Date(m.data + "T12:00:00").toLocaleDateString("pt-PT", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {m.horaInicio} · {m.clienteNome}
                      </span>
                      <span className="font-medium text-[#171717]">{m.preco} €</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-[#171717]">
                Pagamentos pendentes ({pendentesPagamento.length})
              </h2>
              {pendentesPagamento.length === 0 ? (
                <p className="text-sm text-[#666]">
                  Todas as sessões concluídas estão pagas.
                </p>
              ) : (
                <ul className="space-y-3">
                  {pendentesPagamento.slice(0, 5).map((m) => (
                    <li
                      key={m.id}
                      className="flex justify-between rounded-lg border border-[#eee] px-3 py-2 text-sm"
                    >
                      <span className="text-[#171717]">
                        {m.clienteNome} · {m.servicoNome}
                      </span>
                      <span className="font-medium text-[#171717]">{m.preco} €</span>
                    </li>
                  ))}
                  {pendentesPagamento.length > 5 && (
                    <p className="text-xs text-[#666]">
                      + {pendentesPagamento.length - 5} restantes
                    </p>
                  )}
                </ul>
              )}
              <p className="mt-3 text-xs text-[#999]">
                Marque &quot;Marcar pago&quot; na Agenda ou na ficha do cliente.
              </p>
            </div>
          </div>

          {/* Secção financeira */}
          <div className="rounded-xl bg-[#b76e79] p-6 text-white shadow-sm">
            <p className="text-sm opacity-90">Total faturado (confirmadas + concluídas)</p>
            <p className="text-3xl font-semibold">{totalGeral.toFixed(2)} €</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-[#171717]">
                Por método de pagamento
              </h2>
              {Object.keys(porMetodo).length === 0 ? (
                <p className="text-sm text-[#666]">Nenhum pagamento registado com método.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(porMetodo)
                    .sort(([, a], [, b]) => b - a)
                    .map(([metodo, valor]) => (
                      <li key={metodo} className="flex justify-between text-sm">
                        <span className="text-[#666]">{metodo}</span>
                        <span className="font-medium text-[#171717]">
                          {valor.toFixed(2)} €
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium text-[#171717]">
                Faturação por mês
              </h2>
              {mesesOrdenados.length === 0 ? (
                <p className="text-sm text-[#666]">Sem dados.</p>
              ) : (
                <ul className="space-y-2">
                  {[...mesesOrdenados].reverse().map((mes) => (
                    <li key={mes} className="flex justify-between text-sm">
                      <span className="capitalize text-[#666]">{formatMonth(mes)}</span>
                      <span className="font-medium text-[#171717]">
                        {porMes[mes].toFixed(2)} €
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-[#171717]">
              Faturação por dia (últimos 14 dias)
            </h2>
            {diasOrdenados.length === 0 ? (
              <p className="text-sm text-[#666]">Sem dados.</p>
            ) : (
              <ul className="space-y-2">
                {diasOrdenados.map((data) => (
                  <li key={data} className="flex justify-between text-sm">
                    <span className="text-[#666]">
                      {new Date(data + "T12:00:00").toLocaleDateString("pt-PT", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="font-medium text-[#171717]">
                      {porDia[data].toFixed(2)} €
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-[#eee] bg-[#F5F5F5] p-6">
            <h2 className="mb-2 text-lg font-medium text-[#171717]">
              Pagamentos manuais
            </h2>
            <p className="text-sm text-[#666]">
              Dinheiro (na loja) e MB Way (online) são registados ao marcar
              &quot;Marcar pago&quot; na Agenda ou na ficha do cliente. O resumo acima reflete esses dados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
