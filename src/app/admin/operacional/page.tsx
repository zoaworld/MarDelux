"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type CategoriaInventario = {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
};

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

type CategoriaCusto = {
  id: string;
  nome: string;
  tipo: "fixo" | "variavel";
  ordem: number;
  ativo: boolean;
};

type CustoMensal = {
  id: string;
  categoriaId: string;
  mes: string;
  valor: number;
  notas: string;
};

function formatMonth(str: string) {
  return new Date(str + "-01").toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
}

type Tab = "inventario" | "custos";

export default function AdminOperacionalPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam === "custos" ? "custos" : "inventario");

  useEffect(() => {
    if (tabParam === "custos" || tabParam === "inventario") setTab(tabParam);
  }, [tabParam]);

  const { user } = useAuth();

  // Inventário
  const [catInv, setCatInv] = useState<CategoriaInventario[]>([]);
  const [itens, setItens] = useState<ItemInventario[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [filtroAtivo, setFiltroAtivo] = useState<string>("todos");
  const [showNovoItem, setShowNovoItem] = useState(false);
  const [showNovaCatInv, setShowNovaCatInv] = useState(false);
  const [formItem, setFormItem] = useState({
    nome: "",
    categoriaId: "",
    quantidadeAtual: 0,
    unidade: "un",
    stockMinimo: 0,
    custoUnitario: 0,
  });
  const [formCatInv, setFormCatInv] = useState({ nome: "", descricao: "" });
  const [creatingInv, setCreatingInv] = useState(false);
  const [errorInv, setErrorInv] = useState<string | null>(null);

  // Custos
  const [catCustos, setCatCustos] = useState<CategoriaCusto[]>([]);
  const [custos, setCustos] = useState<CustoMensal[]>([]);
  const [loadingCustos, setLoadingCustos] = useState(true);
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date().toISOString().slice(0, 7));
  const [showNovaCatCusto, setShowNovaCatCusto] = useState(false);
  const [formCatCusto, setFormCatCusto] = useState({ nome: "", tipo: "fixo" as "fixo" | "variavel" });
  const [formValores, setFormValores] = useState<Record<string, number>>({});
  const [formNotas, setFormNotas] = useState<Record<string, string>>({});
  const [savingCusto, setSavingCusto] = useState<string | null>(null);
  const [creatingCusto, setCreatingCusto] = useState(false);
  const [errorCusto, setErrorCusto] = useState<string | null>(null);

  const fetchInventario = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token) { setLoadingInv(false); return; }
    setLoadingInv(true);
    try {
      const params = new URLSearchParams();
      if (filtroCategoria) params.set("categoriaId", filtroCategoria);
      if (filtroAtivo !== "todos") params.set("ativo", filtroAtivo);
      const [catRes, itensRes] = await Promise.all([
        fetch("/api/admin/inventario/categorias", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/inventario/itens${params.toString() ? `?${params}` : ""}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (catRes.ok) setCatInv((await catRes.json()) as CategoriaInventario[]);
      else setCatInv([]);
      if (itensRes.ok) setItens((await itensRes.json()) as ItemInventario[]);
      else setItens([]);
    } catch {
      setCatInv([]);
      setItens([]);
    } finally {
      setLoadingInv(false);
    }
  }, [user, filtroCategoria, filtroAtivo]);

  const fetchCustos = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token) { setLoadingCustos(false); return; }
    setLoadingCustos(true);
    try {
      const [catRes, custosRes] = await Promise.all([
        fetch("/api/admin/custos/categorias", { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/custos/mensais?mes=${mesSelecionado}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (catRes.ok) setCatCustos((await catRes.json()) as CategoriaCusto[]);
      else setCatCustos([]);
      if (custosRes.ok) {
        const list = (await custosRes.json()) as CustoMensal[];
        setCustos(list);
        const vals: Record<string, number> = {};
        const notas: Record<string, string> = {};
        list.forEach((c) => {
          vals[c.categoriaId] = c.valor;
          notas[c.categoriaId] = c.notas;
        });
        setFormValores(vals);
        setFormNotas(notas);
      } else {
        setCustos([]);
        setFormValores({});
        setFormNotas({});
      }
    } catch {
      setCatCustos([]);
      setCustos([]);
    } finally {
      setLoadingCustos(false);
    }
  }, [user, mesSelecionado]);

  useEffect(() => {
    if (tab === "inventario") fetchInventario();
    else fetchCustos();
  }, [tab, fetchInventario, fetchCustos]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = formItem.nome.trim();
    if (!nome) { setErrorInv("Nome obrigatório"); return; }
    setCreatingInv(true);
    setErrorInv(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/inventario/itens", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nome,
          categoriaId: formItem.categoriaId || undefined,
          quantidadeAtual: formItem.quantidadeAtual,
          unidade: formItem.unidade,
          stockMinimo: formItem.stockMinimo,
          custoUnitario: formItem.custoUnitario,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar item");
      setFormItem({ nome: "", categoriaId: "", quantidadeAtual: 0, unidade: "un", stockMinimo: 0, custoUnitario: 0 });
      setShowNovoItem(false);
      fetchInventario();
    } catch (err) {
      setErrorInv(err instanceof Error ? err.message : "Erro");
    } finally {
      setCreatingInv(false);
    }
  };

  const handleCreateCatInv = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = formCatInv.nome.trim();
    if (!nome) { setErrorInv("Nome obrigatório"); return; }
    setCreatingInv(true);
    setErrorInv(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/inventario/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome, descricao: formCatInv.descricao.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setFormCatInv({ nome: "", descricao: "" });
      setShowNovaCatInv(false);
      fetchInventario();
    } catch (err) {
      setErrorInv(err instanceof Error ? err.message : "Erro");
    } finally {
      setCreatingInv(false);
    }
  };

  const handleCreateCatCusto = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = formCatCusto.nome.trim();
    if (!nome) { setErrorCusto("Nome obrigatório"); return; }
    setCreatingCusto(true);
    setErrorCusto(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/custos/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome, tipo: formCatCusto.tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setFormCatCusto({ nome: "", tipo: "fixo" });
      setShowNovaCatCusto(false);
      fetchCustos();
    } catch (err) {
      setErrorCusto(err instanceof Error ? err.message : "Erro");
    } finally {
      setCreatingCusto(false);
    }
  };

  const handleGuardarCusto = async (categoriaId: string) => {
    const token = await user?.getIdToken?.();
    if (!token) return;
    setSavingCusto(categoriaId);
    try {
      const res = await fetch("/api/admin/custos/mensais", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          categoriaId,
          mes: mesSelecionado,
          valor: formValores[categoriaId] ?? 0,
          notas: formNotas[categoriaId] ?? "",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro");
      }
      fetchCustos();
    } catch {
      setSavingCusto(null);
    } finally {
      setSavingCusto(null);
    }
  };

  const catMap = Object.fromEntries(catInv.map((c) => [c.id, c.nome]));
  const itensStockBaixo = itens.filter((i) => i.stockMinimo > 0 && i.quantidadeAtual < i.stockMinimo);
  const valorEmStock = itens.reduce((s, i) => s + i.quantidadeAtual * i.custoUnitario, 0);

  const catFixas = catCustos.filter((c) => c.tipo === "fixo" && c.ativo);
  const catVariaveis = catCustos.filter((c) => c.tipo === "variavel" && c.ativo);
  const totalFixo = catFixas.reduce((s, c) => s + (formValores[c.id] ?? 0), 0);
  const totalVariavel = catVariaveis.reduce((s, c) => s + (formValores[c.id] ?? 0), 0);
  const totalGeral = totalFixo + totalVariavel;

  const mesesOptions: string[] = [];
  for (let i = -12; i <= 0; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    mesesOptions.push(d.toISOString().slice(0, 7));
  }
  mesesOptions.reverse();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">Operacional</h1>
        <Link href="/admin/dashboard" className="text-sm text-[#b76e79] hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[#eee]">
        <button
          type="button"
          onClick={() => setTab("inventario")}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "inventario"
              ? "border-b-2 border-[#b76e79] text-[#b76e79]"
              : "text-[#666] hover:text-[#171717]"
          }`}
        >
          Inventário
        </button>
        <button
          type="button"
          onClick={() => setTab("custos")}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === "custos"
              ? "border-b-2 border-[#b76e79] text-[#b76e79]"
              : "text-[#666] hover:text-[#171717]"
          }`}
        >
          Custos
        </button>
      </div>

      {tab === "inventario" && (
        <>
          <div className="mb-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => { setShowNovoItem(true); setShowNovaCatInv(false); }}
              className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
            >
              + Novo item
            </button>
            <button
              type="button"
              onClick={() => { setShowNovaCatInv(true); setShowNovoItem(false); }}
              className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#f5f5f5]"
            >
              + Nova categoria
            </button>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#666]">Total de itens</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{itens.length}</p>
            </div>
            <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#666]">Valor em stock</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{valorEmStock.toFixed(2)} €</p>
            </div>
            <Link
              href="/admin/operacional?tab=inventario"
              className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm transition hover:border-[#b76e79]/30 hover:shadow-md"
            >
              <p className="text-sm text-[#666]">Itens em stock baixo</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{itensStockBaixo.length}</p>
            </Link>
            <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#666]">Categorias</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{catInv.length}</p>
            </div>
          </div>

          {showNovaCatInv && (
            <form onSubmit={handleCreateCatInv} className="mb-6 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[#171717]">Nova categoria</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Nome</label>
                  <input
                    type="text"
                    value={formCatInv.nome}
                    onChange={(e) => setFormCatInv((p) => ({ ...p, nome: e.target.value }))}
                    className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                    placeholder="Ex: Óleos"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Descrição</label>
                  <input
                    type="text"
                    value={formCatInv.descricao}
                    onChange={(e) => setFormCatInv((p) => ({ ...p, descricao: e.target.value }))}
                    className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              {errorInv && <p className="mt-2 text-sm text-red-600">{errorInv}</p>}
              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={creatingInv} className="btn-primary rounded-lg px-4 py-2 text-sm">
                  {creatingInv ? "A guardar…" : "Guardar"}
                </button>
                <button type="button" onClick={() => { setShowNovaCatInv(false); setErrorInv(null); }} className="btn-secondary rounded-lg px-4 py-2 text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {showNovoItem && (
            <form onSubmit={handleCreateItem} className="mb-6 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[#171717]">Novo item</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Nome *</label>
                  <input
                    type="text"
                    value={formItem.nome}
                    onChange={(e) => setFormItem((p) => ({ ...p, nome: e.target.value }))}
                    className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                    placeholder="Ex: Óleo de massagem X"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Categoria</label>
                  <select value={formItem.categoriaId} onChange={(e) => setFormItem((p) => ({ ...p, categoriaId: e.target.value }))} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm">
                    <option value="">— Sem categoria —</option>
                    {catInv.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Unidade</label>
                  <select value={formItem.unidade} onChange={(e) => setFormItem((p) => ({ ...p, unidade: e.target.value }))} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm">
                    <option value="un">un</option>
                    <option value="L">L</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Quantidade inicial</label>
                  <input type="number" min={0} step={0.01} value={formItem.quantidadeAtual || ""} onChange={(e) => setFormItem((p) => ({ ...p, quantidadeAtual: parseFloat(e.target.value) || 0 }))} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Stock mínimo</label>
                  <input type="number" min={0} step={0.01} value={formItem.stockMinimo || ""} onChange={(e) => setFormItem((p) => ({ ...p, stockMinimo: parseFloat(e.target.value) || 0 }))} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Custo unitário (€)</label>
                  <input type="number" min={0} step={0.01} value={formItem.custoUnitario || ""} onChange={(e) => setFormItem((p) => ({ ...p, custoUnitario: parseFloat(e.target.value) || 0 }))} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm" />
                </div>
              </div>
              {errorInv && <p className="mt-2 text-sm text-red-600">{errorInv}</p>}
              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={creatingInv} className="btn-primary rounded-lg px-4 py-2 text-sm">{creatingInv ? "A guardar…" : "Guardar"}</button>
                <button type="button" onClick={() => { setShowNovoItem(false); setErrorInv(null); }} className="btn-secondary rounded-lg px-4 py-2 text-sm">Cancelar</button>
              </div>
            </form>
          )}

          <div className="mb-6 flex flex-wrap gap-4">
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="rounded-lg border border-[#ddd] px-3 py-2 text-sm">
              <option value="">Todas as categorias</option>
              {catInv.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select value={filtroAtivo} onChange={(e) => setFiltroAtivo(e.target.value)} className="rounded-lg border border-[#ddd] px-3 py-2 text-sm">
              <option value="todos">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

          {loadingInv ? (
            <div className="rounded-xl bg-white p-12 shadow-sm"><p className="text-center text-[#666]">A carregar…</p></div>
          ) : (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[#171717]">Itens</h2>
              {itens.length === 0 ? (
                <p className="text-sm text-[#666]">Nenhum item. Crie categorias e itens para começar.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#eee] bg-[#F5F5F5]">
                        <th className="p-3 font-medium text-[#171717]">Nome</th>
                        <th className="p-3 font-medium text-[#171717]">Categoria</th>
                        <th className="p-3 font-medium text-[#171717]">Stock</th>
                        <th className="p-3 font-medium text-[#171717]">Mín.</th>
                        <th className="p-3 font-medium text-[#171717]">Custo unit.</th>
                        <th className="p-3 font-medium text-[#171717]">Valor</th>
                        <th className="p-3 font-medium text-[#171717]">Estado</th>
                        <th className="p-3 font-medium text-[#171717]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((i) => {
                        const abaixo = i.stockMinimo > 0 && i.quantidadeAtual < i.stockMinimo;
                        return (
                          <tr key={i.id} className="border-b border-[#eee]">
                            <td className="p-3 font-medium text-[#171717]">{i.nome}</td>
                            <td className="p-3 text-[#666]">{catMap[i.categoriaId] ?? "—"}</td>
                            <td className="p-3">{i.quantidadeAtual} {i.unidade}</td>
                            <td className="p-3 text-[#666]">{i.stockMinimo} {i.unidade}</td>
                            <td className="p-3">{i.custoUnitario.toFixed(2)} €</td>
                            <td className="p-3">{(i.quantidadeAtual * i.custoUnitario).toFixed(2)} €</td>
                            <td className="p-3">
                              {abaixo && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Stock baixo</span>}
                              {!i.ativo && <span className="rounded bg-[#eee] px-2 py-0.5 text-xs text-[#666]">Inativo</span>}
                              {!abaixo && i.ativo && <span className="text-[#666]">—</span>}
                            </td>
                            <td className="p-3">
                              <Link href={`/admin/inventario/${i.id}`} className="text-sm text-[#b76e79] hover:underline">Ver detalhe</Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "custos" && (
        <>
          <div className="mb-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setShowNovaCatCusto(true)}
              className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#f5f5f5]"
            >
              + Nova categoria
            </button>
            <select value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="rounded-lg border border-[#ddd] px-3 py-2 text-sm">
              {mesesOptions.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
            </select>
          </div>

          {showNovaCatCusto && (
            <form onSubmit={handleCreateCatCusto} className="mb-6 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[#171717]">Nova categoria de custo</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Nome</label>
                  <input type="text" value={formCatCusto.nome} onChange={(e) => setFormCatCusto((p) => ({ ...p, nome: e.target.value }))} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm" placeholder="Ex: Renda, Eletricidade" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#666]">Tipo</label>
                  <select value={formCatCusto.tipo} onChange={(e) => setFormCatCusto((p) => ({ ...p, tipo: e.target.value as "fixo" | "variavel" }))} className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm">
                    <option value="fixo">Fixo</option>
                    <option value="variavel">Variável</option>
                  </select>
                </div>
              </div>
              {errorCusto && <p className="mt-2 text-sm text-red-600">{errorCusto}</p>}
              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={creatingCusto} className="btn-primary rounded-lg px-4 py-2 text-sm">{creatingCusto ? "A guardar…" : "Guardar"}</button>
                <button type="button" onClick={() => { setShowNovaCatCusto(false); setErrorCusto(null); }} className="btn-secondary rounded-lg px-4 py-2 text-sm">Cancelar</button>
              </div>
            </form>
          )}

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#666]">Total custos fixos</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{totalFixo.toFixed(2)} €</p>
            </div>
            <div className="rounded-xl border border-[#eee] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#666]">Total custos variáveis</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{totalVariavel.toFixed(2)} €</p>
            </div>
            <div className="rounded-xl border border-[#b76e79] bg-[#b76e79] p-5 text-white shadow-sm">
              <p className="text-sm opacity-90">Total {formatMonth(mesSelecionado)}</p>
              <p className="mt-1 text-3xl font-semibold">{totalGeral.toFixed(2)} €</p>
            </div>
          </div>

          {loadingCustos ? (
            <div className="rounded-xl bg-white p-12 shadow-sm"><p className="text-center text-[#666]">A carregar…</p></div>
          ) : (
            <div className="space-y-8">
              {catFixas.length > 0 && (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-[#171717]">Custos fixos</h2>
                  <div className="space-y-4">
                    {catFixas.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-[#eee] p-4">
                        <div className="min-w-[180px] font-medium text-[#171717]">{c.nome}</div>
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input type="number" min={0} step={0.01} value={formValores[c.id] ?? ""} onChange={(e) => setFormValores((p) => ({ ...p, [c.id]: parseFloat(e.target.value) || 0 }))} className="w-28 rounded-lg border border-[#ddd] px-3 py-2 text-sm" placeholder="0" />
                          <span className="text-sm text-[#666]">€</span>
                          <input type="text" value={formNotas[c.id] ?? ""} onChange={(e) => setFormNotas((p) => ({ ...p, [c.id]: e.target.value }))} className="min-w-[120px] flex-1 rounded-lg border border-[#ddd] px-3 py-2 text-sm" placeholder="Notas" />
                          <button type="button" onClick={() => handleGuardarCusto(c.id)} disabled={savingCusto === c.id} className="rounded-lg bg-[#b76e79] px-3 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60">{savingCusto === c.id ? "A guardar…" : "Guardar"}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {catVariaveis.length > 0 && (
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-[#171717]">Custos variáveis</h2>
                  <div className="space-y-4">
                    {catVariaveis.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-[#eee] p-4">
                        <div className="min-w-[180px] font-medium text-[#171717]">{c.nome}</div>
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <input type="number" min={0} step={0.01} value={formValores[c.id] ?? ""} onChange={(e) => setFormValores((p) => ({ ...p, [c.id]: parseFloat(e.target.value) || 0 }))} className="w-28 rounded-lg border border-[#ddd] px-3 py-2 text-sm" placeholder="0" />
                          <span className="text-sm text-[#666]">€</span>
                          <input type="text" value={formNotas[c.id] ?? ""} onChange={(e) => setFormNotas((p) => ({ ...p, [c.id]: e.target.value }))} className="min-w-[120px] flex-1 rounded-lg border border-[#ddd] px-3 py-2 text-sm" placeholder="Notas" />
                          <button type="button" onClick={() => handleGuardarCusto(c.id)} disabled={savingCusto === c.id} className="rounded-lg bg-[#b76e79] px-3 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60">{savingCusto === c.id ? "A guardar…" : "Guardar"}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {catCustos.length === 0 && (
                <div className="rounded-xl bg-white p-8 shadow-sm">
                  <p className="text-center text-[#666]">Crie categorias de custos (fixos e variáveis) para começar a registar os custos mensais.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
