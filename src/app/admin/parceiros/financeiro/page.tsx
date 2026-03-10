"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type Comissao = {
  id: string;
  parceiroId: string;
  marcacaoId: string;
  clienteEmail: string;
  tipo: "primeira_sessao" | "sessao_seguinte";
  valorSessao: number;
  percentagem: number;
  valorComissao: number;
  status: "pendente" | "pago";
  parceiroAtivoNaData?: boolean;
  dataSessao: string;
  dataPago?: string;
  createdAt: string;
};

type ParceiroMap = Record<string, { nome: string; codigo: string }>;

export default function AdminParceirosFinanceiroPage() {
  const { user } = useAuth();
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [parceirosMap, setParceirosMap] = useState<ParceiroMap>({});
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("");

  const fetchData = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [comRes, parRes] = await Promise.all([
        fetch(`/api/admin/comissoes${filtroStatus ? `?status=${filtroStatus}` : ""}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/parceiros?estado=todos", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (comRes.ok) {
        const list = (await comRes.json()) as Comissao[];
        setComissoes(list);
      } else {
        setComissoes([]);
      }
      if (parRes.ok) {
        const partners = (await parRes.json()) as { id: string; nome: string; codigo: string }[];
        const map: ParceiroMap = {};
        partners.forEach((p) => { map[p.id] = { nome: p.nome, codigo: p.codigo }; });
        setParceirosMap(map);
      }
    } catch {
      setComissoes([]);
    } finally {
      setLoading(false);
    }
  }, [user, filtroStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarcarPago = async (id: string) => {
    const token = await user?.getIdToken?.();
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/comissoes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "pago" }),
      });
      if (res.ok) {
        setComissoes((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: "pago" as const, dataPago: new Date().toISOString().slice(0, 10) } : c
          )
        );
      }
    } catch {
      /* ignore */
    }
  };

  const pendentes = comissoes.filter((c) => c.status === "pendente");
  const totalPendente = pendentes.reduce((s, c) => s + c.valorComissao, 0);
  const totalPago = comissoes.filter((c) => c.status === "pago").reduce((s, c) => s + c.valorComissao, 0);
  const comissoesInativas = comissoes.filter((c) => c.parceiroAtivoNaData === false);
  const totalInativas = comissoesInativas.reduce((s, c) => s + c.valorComissao, 0);

  const porParceiro = comissoes.reduce<Record<string, { pendente: number; pago: number }>>((acc, c) => {
    if (!acc[c.parceiroId]) acc[c.parceiroId] = { pendente: 0, pago: 0 };
    if (c.status === "pendente") acc[c.parceiroId].pendente += c.valorComissao;
    else acc[c.parceiroId].pago += c.valorComissao;
    return acc;
  }, {});

  function formatDate(str: string) {
    return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">Financeiro – Comissões</h1>
        <Link href="/admin/parceiros" className="text-sm text-[#b76e79] hover:underline">
          ← Voltar aos parceiros
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        >
          <option value="">Todas</option>
          <option value="pendente">Pendentes</option>
          <option value="pago">Pagas</option>
        </select>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#666]">Total comissões pendentes</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{totalPendente.toFixed(2)} €</p>
        </div>
        <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#666]">Total comissões pagas</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">{totalPago.toFixed(2)} €</p>
        </div>
        <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#666]">Comissões inativas</p>
          <p className="mt-1 text-2xl font-semibold text-[#999]">{totalInativas.toFixed(2)} €</p>
          <p className="mt-1 text-xs text-[#666]">Parceiros inativos na data da sessão (registadas, não pagas)</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-12 shadow-sm">
          <p className="text-center text-[#666]">A carregar…</p>
        </div>
      ) : (
        <>
          <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#171717]">Por parceiro</h2>
            {Object.keys(porParceiro).length === 0 ? (
              <p className="text-sm text-[#666]">Sem comissões registadas.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(porParceiro).map(([pid, totals]) => (
                  <li key={pid} className="flex items-center justify-between border-b border-[#eee] py-2">
                    <span className="font-medium text-[#171717]">
                      {parceirosMap[pid]?.nome ?? pid}
                      <span className="ml-2 font-mono text-xs text-[#666]">{parceirosMap[pid]?.codigo ?? ""}</span>
                    </span>
                    <span className="text-sm">
                      Pendente: <strong className="text-amber-600">{totals.pendente.toFixed(2)} €</strong>
                      {" · "}
                      Pago: <strong className="text-green-600">{totals.pago.toFixed(2)} €</strong>
                    </span>
                    <Link href={`/admin/parceiros/${pid}`} className="text-sm text-[#b76e79] hover:underline">
                      Ver ficha →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[#171717]">Lista de comissões</h2>
            {comissoes.length === 0 ? (
              <p className="text-sm text-[#666]">Nenhuma comissão encontrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#eee] bg-[#F5F5F5]">
                      <th className="p-3 font-medium text-[#171717]">Parceiro</th>
                      <th className="p-3 font-medium text-[#171717]">Data</th>
                      <th className="p-3 font-medium text-[#171717]">Cliente</th>
                      <th className="p-3 font-medium text-[#171717]">Comissão</th>
                      <th className="p-3 font-medium text-[#171717]">Estado</th>
                      <th className="p-3 font-medium text-[#171717]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comissoes.map((c) => (
                      <tr key={c.id} className="border-b border-[#eee]">
                        <td className="p-3">
                          <Link href={`/admin/parceiros/${c.parceiroId}`} className="text-[#b76e79] hover:underline">
                            {parceirosMap[c.parceiroId]?.nome ?? c.parceiroId}
                          </Link>
                        </td>
                        <td className="p-3 text-[#666]">{formatDate(c.dataSessao)}</td>
                        <td className="p-3 text-[#666]">{c.clienteEmail}</td>
                        <td className="p-3 font-medium text-[#171717]">{c.valorComissao.toFixed(2)} €</td>
                        <td className="p-3">
                          <span className={c.status === "pago" ? "text-green-600" : "text-amber-600"}>
                            {c.status === "pago" ? (c.dataPago ? `Pago ${formatDate(c.dataPago)}` : "Pago") : "Pendente"}
                          </span>
                        </td>
                        <td className="p-3">
                          {c.status === "pendente" && (
                            <button
                              type="button"
                              onClick={() => handleMarcarPago(c.id)}
                              className="text-sm text-[#b76e79] hover:underline"
                            >
                              Marcar como pago
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
