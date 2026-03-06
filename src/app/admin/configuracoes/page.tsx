"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  getServicosAdmin,
  getHorarioConfig,
  setHorarioConfig,
  getSiteConfig,
  setSiteConfig,
  invalidate,
  CACHE_KEYS,
  createServico,
  updateServico,
  deleteServico,
  storage,
} from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Servico } from "@/types";
import type { HorarioConfig, DiaSemanaConfig, FeriadoConfig, SiteConfig } from "@/lib/firebase/app-settings";

const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ensureDiasSemana(dias?: DiaSemanaConfig[]): DiaSemanaConfig[] {
  if (Array.isArray(dias) && dias.length === 7) {
    return dias.map((d) => ({
      diaSemana: Number(d.diaSemana ?? 0),
      abre: typeof d.abre === "string" ? d.abre : "09:00",
      fecha: typeof d.fecha === "string" ? d.fecha : "18:00",
      fechado: Boolean(d.fechado),
    }));
  }
  const base = { abre: "09:00", fecha: "18:00", fechado: false };
  return [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => {
    const found = dias?.find((d) => Number(d.diaSemana) === diaSemana);
    return {
      ...base,
      diaSemana,
      ...found,
      fechado: found ? Boolean(found.fechado) : false,
    };
  });
}

export default function AdminConfiguracoesPage() {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [horario, setHorario] = useState<HorarioConfig | null>(null);
  const [savingHorario, setSavingHorario] = useState(false);
  const [horarioForm, setHorarioForm] = useState<HorarioConfig>({
    bufferMinutes: 15,
    startHour: 9,
    endHour: 18,
    diasSemana: ensureDiasSemana(),
    feriados: [],
  });
  const [siteConfig, setSiteConfigState] = useState<SiteConfig>({});
  const [siteForm, setSiteForm] = useState<SiteConfig>({});
  const [savingSite, setSavingSite] = useState(false);

  // Serviços: lista + formulário (novo ou edição)
  const [editingServicoId, setEditingServicoId] = useState<string | "new" | null>(null);
  const [servicoForm, setServicoForm] = useState<{
    nome: string;
    descricao: string;
    duracaoMinutos: number;
    preco: number;
    ativo: boolean;
    ordem: number;
    categoria: string;
    imagemUrl: string;
    destaque: boolean;
  }>({
    nome: "",
    descricao: "",
    duracaoMinutos: 60,
    preco: 0,
    ativo: true,
    ordem: 0,
    categoria: "",
    imagemUrl: "",
    destaque: false,
  });
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [savingServico, setSavingServico] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadImageError, setUploadImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregamento progressivo — cada secção carrega independentemente
  const [loadingHorario, setLoadingHorario] = useState(true);
  const [loadingSite, setLoadingSite] = useState(true);
  const [loadingServicos, setLoadingServicos] = useState(true);
  const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "erro"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHorarioConfig()
      .then((h) => {
        if (cancelled) return;
        setHorario(h);
        setHorarioForm({
          ...h,
          bufferMinutes: h.bufferMinutes ?? 15,
          diasSemana: ensureDiasSemana(h.diasSemana),
          feriados: Array.isArray(h.feriados) ? h.feriados : [],
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHorario(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSiteConfig()
      .then((site) => {
        if (cancelled) return;
        setSiteConfigState(site);
        setSiteForm(site);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSite(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getServicosAdmin()
      .then((list) => { if (!cancelled) setServicos(list); })
      .catch(() => { if (!cancelled) setServicos([]); })
      .finally(() => { if (!cancelled) setLoadingServicos(false); });
    return () => { cancelled = true; };
  }, []);

  const showMessage = (type: "ok" | "erro", text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 5000);
  };

  const handleSaveHorario = async () => {
    const dias = horarioForm.diasSemana ?? [];
    const invalid = dias.some(
      (d) => !d.fechado && d.abre >= d.fecha
    );
    if (invalid) {
      showMessage("erro", "Em cada dia aberto, a hora de abertura deve ser anterior à de fecho.");
      return;
    }
    setSavingHorario(true);
    setSaveMessage(null);
    try {
      const token = await user?.getIdToken?.();
      const tryApi = token
        ? (async () => {
            const res = await fetch("/api/admin/config", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ type: "horario", ...horarioForm }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error ?? `API ${res.status}`);
            }
            invalidate(CACHE_KEYS.horario);
          })
        : null;
      if (tryApi) {
        try {
          await tryApi();
        } catch (apiErr) {
          const msg = apiErr instanceof Error ? apiErr.message : "";
          if (msg.includes("503") || msg.includes("Firebase Admin") || msg.includes("configurado")) {
            await setHorarioConfig(horarioForm);
          } else {
            throw apiErr;
          }
        }
      } else {
        await setHorarioConfig(horarioForm);
      }
      setHorario(horarioForm);
      showMessage("ok", "Horário guardado com sucesso.");
    } catch (e) {
      console.error("handleSaveHorario", e);
      showMessage("erro", e instanceof Error ? e.message : "Erro ao guardar. Verifique as regras do Firestore e variáveis de ambiente.");
    } finally {
      setSavingHorario(false);
    }
  };

  const setDiaSemana = (index: number, patch: Partial<DiaSemanaConfig>) => {
    const dias = [...(horarioForm.diasSemana ?? ensureDiasSemana())];
    if (dias[index]) dias[index] = { ...dias[index], ...patch };
    setHorarioForm((f) => ({ ...f, diasSemana: dias }));
  };

  const addFeriado = () => {
    const next: FeriadoConfig = { data: new Date().toISOString().slice(0, 10), fechado: true };
    setHorarioForm((f) => ({ ...f, feriados: [...(f.feriados ?? []), next] }));
  };

  const updateFeriado = (index: number, patch: Partial<FeriadoConfig>) => {
    const feriados = [...(horarioForm.feriados ?? [])];
    if (feriados[index]) feriados[index] = { ...feriados[index], ...patch };
    setHorarioForm((f) => ({ ...f, feriados }));
  };

  const removeFeriado = (index: number) => {
    setHorarioForm((f) => ({
      ...f,
      feriados: (f.feriados ?? []).filter((_, i) => i !== index),
    }));
  };

  const handleSaveSite = async () => {
    setSavingSite(true);
    setSaveMessage(null);
    try {
      const token = await user?.getIdToken?.();
      const tryApi = token
        ? (async () => {
            const res = await fetch("/api/admin/config", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ type: "site", ...siteForm }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error ?? `API ${res.status}`);
            }
            invalidate(CACHE_KEYS.site);
          })
        : null;
      if (tryApi) {
        try {
          await tryApi();
        } catch (apiErr) {
          const msg = apiErr instanceof Error ? apiErr.message : "";
          if (msg.includes("503") || msg.includes("Firebase Admin") || msg.includes("configurado")) {
            await setSiteConfig(siteForm);
          } else {
            throw apiErr;
          }
        }
      } else {
        await setSiteConfig(siteForm);
      }
      setSiteConfigState(siteForm);
      showMessage("ok", "Configurações guardadas com sucesso.");
    } catch (e) {
      console.error("handleSaveSite", e);
      showMessage("erro", e instanceof Error ? e.message : "Erro ao guardar. Verifique as regras do Firestore e variáveis de ambiente.");
    } finally {
      setSavingSite(false);
    }
  };

  const openNewServico = () => {
    setUploadImageError(null);
    setEditingServicoId("new");
    const nextOrder = Math.max(0, ...servicos.map((s) => s.ordem ?? 0)) + 1;
    setServicoForm({
      nome: "",
      descricao: "",
      duracaoMinutos: 60,
      preco: 0,
      ativo: true,
      ordem: nextOrder,
      categoria: "",
      imagemUrl: "",
      destaque: false,
    });
  };

  const openEditServico = (s: Servico) => {
    setUploadImageError(null);
    setEditingServicoId(s.id);
    setServicoForm({
      nome: s.nome,
      descricao: s.descricao ?? "",
      duracaoMinutos: s.duracaoMinutos,
      preco: s.preco,
      ativo: s.ativo,
      ordem: s.ordem ?? 0,
      categoria: s.categoria ?? "",
      imagemUrl: s.imagemUrl ?? "",
      destaque: s.destaque ?? false,
    });
  };

  const closeServicoForm = () => {
    setEditingServicoId(null);
    setUploadImageError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setUploadImageError("Selecione um ficheiro de imagem (JPG, PNG, etc.).");
      return;
    }
    if (!storage) {
      setUploadImageError("Storage do Firebase não está configurado.");
      return;
    }
    setUploadImageError(null);
    setUploadingImage(true);
    try {
      const path = `servicos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setServicoForm((f) => ({ ...f, imagemUrl: url }));
    } catch (err) {
      setUploadImageError(err instanceof Error ? err.message : "Falha ao enviar imagem. Verifique as regras do Storage.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
      fileInputRef.current?.value && (fileInputRef.current.value = "");
    }
  };

  const handleSaveServico = async () => {
    if (!servicoForm.nome.trim()) {
      showMessage("erro", "Nome é obrigatório.");
      return;
    }
    setSavingServico(true);
    setSaveMessage(null);
    const formToSave = {
      ...servicoForm,
      imagemUrl: (servicoForm.imagemUrl ?? "").trim() || undefined,
    };
    try {
      const token = await user?.getIdToken?.();
      const callApi = token
        ? async () => {
            if (editingServicoId === "new") {
              const res = await fetch("/api/admin/servicos", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: "create", servico: formToSave }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? `API ${res.status}`);
              }
            } else if (editingServicoId) {
              const res = await fetch("/api/admin/servicos", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: "update", id: editingServicoId, servico: formToSave }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? `API ${res.status}`);
              }
            }
            invalidate(CACHE_KEYS.servicos);
            invalidate(CACHE_KEYS.servicosAdmin);
          }
        : null;
      if (callApi) {
        try {
          await callApi();
        } catch (apiErr) {
          const msg = apiErr instanceof Error ? apiErr.message : "";
          if (msg.includes("503") || msg.includes("Firebase Admin") || msg.includes("configurado")) {
            if (editingServicoId === "new") {
              await createServico(formToSave);
            } else if (editingServicoId) {
              await updateServico(editingServicoId, formToSave);
            }
            invalidate(CACHE_KEYS.servicos);
            invalidate(CACHE_KEYS.servicosAdmin);
          } else {
            throw apiErr;
          }
        }
      } else {
        if (editingServicoId === "new") {
          await createServico(formToSave);
        } else if (editingServicoId) {
          await updateServico(editingServicoId, formToSave);
        }
      }
      const list = await getServicosAdmin();
      setServicos(list);
      if (typeof editingServicoId === "string" && editingServicoId !== "new") {
        setFailedImageIds((prev) => {
          const next = new Set(prev);
          next.delete(editingServicoId);
          return next;
        });
      }
      closeServicoForm();
      showMessage("ok", "Serviço guardado com sucesso.");
    } catch (e) {
      showMessage("erro", e instanceof Error ? e.message : "Erro ao guardar serviço. Verifique as regras do Firestore.");
    } finally {
      setSavingServico(false);
    }
  };

  const handleDeleteServico = async (id: string) => {
    if (!confirm("Desativar este serviço? Deixará de aparecer na lista pública.")) return;
    setDeletingId(id);
    setSaveMessage(null);
    try {
      const token = await user?.getIdToken?.();
      const tryApi = token
        ? async () => {
            const res = await fetch("/api/admin/servicos", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action: "delete", id }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error ?? `API ${res.status}`);
            }
            invalidate(CACHE_KEYS.servicos);
            invalidate(CACHE_KEYS.servicosAdmin);
          }
        : null;
      if (tryApi) {
        try {
          await tryApi();
        } catch (apiErr) {
          const msg = apiErr instanceof Error ? apiErr.message : "";
          if (msg.includes("503") || msg.includes("Firebase Admin") || msg.includes("configurado")) {
            await deleteServico(id);
            invalidate(CACHE_KEYS.servicos);
            invalidate(CACHE_KEYS.servicosAdmin);
          } else {
            throw apiErr;
          }
        }
      } else {
        await deleteServico(id);
      }
      const list = await getServicosAdmin();
      setServicos(list);
      if (editingServicoId === id) closeServicoForm();
    } catch (e) {
      showMessage("erro", e instanceof Error ? e.message : "Erro ao desativar.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#171717]">Configurações</h1>
        <Link href="/" className="text-sm text-[#b76e79] hover:underline">
          ← Voltar ao site
        </Link>
      </div>

      {saveMessage && (
        <div
          role="alert"
          className={`mb-6 rounded-lg px-4 py-3 ${
            saveMessage.type === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      <div className="space-y-8">
          {/* Geral / Site */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-[#171717]">
              Geral — Nome e contacto
            </h2>
            {loadingSite ? (
              <p className="text-[#666]">A carregar…</p>
            ) : (
            <>
            <p className="mb-4 text-sm text-[#666]">
              Dados do negócio para uso no site (rodapé, contactos, etc.).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#666]">Nome do negócio</label>
                <input
                  type="text"
                  value={siteForm.nomeEmpresa ?? ""}
                  onChange={(e) => setSiteForm((f) => ({ ...f, nomeEmpresa: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                  placeholder="Ex: MarDelux"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#666]">Email de contacto</label>
                <input
                  type="email"
                  value={siteForm.email ?? ""}
                  onChange={(e) => setSiteForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                  placeholder="contacto@exemplo.pt"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#666]">Telefone</label>
                <input
                  type="tel"
                  value={siteForm.telefone ?? ""}
                  onChange={(e) => setSiteForm((f) => ({ ...f, telefone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                  placeholder="+351 ..."
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSaveSite}
                disabled={savingSite}
                className="rounded-full bg-[#b76e79] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a65d68] disabled:opacity-60"
              >
                {savingSite ? "A guardar…" : "Guardar"}
              </button>
            </div>
            </>
            )}
          </section>

          {/* Horário de funcionamento */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-[#171717]">
              Horário de funcionamento
            </h2>
            {loadingHorario ? (
              <p className="text-[#666]">A carregar…</p>
            ) : (
            <>
            <p className="mb-4 text-sm text-[#666]">
              Defina em que dias abre e o horário de cada dia. Buffer entre sessões: intervalo mínimo entre o fim de uma e o início da seguinte.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs font-medium text-[#666]">Buffer entre sessões (min)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={horarioForm.bufferMinutes}
                  onChange={(e) => setHorarioForm((f) => ({ ...f, bufferMinutes: Number(e.target.value) || 0 }))}
                  className="mt-1 w-20 rounded-lg border border-[#ddd] px-2 py-1.5 text-[#171717]"
                />
              </div>
            </div>

            <h3 className="mb-2 text-sm font-medium text-[#171717]">Por dia da semana</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-[#eee] text-left text-[#666]">
                    <th className="pb-2 pr-4">Dia</th>
                    <th className="pb-2 pr-4">Aberto</th>
                    <th className="pb-2 pr-2">Abertura</th>
                    <th className="pb-2 pr-2">Fecho</th>
                  </tr>
                </thead>
                <tbody>
                  {(horarioForm.diasSemana ?? ensureDiasSemana()).map((dia, index) => (
                    <tr key={dia.diaSemana} className="border-b border-[#eee]">
                      <td className="py-2 pr-4 font-medium">{NOMES_DIAS[dia.diaSemana]}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="checkbox"
                          checked={!dia.fechado}
                          onChange={(e) => setDiaSemana(index, { fechado: !e.target.checked })}
                          className="rounded border-[#ddd] text-[#b76e79]"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="time"
                          value={dia.abre}
                          disabled={!!dia.fechado}
                          onChange={(e) => setDiaSemana(index, { abre: e.target.value })}
                          className="w-28 rounded border border-[#ddd] px-2 py-1 text-[#171717] disabled:bg-[#f5f5f5]"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="time"
                          value={dia.fecha}
                          disabled={!!dia.fechado}
                          onChange={(e) => setDiaSemana(index, { fecha: e.target.value })}
                          className="w-28 rounded border border-[#ddd] px-2 py-1 text-[#171717] disabled:bg-[#f5f5f5]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-6 mb-2 text-sm font-medium text-[#171717]">Feriados e exceções</h3>
            <p className="mb-3 text-xs text-[#666]">
              Adicione datas em que está fechado ou com horário diferente (ex.: 25 de dezembro, Ano Novo).
            </p>
            <ul className="space-y-2">
              {(horarioForm.feriados ?? []).map((f, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#eee] p-2">
                  <input
                    type="date"
                    value={f.data}
                    onChange={(e) => updateFeriado(index, { data: e.target.value })}
                    className="rounded border border-[#ddd] px-2 py-1 text-[#171717]"
                  />
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={f.fechado}
                      onChange={(e) => updateFeriado(index, { fechado: e.target.checked })}
                      className="rounded border-[#ddd] text-[#b76e79]"
                    />
                    Fechado
                  </label>
                  {!f.fechado && (
                    <>
                      <input
                        type="time"
                        value={f.abre ?? "09:00"}
                        onChange={(e) => updateFeriado(index, { abre: e.target.value })}
                        className="rounded border border-[#ddd] px-2 py-1 text-[#171717]"
                      />
                      <span className="text-[#666]">–</span>
                      <input
                        type="time"
                        value={f.fecha ?? "18:00"}
                        onChange={(e) => updateFeriado(index, { fecha: e.target.value })}
                        className="rounded border border-[#ddd] px-2 py-1 text-[#171717]"
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFeriado(index)}
                    className="ml-auto text-sm text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addFeriado}
              className="mt-2 rounded-lg border border-dashed border-[#ccc] px-3 py-2 text-sm text-[#666] hover:border-[#b76e79] hover:text-[#b76e79]"
            >
              + Adicionar data
            </button>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleSaveHorario}
                disabled={savingHorario}
                className="rounded-full bg-[#b76e79] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a65d68] disabled:opacity-60"
              >
                {savingHorario ? "A guardar…" : "Guardar horário"}
              </button>
            </div>
            </>
            )}
          </section>

          {/* Serviços e preços */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            {loadingServicos ? (
              <p className="text-[#666]">A carregar…</p>
            ) : (
            <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-[#171717]">
                Serviços e preços
              </h2>
              <button
                type="button"
                onClick={openNewServico}
                className="rounded-full bg-[#b76e79] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a65d68]"
              >
                + Adicionar serviço
              </button>
            </div>

            {servicos.length === 0 && !editingServicoId && (
              <p className="text-sm text-[#666]">
                Ainda não há serviços. A app usa a lista padrão até criar serviços aqui. Clique em &quot;Adicionar serviço&quot; para criar o primeiro.
              </p>
            )}

            {servicos.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#666]">Filtrar:</span>
                <button
                  type="button"
                  onClick={() => setFilterCategoria("")}
                  className={`rounded-full px-3 py-1 text-xs ${filterCategoria === "" ? "bg-[#b76e79] text-white" : "bg-[#eee] text-[#666] hover:bg-[#ddd]"}`}
                >
                  Todos
                </button>
                {Array.from(new Set(servicos.map((s) => s.categoria).filter(Boolean))).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategoria(cat!)}
                    className={`rounded-full px-3 py-1 text-xs ${filterCategoria === cat ? "bg-[#b76e79] text-white" : "bg-[#eee] text-[#666] hover:bg-[#ddd]"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <ul className="space-y-3">
              {servicos
                .filter((s) => !filterCategoria || (s.categoria ?? "") === filterCategoria)
                .map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-center gap-4 rounded-lg border p-3 ${s.ativo ? "border-[#eee] bg-white" : "border-[#eee] bg-[#fafafa] opacity-75"} ${s.destaque ? "ring-1 ring-[#b76e79]" : ""}`}
                  >
                    {s.imagemUrl && !failedImageIds.has(s.id) ? (
                      <img
                        src={s.imagemUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                        onError={() => setFailedImageIds((prev) => new Set(prev).add(s.id))}
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#f0f0f0] text-xs text-[#999]">
                        Sem imagem
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#171717]">
                        {s.nome}
                        {s.destaque && <span className="ml-2 text-xs text-[#b76e79]">★ Destaque</span>}
                        {!s.ativo && <span className="ml-2 text-xs text-[#666]">(inativo)</span>}
                      </p>
                      {s.categoria && (
                        <span className="inline-block rounded bg-[#eee] px-2 py-0.5 text-xs text-[#666]">{s.categoria}</span>
                      )}
                      {s.descricao && (
                        <p className="mt-1 line-clamp-2 text-sm text-[#666]">{s.descricao}</p>
                      )}
                      <p className="mt-1 text-sm text-[#b76e79]">
                        {s.duracaoMinutos} min · {s.preco} €
                        {s.ordem != null && <span className="ml-2 text-[#999]">· ordem {s.ordem}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditServico(s)}
                        className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#171717] hover:bg-[#F5F5F5]"
                      >
                        Editar
                      </button>
                      {s.ativo && (
                        <button
                          type="button"
                          onClick={() => handleDeleteServico(s.id)}
                          disabled={deletingId === s.id}
                          className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#b76e79] hover:bg-[#fdf8f9] disabled:opacity-50"
                        >
                          {deletingId === s.id ? "…" : "Desativar"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>

            {/* Formulário novo/editar serviço */}
            {editingServicoId && (
              <div className="mt-6 rounded-xl border border-[#b76e79] bg-[#fdf8f9] p-4">
                <h3 className="mb-3 font-medium text-[#171717]">
                  {editingServicoId === "new" ? "Novo serviço" : "Editar serviço"}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#666]">Nome *</label>
                    <input
                      type="text"
                      value={servicoForm.nome}
                      onChange={(e) => setServicoForm((f) => ({ ...f, nome: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                      placeholder="Ex: Massagem de Relaxamento"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#666]">Descrição</label>
                    <textarea
                      value={servicoForm.descricao}
                      onChange={(e) => setServicoForm((f) => ({ ...f, descricao: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                      placeholder="Breve descrição do serviço"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#666]">Categoria</label>
                    <input
                      type="text"
                      value={servicoForm.categoria}
                      onChange={(e) => setServicoForm((f) => ({ ...f, categoria: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                      placeholder="Ex: Massagem, Estética"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#666]">Ordem de exibição</label>
                    <input
                      type="number"
                      min={0}
                      value={servicoForm.ordem}
                      onChange={(e) => setServicoForm((f) => ({ ...f, ordem: Number(e.target.value) || 0 }))}
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#666]">Duração (min)</label>
                    <input
                      type="number"
                      min={15}
                      value={servicoForm.duracaoMinutos}
                      onChange={(e) => setServicoForm((f) => ({ ...f, duracaoMinutos: Number(e.target.value) || 0 }))}
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#666]">Preço (€)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={servicoForm.preco}
                      onChange={(e) => setServicoForm((f) => ({ ...f, preco: Number(e.target.value) || 0 }))}
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#666]">Imagem do serviço</label>
                    {servicoForm.imagemUrl ? (
                      <div className="mt-1 flex items-start gap-3">
                        <img
                          src={servicoForm.imagemUrl}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-lg border border-[#eee] object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[#666]">Pré-visualização. Pode alterar o URL em baixo ou enviar outra imagem.</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={servicoForm.imagemUrl}
                        onChange={(e) => setServicoForm((f) => ({ ...f, imagemUrl: e.target.value }))}
                        className="min-w-[200px] flex-1 rounded-lg border border-[#ddd] px-3 py-2 text-[#171717]"
                        placeholder="URL da imagem (https://...)"
                      />
                      <span className="text-xs text-[#999]">ou</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage || !storage}
                        className="rounded-lg border border-[#b76e79] bg-white px-3 py-2 text-sm font-medium text-[#b76e79] hover:bg-[#fdf8f9] disabled:opacity-50"
                      >
                        {uploadingImage ? "A enviar…" : "Enviar imagem do computador"}
                      </button>
                    </div>
                    {uploadImageError && (
                      <p className="mt-1 text-xs text-red-600">{uploadImageError}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 sm:col-span-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={servicoForm.ativo}
                        onChange={(e) => setServicoForm((f) => ({ ...f, ativo: e.target.checked }))}
                        className="rounded border-[#ddd] text-[#b76e79] focus:ring-[#b76e79]"
                      />
                      <span className="text-sm text-[#666]">Visível / ativo</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={servicoForm.destaque}
                        onChange={(e) => setServicoForm((f) => ({ ...f, destaque: e.target.checked }))}
                        className="rounded border-[#ddd] text-[#b76e79] focus:ring-[#b76e79]"
                      />
                      <span className="text-sm text-[#666]">★ Destaque na listagem</span>
                    </label>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveServico}
                    disabled={savingServico}
                    className="rounded-full bg-[#b76e79] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#a65d68] disabled:opacity-60"
                  >
                    {savingServico ? "A guardar…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={closeServicoForm}
                    className="rounded-full border border-[#ddd] px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#F5F5F5]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </section>
        </div>
    </div>
  );
}
