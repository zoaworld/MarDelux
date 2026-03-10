"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export type ParceiroListItem = {
  id: string;
  codigo: string;
  nome: string;
  tipo: "essencial" | "premium";
  email: string;
  telefone?: string;
  estabelecimento?: string;
  ativo: boolean;
  eliminado?: boolean;
  sessaoGratuitaUtilizada: boolean;
  /** Total de clientes com origem neste parceiro (indicadoPorParceiroId) */
  totalReferencias?: number;
};

export default function AdminParceirosPage() {
  const { user } = useAuth();
  const [parceiros, setParceiros] = useState<ParceiroListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("ativos");
  const [showNovo, setShowNovo] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    codigo: "",
    tipo: "essencial" as "essencial" | "premium",
    telefone: "",
    estabelecimento: "",
    notas: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchParceiros = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set("tipo", filtroTipo);
      if (filtroEstado && filtroEstado !== "todos") params.set("estado", filtroEstado);
      const url = `/api/admin/parceiros${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const list = (await res.json()) as ParceiroListItem[];
        setParceiros(list);
      } else {
        setParceiros([]);
      }
    } catch {
      setParceiros([]);
    } finally {
      setLoading(false);
    }
  }, [user, filtroTipo, filtroEstado]);

  useEffect(() => {
    fetchParceiros();
  }, [fetchParceiros]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = form.nome.trim();
    const email = form.email.trim().toLowerCase();
    if (!nome || !email) {
      setCreateError("Nome e email são obrigatórios");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/parceiros", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          email,
          codigo: form.codigo.trim() || undefined,
          tipo: form.tipo,
          telefone: form.telefone.trim() || undefined,
          estabelecimento: form.estabelecimento.trim() || undefined,
          notas: form.notas.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar parceiro");
      setParceiros((prev) => [...prev, data]);
      setForm({ nome: "", email: "", codigo: "", tipo: "essencial", telefone: "", estabelecimento: "", notas: "" });
      setShowNovo(false);
      window.location.href = `/admin/parceiros/${data.id}`;
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar parceiro");
    } finally {
      setCreating(false);
    }
  };

  const filtered = parceiros.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.nome.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      (p.estabelecimento ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">Parceiros</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowNovo(!showNovo)}
            className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
          >
            + Novo parceiro
          </button>
          <Link href="/admin/parceiros/financeiro" className="text-sm text-[#b76e79] hover:underline">
            Ver financeiro →
          </Link>
          <Link href="/" className="text-sm text-[#b76e79] hover:underline">
            ← Voltar ao site
          </Link>
        </div>
      </div>

      {showNovo && (
        <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Novo parceiro</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-[#171717]">Nome *</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Nome do parceiro/estabelecimento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="email@exemplo.pt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Código</label>
              <input
                type="text"
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Deixar vazio para gerar automaticamente"
              />
              <p className="mt-1 text-xs text-[#666]">Ex: MARD-LOJA1</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Tipo de parceria</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as "essencial" | "premium" }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              >
                <option value="essencial">Essencial (15% 1.ª sessão)</option>
                <option value="premium">Premium (20% 1.ª + 10% seguintes)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Telefone</label>
              <input
                type="tel"
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="+351 912 345 678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Estabelecimento</label>
              <input
                type="text"
                value={form.estabelecimento}
                onChange={(e) => setForm((f) => ({ ...f, estabelecimento: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Nome do negócio (loja, ginásio...)"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#171717]">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              rows={2}
              placeholder="Notas internas"
            />
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60"
            >
              {creating ? "A criar…" : "Criar parceiro"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNovo(false); setCreateError(null); }}
              className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#666]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mb-6 flex flex-wrap gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, email ou código..."
          className="max-w-md flex-1 rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="essencial">Essencial</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        >
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="eliminados">Eliminados</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-12 shadow-sm">
          <p className="text-center text-[#666]">A carregar parceiros…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm">
          <p className="text-center text-[#666]">
            {parceiros.length === 0
              ? "Ainda não há parceiros. Crie o primeiro para começar o programa de indicações."
              : "Nenhum parceiro encontrado para os filtros aplicados."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#eee] bg-[#F5F5F5]">
                <th className="p-3 font-medium text-[#171717]">Código</th>
                <th className="p-3 font-medium text-[#171717]">Nome</th>
                <th className="p-3 font-medium text-[#171717]">Tipo</th>
                <th className="p-3 font-medium text-[#171717]">Email</th>
                <th className="p-3 font-medium text-[#171717]">Referências</th>
                <th className="p-3 font-medium text-[#171717]">Estado</th>
                <th className="p-3 font-medium text-[#171717]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-[#eee] hover:bg-[#fafafa]">
                  <td className="p-3 font-mono font-medium text-[#171717]">{p.codigo}</td>
                  <td className="p-3 font-medium text-[#171717]">{p.nome}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.tipo === "premium" ? "bg-[#b76e79]/20 text-[#b76e79]" : "bg-[#eee] text-[#666]"}`}>
                      {p.tipo === "premium" ? "Premium" : "Essencial"}
                    </span>
                  </td>
                  <td className="p-3 text-[#666]">{p.email}</td>
                  <td className="p-3 text-[#171717]">
                    {typeof p.totalReferencias === "number" ? p.totalReferencias : "—"}
                  </td>
                  <td className="p-3">
                    <span className={p.ativo ? "text-green-600" : "text-[#999]"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/parceiros/${p.id}`}
                      className="text-[#b76e79] hover:underline"
                    >
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
