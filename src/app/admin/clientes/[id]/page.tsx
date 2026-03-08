"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminData } from "@/contexts/AdminDataContext";
import {
  getServicosAdmin,
  getHorarioConfig,
  getMarcacoesByDate,
  getSlotsDisponiveis,
} from "@/lib/firebase";
import { SlotPicker } from "@/components/ui/SlotPicker";
import { CancelarMarcacaoModal } from "@/components/admin/CancelarMarcacaoModal";
import type { Cliente } from "@/types";
import type { HorarioConfig } from "@/lib/firebase";
import type { MetodoPagamento } from "@/types";

const METODOS_PAGAMENTO: { value: MetodoPagamento; label: string }[] = [
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "MB Way", label: "MB Way" },
  { value: "Multibanco", label: "Multibanco" },
  { value: "Cartão", label: "Cartão" },
];

function formatDate(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Componente extraído para evitar recriação e perda de foco ao escrever */
function EditableField({
  label,
  value,
  type = "text",
  options,
  isEditing,
  editValue,
  saving,
  onEdit,
  onEditValueChange,
  onSave,
  onCancel,
}: {
  label: string;
  value: string | boolean | undefined;
  type?: "text" | "textarea" | "date" | "yn" | "select";
  options?: { value: string; label: string }[];
  isEditing: boolean;
  editValue: string;
  saving: boolean | null;
  onEdit: () => void;
  onEditValueChange: (v: string) => void;
  onSave: (val: string | boolean | null) => void;
  onCancel: () => void;
}) {
  const displayValue = value === undefined || value === null ? "" : String(value);
  const ynDisplay = value === true ? "Sim" : value === false ? "Não" : "—";
  return (
    <div className="border-b border-[#eee] py-2">
      <span className="block text-xs text-[#666]">{label}</span>
      {isEditing ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {type === "textarea" ? (
            <textarea
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="min-h-[80px] w-full rounded-lg border border-[#ddd] px-2 py-1.5 text-sm"
              rows={3}
              autoFocus
            />
          ) : type === "yn" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSave(true)}
                className={`rounded px-2 py-1 text-sm ${value === true ? "bg-[#b76e79] text-white" : "bg-[#eee] text-[#666] hover:bg-[#ddd]"}`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => onSave(false)}
                className={`rounded px-2 py-1 text-sm ${value === false ? "bg-[#b76e79] text-white" : "bg-[#eee] text-[#666] hover:bg-[#ddd]"}`}
              >
                Não
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-[#ddd] px-2 py-1 text-sm text-[#666]"
              >
                Cancelar
              </button>
            </div>
          ) : type === "select" && options ? (
            <select
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="rounded-lg border border-[#ddd] px-2 py-1.5 text-sm"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={type === "date" ? "date" : "text"}
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="rounded-lg border border-[#ddd] px-2 py-1.5 text-sm"
              autoFocus
            />
          )}
          {type !== "yn" && (
            <>
              <button
                type="button"
                onClick={() => onSave(type === "select" ? (editValue || null) : editValue)}
                disabled={!!saving}
                className="rounded bg-[#b76e79] px-2 py-1 text-sm text-white hover:bg-[#a65d68] disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-[#ddd] px-2 py-1 text-sm text-[#666]"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          className="group mt-0.5 flex cursor-pointer items-center justify-between"
          onClick={onEdit}
        >
          <span className="text-sm text-[#171717]">
            {type === "yn" ? ynDisplay : displayValue || "—"}
          </span>
          <span className="text-xs text-[#999] opacity-0 group-hover:opacity-100">editar</span>
        </div>
      )}
    </div>
  );
}

export default function AdminClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const { marcacoes, refresh, updateMarcacaoNotas, updateMarcacaoPagamento, updateMarcacaoStatus } = useAdminData();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showNovaMarcacao, setShowNovaMarcacao] = useState(false);
  const [servicos, setServicos] = useState<{ id: string; nome: string; duracaoMinutos: number; preco: number }[]>([]);
  const [horarioConfig, setHorarioConfig] = useState<HorarioConfig | null>(null);
  const [formMarcacao, setFormMarcacao] = useState({
    servicoId: "",
    data: "",
    horaInicio: "",
    preferenciaPagamento: "na_sessao" as "na_sessao" | "agora",
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMarcacao, setSuccessMarcacao] = useState(false);
  const [editingNotas, setEditingNotas] = useState<{ id: string; value: string } | null>(null);
  const [pagamentoMenuId, setPagamentoMenuId] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelarMarcacaoId, setCancelarMarcacaoId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const clientMarcacoes = cliente
    ? marcacoes
        .filter((m) => (m.clienteEmail ?? "").toLowerCase() === (cliente.email ?? "").toLowerCase())
        .sort((a, b) => {
          const cmp = b.data.localeCompare(a.data);
          return cmp !== 0 ? cmp : b.horaInicio.localeCompare(a.horaInicio);
        })
    : [];
  const pastSessions = clientMarcacoes.filter((m) => m.status === "concluida" || (m.data < today && m.status !== "cancelada"));
  const futureSessions = clientMarcacoes.filter((m) => m.data >= today && !["cancelada"].includes(m.status));
  const totalFaturado = pastSessions
    .filter((m) => m.pagamentoRecebido)
    .reduce((sum, m) => sum + (m.preco ?? 0), 0);
  const totalRealizadas = clientMarcacoes.filter((m) => m.status === "concluida").length;
  const totalCanceladas = clientMarcacoes.filter((m) => m.status === "cancelada").length;
  const totalReagendadas = clientMarcacoes.reduce((s, m) => s + (m.reagendadoCount ?? 0), 0);
  const selectedServico = servicos.find((s) => s.id === formMarcacao.servicoId);

  useEffect(() => {
    if (id) void refresh(true);
  }, [id, refresh]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) {
      setLoading(false);
      return;
    }
    tokenPromise.then(async (tok) => {
      if (!tok || cancelled) return;
      try {
      const res = await fetch(`/api/admin/clientes/${id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as Cliente;
          setCliente(data);
        } else {
          setCliente(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }).catch(() => {
      setCliente(null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, user]);


  useEffect(() => {
    let cancelled = false;
    Promise.all([getServicosAdmin(), getHorarioConfig()])
      .then(([list, config]) => {
        if (cancelled) return;
        setServicos(list);
        setHorarioConfig(config ?? null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!formMarcacao.data || !selectedServico) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setFormMarcacao((f) => ({ ...f, horaInicio: "" }));
    getMarcacoesByDate(formMarcacao.data)
      .then((ocupados) => {
        const disp = getSlotsDisponiveis(
          formMarcacao.data,
          selectedServico.duracaoMinutos,
          ocupados,
          horarioConfig ?? undefined
        );
        setSlots(disp);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [formMarcacao.data, selectedServico, horarioConfig]);

  const handleSaveCliente = async (field: string, value: unknown) => {
    if (!cliente || !id) return;
    setSaving(field);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch(`/api/admin/clientes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar");
      setCliente((prev) => (prev ? { ...prev, [field]: value } : null));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
      setEditField(null);
    }
  };

  const handleSaveMarcacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente || !selectedServico || !formMarcacao.data || !formMarcacao.horaInicio) {
      setError("Preencha serviço, data e hora.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch("/api/admin/marcacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clienteNome: cliente.nome,
          clienteEmail: cliente.email,
          clienteTelefone: cliente.telefone ?? "",
          servicoId: selectedServico.id,
          servicoNome: selectedServico.nome,
          duracaoMinutos: selectedServico.duracaoMinutos,
          preco: selectedServico.preco,
          data: formMarcacao.data,
          horaInicio: formMarcacao.horaInicio,
          preferenciaPagamento: formMarcacao.preferenciaPagamento,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar marcação");
      setSuccessMarcacao(true);
      setFormMarcacao({ servicoId: "", data: "", horaInicio: "", preferenciaPagamento: "na_sessao" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar marcação.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCliente = async () => {
    if (!cliente || !id) return;
    setDeleting(true);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Sessão expirada");
      const res = await fetch(`/api/admin/clientes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao eliminar");
      router.push("/admin/clientes");
    } catch (e) {
      console.error(e);
      setDeleting(false);
    }
  };

  const saveNotas = async () => {
    if (!editingNotas) return;
    try {
      await updateMarcacaoNotas(editingNotas.id, editingNotas.value || undefined);
      setEditingNotas(null);
    } catch {
      setEditingNotas(null);
    }
  };

  const isBirthdaySoon = cliente?.dataNascimento
    ? (() => {
        const [y, m, d] = cliente.dataNascimento.split("-").map(Number);
        const today = new Date();
        const thisYear = new Date(today.getFullYear(), (m ?? 1) - 1, d ?? 1);
        const diff = (thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 1;
      })()
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-[#666]">A carregar cliente…</p>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div>
        <p className="text-[#666]">Cliente não encontrado.</p>
        <Link href="/admin/clientes" className="mt-4 block text-[#b76e79] hover:underline">
          ← Voltar à lista
        </Link>
      </div>
    );
  }

  const ef = (field: string, label: string, value: string | boolean | undefined, type: "text" | "textarea" | "date" | "yn" | "select" = "text", opts?: { value: string; label: string }[]) => (
    <EditableField
      key={field}
      label={label}
      value={value}
      type={type}
      options={opts}
      isEditing={editField === field}
      editValue={editValue}
      saving={saving === field}
      onEdit={() => {
        setEditField(field);
        setEditValue(type === "yn" ? String(value ?? "") : (value === undefined || value === null ? "" : String(value)));
      }}
      onEditValueChange={setEditValue}
      onSave={(v) => handleSaveCliente(field, v ?? undefined)}
      onCancel={() => { setEditField(null); setEditValue(""); }}
    />
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/clientes" className="text-sm text-[#b76e79] hover:underline">
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[#171717]">{cliente.nome}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowNovaMarcacao(!showNovaMarcacao)}
            className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
          >
            {showNovaMarcacao ? "Ocultar" : "+ Nova marcação"}
          </button>
          <button
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Eliminar cliente (RGPD)
          </button>
        </div>
      </div>

      {successMarcacao && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-800">
          Marcação criada com sucesso.
          <button
            type="button"
            onClick={() => setSuccessMarcacao(false)}
            className="ml-2 text-green-600 underline"
          >
            Fechar
          </button>
        </div>
      )}

      {showNovaMarcacao && (
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Nova marcação</h2>
          <p className="mb-4 text-sm text-[#666]">
            Cliente: <strong>{cliente.nome}</strong> · {cliente.email}
            {cliente.telefone && ` · ${cliente.telefone}`}
          </p>
          <form onSubmit={handleSaveMarcacao} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#171717]">Serviço</label>
              <select
                required
                value={formMarcacao.servicoId}
                onChange={(e) => setFormMarcacao((f) => ({ ...f, servicoId: e.target.value, horaInicio: "" }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              >
                <option value="">Selecione um serviço</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} · {s.duracaoMinutos} min · {s.preco} €
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Data</label>
              <input
                type="date"
                required
                min={today}
                value={formMarcacao.data}
                onChange={(e) => setFormMarcacao((f) => ({ ...f, data: e.target.value, horaInicio: "" }))}
                className="mt-1 rounded-lg border border-[#ddd] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#171717]">Hora de início</label>
              {formMarcacao.data && selectedServico ? (
                <div className="mt-1">
                  <SlotPicker
                    slots={slots}
                    value={formMarcacao.horaInicio}
                    onChange={(h) => setFormMarcacao((f) => ({ ...f, horaInicio: h }))}
                    loading={loadingSlots}
                    emptyMessage={`Sem horários disponíveis.`}
                    variant="admin"
                    showPeriodTabs={slots.length > 8}
                  />
                </div>
              ) : (
                <p className="mt-1 text-sm text-[#666]">Selecione serviço e data primeiro.</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[#171717]">Forma de pagamento</p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormMarcacao((f) => ({ ...f, preferenciaPagamento: "na_sessao" }))}
                  className={`rounded-lg border-2 px-3 py-2 text-sm ${formMarcacao.preferenciaPagamento === "na_sessao" ? "border-[#b76e79] bg-[#b76e79]/10 text-[#b76e79]" : "border-[#ddd] text-[#666]"}`}
                >
                  Na sessão
                </button>
                <button
                  type="button"
                  onClick={() => setFormMarcacao((f) => ({ ...f, preferenciaPagamento: "agora" }))}
                  className={`rounded-lg border-2 px-3 py-2 text-sm ${formMarcacao.preferenciaPagamento === "agora" ? "border-[#b76e79] bg-[#b76e79]/10 text-[#b76e79]" : "border-[#ddd] text-[#666]"}`}
                >
                  Agora (MB Way)
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !formMarcacao.servicoId || !formMarcacao.data || !formMarcacao.horaInicio}
              className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60"
            >
              {submitting ? "A guardar…" : "Criar marcação"}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Informação</h2>
          {ef("nome", "Nome Completo", cliente.nome)}
          {ef("telefone", "Telemóvel", cliente.telefone)}
          {ef("email", "Email", cliente.email)}
          {ef("dataNascimento", "Data Nascimento", cliente.dataNascimento, "date")}
          {cliente.dataNascimento && isBirthdaySoon && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
              🎂 Aniversário em breve – enviar parabéns + presente 50% desconto
            </div>
          )}
          {ef("clienteDesde", "Cliente desde", cliente.clienteDesde, "date")}
          {ef("origem", "Origem", cliente.origem)}
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">Saúde</h2>
          {ef("problemasSaude", "Problemas de saúde relevantes", cliente.problemasSaude, "yn")}
          {ef("medicacao", "Medicação", cliente.medicacao, "yn")}
          {ef("contraindicatedoes", "Contraindicações", cliente.contraindicatedoes, "yn")}
          {ef("sensibilidadeDor", "Sensibilidade à dor", cliente.sensibilidadeDor, "select", [
            { value: "", label: "—" },
            { value: "baixa", label: "Baixa" },
            { value: "media", label: "Média" },
            { value: "alta", label: "Alta" },
          ])}
          {ef("preferenciasAmbiente", "Preferências ambiente", cliente.preferenciasAmbiente, "yn")}
        </section>
      </div>

      <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[#171717]">Histórico</h2>
        <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-[#eee] bg-[#fafafa] p-4">
          <div>
            <span className="text-xs text-[#666]">Cliente desde</span>
            <p className="font-medium text-[#171717]">{cliente.clienteDesde ? formatDate(cliente.clienteDesde) : "—"}</p>
          </div>
          <div>
            <span className="text-xs text-[#666]">Total sessões realizadas</span>
            <p className="font-medium text-[#171717]">{totalRealizadas}</p>
          </div>
          <div>
            <span className="text-xs text-[#666]">Total sessões canceladas</span>
            <p className="font-medium text-[#171717]">{totalCanceladas}</p>
          </div>
          <div>
            <span className="text-xs text-[#666]">Total sessões reagendadas</span>
            <p className="font-medium text-[#171717]">{totalReagendadas}</p>
          </div>
          <div>
            <span className="text-xs text-[#666]">Marcações futuras</span>
            <p className="font-medium text-[#171717]">{futureSessions.length}</p>
          </div>
          <div>
            <span className="text-xs text-[#666]">Total faturado</span>
            <p className="font-medium text-[#171717]">{totalFaturado} €</p>
          </div>
        </div>
        <div className="space-y-4">
          {clientMarcacoes.length === 0 ? (
            <p className="text-sm text-[#666]">Sem marcações registadas.</p>
          ) : (
            clientMarcacoes.map((m) => (
              <div key={m.id} className="rounded-lg border border-[#eee] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#171717]">{m.servicoNome}</span>
                  <span className="text-sm text-[#666]">
                    {formatDateShort(m.data)} · {m.horaInicio} · {m.preco} €
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === "cancelada"
                          ? "bg-red-100 text-red-800"
                          : m.status === "concluida"
                            ? "bg-green-100 text-green-800"
                            : m.status === "confirmada"
                              ? "bg-[#f0f0f0] text-[#555]"
                              : m.pagamentoRecebido
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {m.status === "cancelada"
                        ? "Cancelada"
                        : m.status === "concluida"
                          ? "Concluída"
                          : m.status === "confirmada"
                            ? "Agendada"
                            : m.pagamentoRecebido
                              ? "Pago"
                              : "Pendente"}
                    </span>
                  </span>
                </div>
                {!m.pagamentoRecebido && m.status !== "cancelada" && (
                  <div className="relative mt-2 inline-block">
                    <button
                      type="button"
                      onClick={() => setPagamentoMenuId(pagamentoMenuId === m.id ? null : m.id)}
                      className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200"
                    >
                      Marcar pago ▾
                    </button>
                    {pagamentoMenuId === m.id && (
                      <>
                        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setPagamentoMenuId(null)} />
                        <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-[#ddd] bg-white py-1 shadow-lg">
                          {METODOS_PAGAMENTO.map(({ value, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                updateMarcacaoPagamento(m.id, {
                                  pagamentoRecebido: true,
                                  metodoPagamento: value,
                                  ...(m.status === "pendente" && { status: "confirmada" }),
                                });
                                setPagamentoMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-[#f5f5f5]"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {editingNotas?.id === m.id ? (
                  <div className="mt-3">
                    <textarea
                      value={editingNotas.value}
                      onChange={(e) => setEditingNotas((p) => (p ? { ...p, value: e.target.value } : null))}
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Notas da sessão…"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={saveNotas}
                        className="rounded-lg bg-[#b76e79] px-3 py-1.5 text-sm text-white"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNotas(null)}
                        className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#666]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    {m.notasSessao ? (
                      <p className="whitespace-pre-wrap text-sm text-[#666]">{m.notasSessao}</p>
                    ) : (
                      <p className="text-sm italic text-[#999]">Sem notas</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingNotas({ id: m.id, value: m.notasSessao ?? "" })}
                      className="mt-1 text-sm text-[#b76e79] hover:underline"
                    >
                      {m.notasSessao ? "Editar notas" : "Adicionar notas"}
                    </button>
                  </div>
                )}
                {(m.status === "pendente" || m.status === "confirmada") && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setCancelarMarcacaoId(m.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Cancelar marcação
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[#171717]">Observações</h2>
        {ef("preferencias", "Preferências (óleos, aromas, músicas)", cliente.preferencias, "textarea")}
        {ef("reacoes", "Reações (a produtos e técnicas usadas)", cliente.reacoes, "textarea")}
        {ef("horarioPreferido", "Horário (disponibilidade preferida)", cliente.horarioPreferido, "textarea")}
        {ef("notasPessoais", "Notas pessoais", cliente.notasPessoais, "textarea")}
      </section>

      {cancelarMarcacaoId && (() => {
        const m = clientMarcacoes.find((x) => x.id === cancelarMarcacaoId);
        if (!m) return null;
        return (
          <CancelarMarcacaoModal
            marcacaoResumo={{
              clienteNome: m.clienteNome,
              servicoNome: m.servicoNome,
              data: m.data,
              horaInicio: m.horaInicio,
            }}
            onClose={() => setCancelarMarcacaoId(null)}
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

      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-[#171717]">Eliminar cliente (RGPD)</h3>
            <p className="mt-2 text-sm text-[#666]">
              Tem a certeza que deseja eliminar <strong>{cliente.nome}</strong> e todos os seus dados pessoais?
              Esta ação é irreversível. O registo de cliente será removido e as marcações serão anonimizadas.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleDeleteCliente}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "A eliminar…" : "Sim, eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
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
