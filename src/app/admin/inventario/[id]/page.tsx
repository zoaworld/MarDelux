"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type ItemInventario = {
  id: string;
  nome: string;
  categoriaId: string;
  quantidadeAtual: number;
  unidade: string;
  stockMinimo: number;
  custoUnitario: number;
  ativo: boolean;
};

type Movimento = {
  id: string;
  itemId: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  motivo: string;
  data: string;
  referencia: string;
  createdAt: string;
};

export default function AdminInventarioItemPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [item, setItem] = useState<ItemInventario | null>(null);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMovimento, setShowMovimento] = useState(false);
  const [formMov, setFormMov] = useState({
    tipo: "entrada" as "entrada" | "saida",
    quantidade: 0,
    motivo: "",
    data: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [itemRes, movRes] = await Promise.all([
        fetch(`/api/admin/inventario/itens/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/inventario/movimentos?itemId=${id}&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (itemRes.ok) setItem((await itemRes.json()) as ItemInventario);
      else setItem(null);
      if (movRes.ok) setMovimentos((await movRes.json()) as Movimento[]);
      else setMovimentos([]);
    } catch {
      setItem(null);
      setMovimentos([]);
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegistarMovimento = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = formMov.quantidade;
    if (!qty || qty <= 0) {
      setError("Quantidade deve ser positiva");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/inventario/movimentos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: id,
          tipo: formMov.tipo,
          quantidade: qty,
          motivo: formMov.motivo.trim(),
          data: formMov.data,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao registar");
      setFormMov({ tipo: "entrada", quantidade: 0, motivo: "", data: new Date().toISOString().slice(0, 10) });
      setShowMovimento(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registar");
    } finally {
      setSubmitting(false);
    }
  };

  function formatDate(str: string) {
    return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-12 shadow-sm">
        <p className="text-center text-[#666]">A carregar…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div>
        <Link href="/admin/operacional?tab=inventario" className="mb-4 inline-block text-sm text-[#b76e79] hover:underline">
          ← Voltar ao operacional
        </Link>
        <p className="text-[#666]">Item não encontrado.</p>
      </div>
    );
  }

  const abaixo = item.stockMinimo > 0 && item.quantidadeAtual < item.stockMinimo;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">{item.nome}</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowMovimento(true)}
            className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
          >
            + Entrada / Saída
          </button>
          <Link href="/admin/operacional?tab=inventario" className="text-sm text-[#b76e79] hover:underline">
            ← Voltar ao operacional
          </Link>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#666]">Stock atual</p>
          <p className="mt-1 text-2xl font-semibold text-[#171717]">
            {item.quantidadeAtual} {item.unidade}
          </p>
        </div>
        <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#666]">Stock mínimo</p>
          <p className="mt-1 text-2xl font-semibold text-[#171717]">
            {item.stockMinimo} {item.unidade}
          </p>
        </div>
        <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#666]">Custo unitário</p>
          <p className="mt-1 text-2xl font-semibold text-[#171717]">{item.custoUnitario.toFixed(2)} €</p>
        </div>
        <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#666]">Valor em stock</p>
          <p className={`mt-1 text-2xl font-semibold ${abaixo ? "text-amber-600" : "text-[#171717]"}`}>
            {(item.quantidadeAtual * item.custoUnitario).toFixed(2)} €
          </p>
          {abaixo && <p className="mt-1 text-xs text-amber-600">Stock abaixo do mínimo</p>}
        </div>
      </div>

      {showMovimento && (
        <form onSubmit={handleRegistarMovimento} className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Registar movimento</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#666]">Tipo</label>
              <select
                value={formMov.tipo}
                onChange={(e) => setFormMov((p) => ({ ...p, tipo: e.target.value as "entrada" | "saida" }))}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#666]">Quantidade ({item.unidade})</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={formMov.quantidade || ""}
                onChange={(e) => setFormMov((p) => ({ ...p, quantidade: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#666]">Data</label>
              <input
                type="date"
                value={formMov.data}
                onChange={(e) => setFormMov((p) => ({ ...p, data: e.target.value }))}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#666]">Motivo</label>
              <input
                type="text"
                value={formMov.motivo}
                onChange={(e) => setFormMov((p) => ({ ...p, motivo: e.target.value }))}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                placeholder="Ex: Compra, Uso, Ajuste"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={submitting} className="btn-primary rounded-lg px-4 py-2 text-sm">
              {submitting ? "A registar…" : "Registar"}
            </button>
            <button
              type="button"
              onClick={() => { setShowMovimento(false); setError(null); }}
              className="btn-secondary rounded-lg px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[#171717]">Histórico de movimentos</h2>
        {movimentos.length === 0 ? (
          <p className="text-sm text-[#666]">Sem movimentos registados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#eee] bg-[#F5F5F5]">
                  <th className="p-3 font-medium text-[#171717]">Data</th>
                  <th className="p-3 font-medium text-[#171717]">Tipo</th>
                  <th className="p-3 font-medium text-[#171717]">Quantidade</th>
                  <th className="p-3 font-medium text-[#171717]">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m) => (
                  <tr key={m.id} className="border-b border-[#eee]">
                    <td className="p-3 text-[#666]">{formatDate(m.data || m.createdAt.slice(0, 10))}</td>
                    <td className="p-3">
                      <span className={m.tipo === "entrada" ? "text-green-600" : "text-amber-600"}>
                        {m.tipo === "entrada" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td className="p-3 font-medium">
                      {m.tipo === "entrada" ? "+" : "-"}{m.quantidade} {item.unidade}
                    </td>
                    <td className="p-3 text-[#666]">{m.motivo || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
