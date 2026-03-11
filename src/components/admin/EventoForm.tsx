"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getServicosAdmin } from "@/lib/firebase";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Servico } from "@/types";
import type { Evento } from "@/types";

function generateSlug(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || `evento-${Date.now()}`;
}

export type EventoFormData = {
  modelo: "interno" | "externo";
  participacao: "todos" | "users";
  titulo: string;
  descricao: string;
  dataInicio: string;
  horaInicio: string;
  dataFim: string;
  horaFim: string;
  localTipo: "mardelux" | "morada" | "link";
  localValor: string;
  contactoInfo: string;
  imagemUrl: string;
  servicosIds: string[];
  servicosMaxEscolha: number;
  codigoAtivo: boolean;
  codigoPromocional: {
    codigo: string;
    descontoPercentagem: number;
    tipoAplicacao: "site" | "evento";
  };
  codigoPromocionalId: string;
  checkoutAtivo: boolean;
  status: "rascunho" | "publicado";
  slug: string;
};

const defaultForm: EventoFormData = {
  modelo: "externo",
  participacao: "todos",
  titulo: "",
  descricao: "",
  dataInicio: "",
  horaInicio: "09:00",
  dataFim: "",
  horaFim: "18:00",
  localTipo: "mardelux",
  localValor: "",
  contactoInfo: "",
  imagemUrl: "",
  servicosIds: [],
  servicosMaxEscolha: 1,
  codigoAtivo: false,
  codigoPromocional: { codigo: "", descontoPercentagem: 0, tipoAplicacao: "evento" },
  codigoPromocionalId: "",
  checkoutAtivo: false,
  status: "rascunho",
  slug: "",
};

function toFormData(e: Evento & { codigoPromocional?: { codigo: string; descontoPercentagem: number; tipoAplicacao: "site" | "evento" } }): EventoFormData {
  const di = e.dataInicio ? new Date(e.dataInicio) : null;
  const df = e.dataFim ? new Date(e.dataFim) : null;
  const cp = e.codigoPromocional;
  return {
    ...defaultForm,
    modelo: e.modelo,
    participacao: e.participacao,
    titulo: e.titulo ?? "",
    descricao: e.descricao ?? "",
    dataInicio: di ? di.toISOString().slice(0, 10) : "",
    horaInicio: di ? `${String(di.getHours()).padStart(2, "0")}:${String(di.getMinutes()).padStart(2, "0")}` : "09:00",
    dataFim: df ? df.toISOString().slice(0, 10) : "",
    horaFim: df ? `${String(df.getHours()).padStart(2, "0")}:${String(df.getMinutes()).padStart(2, "0")}` : "18:00",
    localTipo: (e.localTipo as "mardelux" | "morada" | "link") ?? "mardelux",
    localValor: e.localValor ?? "",
    contactoInfo: e.contactoInfo ?? "",
    imagemUrl: e.imagemUrl ?? "",
    servicosIds: e.servicosIds ?? [],
    servicosMaxEscolha: e.servicosMaxEscolha ?? 1,
    codigoAtivo: e.codigoAtivo ?? false,
    codigoPromocional: cp
      ? { codigo: cp.codigo ?? "", descontoPercentagem: cp.descontoPercentagem ?? 0, tipoAplicacao: cp.tipoAplicacao ?? "evento" }
      : defaultForm.codigoPromocional,
    codigoPromocionalId: e.codigoPromocionalId ?? "",
    checkoutAtivo: e.checkoutAtivo ?? false,
    status: e.status ?? "rascunho",
    slug: e.slug ?? "",
  };
}

interface EventoFormProps {
  evento?: Evento | null;
  onSave: (data: EventoFormData) => Promise<void>;
  saving: boolean;
  error: string | null;
}

export default function EventoForm({ evento, onSave, saving, error }: EventoFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<EventoFormData>(evento ? toFormData(evento) : defaultForm);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loadingServicos, setLoadingServicos] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (evento) setForm(toFormData(evento));
  }, [evento?.id]);

  useEffect(() => {
    let cancelled = false;
    getServicosAdmin()
      .then((list) => { if (!cancelled) setServicos(list); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingServicos(false); });
    return () => { cancelled = true; };
  }, []);

  const updateSlugFromTitulo = () => {
    if (form.titulo.trim() && !form.slug) {
      setForm((f) => ({ ...f, slug: generateSlug(f.titulo) }));
    }
  };

  const toDataInicio = () =>
    form.dataInicio && form.horaInicio
      ? `${form.dataInicio}T${form.horaInicio}:00`
      : form.dataInicio
        ? `${form.dataInicio}T09:00:00`
        : "";
  const toDataFim = () =>
    form.dataFim && form.horaFim
      ? `${form.dataFim}T${form.horaFim}:00`
      : form.dataFim
        ? `${form.dataFim}T18:00:00`
        : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(form);
  };

  const handleImageUpload = async (file: File) => {
    if (!storage || !user) return;
    setUploadingImage(true);
    try {
      const path = `eventos/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((f) => ({ ...f, imagemUrl: url }));
    } catch (err) {
      console.error("Upload imagem:", err);
    } finally {
      setUploadingImage(false);
    }
  };

  const isInterno = form.modelo === "interno";
  const isLocalMardelux = form.localTipo === "mardelux";
  const canCheckout = isInterno && isLocalMardelux;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* 0. Estrutura */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[#171717]">0. Estrutura do evento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[#666]">Modelo</label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.modelo === "interno"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      modelo: e.target.checked ? "interno" : "externo",
                      checkoutAtivo: e.target.checked && isLocalMardelux ? f.checkoutAtivo : false,
                    }))
                  }
                />
                Interno (MarDelux)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.modelo === "externo"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      modelo: e.target.checked ? "externo" : "interno",
                      checkoutAtivo: false,
                    }))
                  }
                />
                Externo (Referência)
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#666]">Quem pode participar?</label>
            <select
              value={form.participacao}
              onChange={(e) => setForm((f) => ({ ...f, participacao: e.target.value as "todos" | "users" }))}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
            >
              <option value="todos">Todos</option>
              <option value="users">Users (requer conta/login)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 1. Informações */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[#171717]">1. Informações sobre o evento</h2>
        <p className="mb-4 text-sm text-[#666]">Preencha pelo menos um campo.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[#666]">Título</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              onBlur={updateSlugFromTitulo}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
              placeholder="Ex: Workshop de Massagem"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[#666]">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
              placeholder="Descrição do evento"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#666]">Data/hora início</label>
            <div className="mt-1 flex gap-2">
              <input
                type="date"
                value={form.dataInicio}
                onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                className="flex-1 rounded-lg border border-[#ddd] px-3 py-2"
              />
              <input
                type="time"
                value={form.horaInicio}
                onChange={(e) => setForm((f) => ({ ...f, horaInicio: e.target.value }))}
                className="w-24 rounded-lg border border-[#ddd] px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#666]">Data/hora fim</label>
            <div className="mt-1 flex gap-2">
              <input
                type="date"
                value={form.dataFim}
                onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                className="flex-1 rounded-lg border border-[#ddd] px-3 py-2"
              />
              <input
                type="time"
                value={form.horaFim}
                onChange={(e) => setForm((f) => ({ ...f, horaFim: e.target.value }))}
                className="w-24 rounded-lg border border-[#ddd] px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#666]">Local</label>
            <select
              value={form.localTipo}
              onChange={(e) => {
                const v = e.target.value as "mardelux" | "morada" | "link";
                setForm((f) => ({
                  ...f,
                  localTipo: v,
                  checkoutAtivo: v !== "mardelux" ? false : f.checkoutAtivo,
                }));
              }}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
            >
              <option value="mardelux">MarDelux (no site)</option>
              <option value="morada">Morada (link Google Maps)</option>
              <option value="link">Link (página online)</option>
            </select>
          </div>
          {(form.localTipo === "morada" || form.localTipo === "link") && (
            <div>
              <label className="block text-sm font-medium text-[#666]">
                {form.localTipo === "morada" ? "Morada" : "URL"}
              </label>
              <input
                type="text"
                value={form.localValor}
                onChange={(e) => setForm((f) => ({ ...f, localValor: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                placeholder={form.localTipo === "morada" ? "Morada completa" : "https://..."}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#666]">Contacto (email ou telefone)</label>
            <input
              type="text"
              value={form.contactoInfo}
              onChange={(e) => setForm((f) => ({ ...f, contactoInfo: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
              placeholder="Email ou telefone"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[#666]">Imagem do evento</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f);
              }}
            />
            <div className="mt-1 flex items-center gap-4">
              {form.imagemUrl && (
                <img src={form.imagemUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="rounded-lg border border-[#ddd] px-3 py-2 text-sm hover:bg-[#f5f5f5] disabled:opacity-60"
              >
                {uploadingImage ? "A carregar…" : "Escolher imagem"}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[#666]">Slug (URL amigável)</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 font-mono text-sm"
              placeholder="evento-massagem-2025"
            />
            <p className="mt-1 text-xs text-[#666]">URL: /eventos/{form.slug || "..."}</p>
          </div>
        </div>
      </section>

      {/* 2. Serviços (só interno) */}
      {isInterno && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">2. Serviços</h2>
          <p className="mb-4 text-sm text-[#666]">Selecione os serviços disponíveis no evento (de Configurações).</p>
          {loadingServicos ? (
            <p className="text-[#666]">A carregar serviços…</p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[#666]">Serviços disponíveis</label>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-[#ddd] p-3">
                  {servicos.map((s) => (
                    <label key={s.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.servicosIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm((f) => ({ ...f, servicosIds: [...f.servicosIds, s.id] }));
                          } else {
                            setForm((f) => ({
                              ...f,
                              servicosIds: f.servicosIds.filter((id) => id !== s.id),
                            }));
                          }
                        }}
                      />
                      <span>{s.nome}</span>
                      <span className="text-xs text-[#999]">{s.preco} €</span>
                    </label>
                  ))}
                  {servicos.length === 0 && (
                    <p className="text-sm text-[#666]">Crie serviços em Configurações primeiro.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#666]">
                  Máx. serviços que o cliente pode escolher
                </label>
                <input
                  type="number"
                  min={1}
                  max={form.servicosIds.length || 1}
                  value={form.servicosMaxEscolha}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      servicosMaxEscolha: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="mt-1 w-24 rounded-lg border border-[#ddd] px-3 py-2"
                />
                <span className="ml-2 text-sm text-[#666]">
                  (de {form.servicosIds.length} disponíveis)
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {/* 3. Condições (só interno) */}
      {isInterno && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">3. Condições (código promocional)</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.codigoAtivo}
              onChange={(e) => setForm((f) => ({ ...f, codigoAtivo: e.target.checked }))}
            />
            Usar código promocional
          </label>
          {form.codigoAtivo && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[#666]">Código</label>
                <input
                  type="text"
                  value={form.codigoPromocional.codigo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      codigoPromocional: {
                        ...f.codigoPromocional,
                        codigo: e.target.value.toUpperCase(),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 font-mono"
                  placeholder="VERAO25"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#666]">Desconto (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.codigoPromocional.descontoPercentagem}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      codigoPromocional: {
                        ...f.codigoPromocional,
                        descontoPercentagem: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#666]">Aplicável a</label>
                <select
                  value={form.codigoPromocional.tipoAplicacao}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      codigoPromocional: {
                        ...f.codigoPromocional,
                        tipoAplicacao: e.target.value as "site" | "evento",
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                >
                  <option value="site">Site MarDelux (todos os serviços em Agendar)</option>
                  <option value="evento">Evento MarDelux (só serviços do evento)</option>
                </select>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Evento Checkout (só interno + local mardelux) */}
      {canCheckout && (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[#171717]">4. Evento Checkout</h2>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.checkoutAtivo}
              onChange={(e) => setForm((f) => ({ ...f, checkoutAtivo: e.target.checked }))}
            />
            Habilitar botão &quot;Reservar Agora&quot; (leva direto a Data/Hora e Confirmação)
          </label>
          <p className="mt-2 text-sm text-[#666]">
            Se ativado, o cliente pode escolher serviços e ir diretamente para agendar data/hora e
            confirmação com código aplicado automaticamente.
          </p>
        </section>
      )}

      {/* Status */}
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-[#666]">Status</label>
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "rascunho" | "publicado" }))}
          className="mt-1 rounded-lg border border-[#ddd] px-3 py-2"
        >
          <option value="rascunho">Rascunho</option>
          <option value="publicado">Publicado</option>
        </select>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#b76e79] px-6 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60"
        >
          {saving ? "A guardar…" : "Guardar"}
        </button>
        <Link href="/admin/eventos" className="text-sm text-[#666] hover:underline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
