"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export type ClienteListItem = {
  id: string;
  email: string;
  nome: string;
  telefone?: string;
  clienteDesde?: string;
};

export default function AdminClientesPage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<ClienteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [novoClienteForm, setNovoClienteForm] = useState({ nome: "", email: "", telefone: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fetchClientes = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clientes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as ClienteListItem[];
        setClientes(list);
      } else {
        setClientes([]);
      }
    } catch {
      setClientes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novoClienteForm.nome.trim();
    const email = novoClienteForm.email.trim().toLowerCase();
    if (!nome || !email) {
      setCreateError("Nome e email são obrigatórios");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          email,
          telefone: novoClienteForm.telefone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar cliente");
      setClientes((prev) => [...prev, data]);
      setNovoClienteForm({ nome: "", email: "", telefone: "" });
      setShowNovoCliente(false);
      window.location.href = `/admin/clientes/${data.id}`;
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar cliente");
    } finally {
      setCreating(false);
    }
  };

  const filtered = clientes.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.nome.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.telefone ?? "").includes(q)
    );
  });

  function formatClienteDesde(str?: string) {
    if (!str) return "—";
    return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">Clientes</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowNovoCliente(!showNovoCliente)}
            className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
          >
            + Novo cliente
          </button>
          <Link href="/" className="text-sm text-[#b76e79] hover:underline">
            ← Voltar ao site
          </Link>
        </div>
      </div>

      {showNovoCliente && (
        <form onSubmit={handleCreateCliente} className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Novo cliente</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-[#171717]">Nome *</label>
              <input
                type="text"
                required
                value={novoClienteForm.nome}
                onChange={(e) => setNovoClienteForm((f) => ({ ...f, nome: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Email *</label>
              <input
                type="email"
                required
                value={novoClienteForm.email}
                onChange={(e) => setNovoClienteForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="email@exemplo.pt"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Telefone</label>
              <input
                type="tel"
                value={novoClienteForm.telefone}
                onChange={(e) => setNovoClienteForm((f) => ({ ...f, telefone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="+351 912 345 678"
              />
            </div>
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60"
            >
              {creating ? "A criar…" : "Criar cliente"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNovoCliente(false); setCreateError(null); }}
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
          placeholder="Pesquisar por nome, email ou telefone..."
          className="max-w-md flex-1 rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-12 shadow-sm">
          <p className="text-center text-[#666]">A carregar clientes…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 shadow-sm">
          <p className="text-center text-[#666]">
            {clientes.length === 0
              ? "Ainda não há clientes. Os clientes são criados automaticamente a partir das marcações."
              : "Nenhum cliente encontrado para a pesquisa."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#eee] bg-[#F5F5F5]">
                <th className="p-3 font-medium text-[#171717]">Nome</th>
                <th className="p-3 font-medium text-[#171717]">Email</th>
                <th className="p-3 font-medium text-[#171717]">Telefone</th>
                <th className="p-3 font-medium text-[#171717]">Cliente desde</th>
                <th className="p-3 font-medium text-[#171717]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-[#eee] hover:bg-[#fafafa]">
                  <td className="p-3 font-medium text-[#171717]">{c.nome}</td>
                  <td className="p-3 text-[#666]">{c.email}</td>
                  <td className="p-3 text-[#666]">{c.telefone ?? "—"}</td>
                  <td className="p-3 text-[#666]">{formatClienteDesde(c.clienteDesde)}</td>
                  <td className="p-3">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-[#b76e79] hover:underline"
                    >
                      Abrir ficha →
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
