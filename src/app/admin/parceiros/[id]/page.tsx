"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminData } from "@/contexts/AdminDataContext";

type Parceiro = {
  id: string;
  codigo: string;
  nome: string;
  tipo: "essencial" | "premium";
  email: string;
  telefone?: string;
  estabelecimento?: string;
  notas?: string;
  sessaoGratuitaUtilizada: boolean;
  ativo: boolean;
  eliminado?: boolean;
};

type Comissao = {
  id: string;
  marcacaoId: string;
  clienteEmail: string;
  tipo: "primeira_sessao" | "sessao_seguinte";
  valorSessao: number;
  percentagem: number;
  valorComissao: number;
  status: "pendente" | "pago";
  dataSessao: string;
  dataPago?: string;
  createdAt: string;
};

export default function AdminParceiroDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { marcacoes } = useAdminData();
  const [parceiro, setParceiro] = useState<Parceiro | null>(null);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Parceiro>>({});
  const [showEliminar, setShowEliminar] = useState(false);
  const [motivoEliminacao, setMotivoEliminacao] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchParceiro = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token || !id) return;
    try {
      const res = await fetch(`/api/admin/parceiros/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setParceiro(data);
      } else {
        setParceiro(null);
        setError("Parceiro não encontrado");
      }
    } catch {
      setParceiro(null);
      setError("Erro ao carregar");
    }
  }, [user, id]);

  const fetchComissoes = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token || !id) return;
    try {
      const res = await fetch(`/api/admin/parceiros/${id}/comissoes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = await res.json();
        setComissoes(list);
      } else {
        setComissoes([]);
      }
    } catch {
      setComissoes([]);
    }
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchParceiro(), fetchComissoes()]).finally(() => setLoading(false));
  }, [id, fetchParceiro, fetchComissoes]);

  const openEditForm = () => {
    if (parceiro) {
      setEditForm({
        nome: parceiro.nome,
        codigo: parceiro.codigo,
        tipo: parceiro.tipo,
        email: parceiro.email,
        telefone: parceiro.telefone ?? "",
        estabelecimento: parceiro.estabelecimento ?? "",
        notas: parceiro.notas ?? "",
      });
      setShowEditForm(true);
      setError(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parceiro || !user || !id) return;
    setSaving("form");
    setError(null);
    try {
      const token = await user.getIdToken();
      const payload: Record<string, unknown> = {};
      if (editForm.nome !== undefined) payload.nome = editForm.nome.trim();
      if (editForm.codigo !== undefined) payload.codigo = editForm.codigo.trim().toUpperCase();
      if (editForm.tipo !== undefined) payload.tipo = editForm.tipo;
      if (editForm.email !== undefined) payload.email = editForm.email.trim();
      if (editForm.telefone !== undefined) payload.telefone = editForm.telefone?.trim() || null;
      if (editForm.estabelecimento !== undefined) payload.estabelecimento = editForm.estabelecimento?.trim() || null;
      if (editForm.notas !== undefined) payload.notas = editForm.notas?.trim() || null;
      const res = await fetch(`/api/admin/parceiros/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
      setParceiro((p) => (p ? { ...p, ...payload } : p));
      setShowEditForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(null);
    }
  };

  const handleEliminar = async () => {
    if (!user || !id) return;
    setDeleting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/parceiros/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ motivoEliminacao: motivoEliminacao.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao eliminar");
      window.location.href = "/admin/parceiros";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao eliminar");
      setDeleting(false);
    }
  };

  const handleUpdate = async (field: keyof Parceiro, value: unknown) => {
    if (!parceiro || !user) return;
    setSaving(field);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/parceiros/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
      setParceiro((p) => (p ? { ...p, ...data } : p));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(null);
    }
  };

  const handleMarcarComissaoPago = async (comissaoId: string) => {
    const token = await user?.getIdToken?.();
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/comissoes/${comissaoId}`, {
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
            c.id === comissaoId ? { ...c, status: "pago" as const, dataPago: new Date().toISOString().slice(0, 10) } : c
          )
        );
      }
    } catch {
      /* ignore */
    }
  };

  const indicacoes = marcacoes.filter((m) => m.parceiroId === id);

  const pendentes = comissoes.filter((c) => c.status === "pendente");
  const totalPendente = pendentes.reduce((s, c) => s + c.valorComissao, 0);
  const totalPago = comissoes.filter((c) => c.status === "pago").reduce((s, c) => s + c.valorComissao, 0);

  function formatDate(str: string) {
    return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading || !parceiro) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/admin/parceiros" className="text-sm text-[#b76e79] hover:underline">
            ← Voltar aos parceiros
          </Link>
        </div>
        <div className="rounded-xl bg-white p-12 shadow-sm">
          <p className="text-center text-[#666]">{loading ? "A carregar…" : error ?? "Parceiro não encontrado"}</p>
        </div>
      </div>
    );
  }

  const linkIndicacao = typeof window !== "undefined" ? `${window.location.origin}/agendar?ref=${parceiro.codigo}` : "";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/parceiros" className="text-sm text-[#b76e79] hover:underline">
          ← Voltar aos parceiros
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openEditForm}
            className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#666] hover:bg-[#f5f5f5]"
          >
            Editar
          </button>
          {!parceiro.eliminado && (
            <button
              type="button"
              onClick={() => { setShowEliminar(true); setError(null); setMotivoEliminacao(""); }}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Eliminar
            </button>
          )}
          <Link href="/admin/parceiros/financeiro" className="text-sm text-[#b76e79] hover:underline">
            Ver financeiro →
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-[#171717]">{parceiro.nome}</h1>
        <p className="mt-1 font-mono text-lg text-[#b76e79]">{parceiro.codigo}</p>
        <p className="mt-2 text-sm text-[#666]">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${parceiro.tipo === "premium" ? "bg-[#b76e79]/20 text-[#b76e79]" : "bg-[#eee] text-[#666]"}`}>
            {parceiro.tipo === "premium" ? "Premium" : "Essencial"}
          </span>
          {parceiro.estabelecimento && (
            <span className="ml-2 text-[#666]">· {parceiro.estabelecimento}</span>
          )}
        </p>
        <p className="mt-1 text-sm text-[#666]">{parceiro.email}</p>
        {parceiro.telefone && (
          <p className="text-sm text-[#666]">{parceiro.telefone}</p>
        )}
        {parceiro.notas && (
          <p className="mt-2 text-sm text-[#666]">{parceiro.notas}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={parceiro.ativo}
              onChange={(e) => handleUpdate("ativo", e.target.checked)}
              disabled={saving === "ativo"}
            />
            Parceria ativa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={parceiro.sessaoGratuitaUtilizada}
              onChange={(e) => handleUpdate("sessaoGratuitaUtilizada", e.target.checked)}
              disabled={saving === "sessaoGratuitaUtilizada"}
            />
            Sessão gratuita utilizada
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mb-8 rounded-xl bg-[#b76e79]/10 p-6">
        <h2 className="text-sm font-semibold text-[#171717]">Link de indicação</h2>
        <p className="mt-1 text-sm text-[#666]">As clientes podem usar este link para obter 10% de desconto na primeira sessão:</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm text-[#171717]">
            {linkIndicacao}
          </code>
          <button
            type="button"
            onClick={() => linkIndicacao && navigator.clipboard?.writeText(linkIndicacao)}
            className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
          >
            Copiar
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Resumo financeiro</h2>
          <div className="space-y-2">
            <p className="flex justify-between text-sm">
              <span className="text-[#666]">Comissões pendentes</span>
              <span className="font-medium text-[#171717]">{totalPendente.toFixed(2)} €</span>
            </p>
            <p className="flex justify-between text-sm">
              <span className="text-[#666]">Comissões pagas</span>
              <span className="font-medium text-green-600">{totalPago.toFixed(2)} €</span>
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Indicações</h2>
          <p className="text-sm text-[#666]">{indicacoes.length} marcações com este código</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[#171717]">Comissões</h2>
        {comissoes.length === 0 ? (
          <p className="text-sm text-[#666]">Ainda não há comissões. As comissões são criadas quando uma sessão indicada é concluída e paga.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#eee] bg-[#F5F5F5]">
                  <th className="p-3 font-medium text-[#171717]">Data</th>
                  <th className="p-3 font-medium text-[#171717]">Cliente</th>
                  <th className="p-3 font-medium text-[#171717]">Tipo</th>
                  <th className="p-3 font-medium text-[#171717]">Valor sessão</th>
                  <th className="p-3 font-medium text-[#171717]">Comissão</th>
                  <th className="p-3 font-medium text-[#171717]">Estado</th>
                  <th className="p-3 font-medium text-[#171717]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {comissoes.map((c) => (
                  <tr key={c.id} className="border-b border-[#eee]">
                    <td className="p-3 text-[#666]">{formatDate(c.dataSessao)}</td>
                    <td className="p-3 text-[#666]">{c.clienteEmail}</td>
                    <td className="p-3 text-[#666]">{c.tipo === "primeira_sessao" ? "1.ª sessão" : "Sessão seguinte"}</td>
                    <td className="p-3 text-[#666]">{c.valorSessao.toFixed(2)} €</td>
                    <td className="p-3 font-medium text-[#171717]">{c.percentagem}% → {c.valorComissao.toFixed(2)} €</td>
                    <td className="p-3">
                      <span className={c.status === "pago" ? "text-green-600" : "text-amber-600"}>
                        {c.status === "pago" ? `Pago ${c.dataPago ? formatDate(c.dataPago) : ""}` : "Pendente"}
                      </span>
                    </td>
                    <td className="p-3">
                      {c.status === "pendente" && (
                        <button
                          type="button"
                          onClick={() => handleMarcarComissaoPago(c.id)}
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

      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-lg w-full rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-[#171717]">Editar parceiro</h3>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#171717]">Nome *</label>
                <input
                  type="text"
                  required
                  value={editForm.nome ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#171717]">Código *</label>
                <input
                  type="text"
                  required
                  value={editForm.codigo ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#171717]">Tipo</label>
                <select
                  value={editForm.tipo ?? "essencial"}
                  onChange={(e) => setEditForm((f) => ({ ...f, tipo: e.target.value as "essencial" | "premium" }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                >
                  <option value="essencial">Essencial</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#171717]">Email *</label>
                <input
                  type="email"
                  required
                  value={editForm.email ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#171717]">Telefone</label>
                <input
                  type="tel"
                  value={editForm.telefone ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, telefone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#171717]">Estabelecimento</label>
                <input
                  type="text"
                  value={editForm.estabelecimento ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, estabelecimento: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#171717]">Notas</label>
                <textarea
                  value={editForm.notas ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, notas: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!!saving}
                  className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60"
                >
                  {saving ? "A guardar…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#666]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md w-full rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-[#171717]">Eliminar parceiro</h3>
            <p className="mt-2 text-sm text-[#666]">
              Ao eliminar o parceiro <strong>{parceiro.nome}</strong>, a referência será removida de todos os clientes associados.
              Esta ação não pode ser desfeita.
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-[#171717]">Motivo da eliminação (opcional)</label>
              <textarea
                value={motivoEliminacao}
                onChange={(e) => setMotivoEliminacao(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                rows={2}
                placeholder="Ex: parceria terminada, dados incorretos..."
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleEliminar}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "A eliminar…" : "Sim, eliminar"}
              </button>
              <button
                type="button"
                onClick={() => { setShowEliminar(false); setError(null); }}
                disabled={deleting}
                className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#666] hover:bg-[#f5f5f5] disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
