"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { HomeCard } from "@/types";
import type { HomeCardTipo } from "@/types";

type EventoOption = { id: string; titulo?: string; slug: string; imagemUrl?: string };

export default function AdminHomeCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [eventos, setEventos] = useState<EventoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erro"; text: string } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<HomeCard> & { ordem: number }>({
    ordem: 0,
    tipo: "informativo",
    imagemUrl: "",
    titulo: "",
    descricao: "",
    conteudoExpandido: "",
    linkUrl: "",
    eventoId: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (type: "ok" | "erro", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchCards = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    try {
      const res = await fetch("/api/admin/home-cards", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as HomeCard[];
        setCards(list);
      }
    } catch {
      setCards([]);
    }
  }, [user]);

  const fetchEventos = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    try {
      const res = await fetch("/api/admin/eventos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as EventoOption[];
        setEventos(list);
      }
    } catch {
      setEventos([]);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) {
      setLoading(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchCards(), fetchEventos()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, fetchCards, fetchEventos]);

  const openNew = () => {
    setEditingIndex(-1);
    setForm({
      ordem: cards.length,
      tipo: "informativo",
      imagemUrl: "",
      titulo: "",
      descricao: "",
      conteudoExpandido: "",
      linkUrl: "",
      eventoId: "",
    });
  };

  const openEdit = (index: number) => {
    const c = cards[index];
    setEditingIndex(index);
    setForm({
      ordem: index,
      tipo: c.tipo,
      imagemUrl: c.imagemUrl ?? "",
      titulo: c.titulo ?? "",
      descricao: c.descricao ?? "",
      conteudoExpandido: c.conteudoExpandido ?? "",
      linkUrl: c.linkUrl ?? "",
      eventoId: c.eventoId ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (!storage) {
      showMessage("erro", "Storage não configurado.");
      return;
    }
    setUploadingImage(true);
    try {
      const path = `home-cards/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((f) => ({ ...f, imagemUrl: url }));
    } catch (err) {
      showMessage("erro", err instanceof Error ? err.message : "Falha ao enviar imagem.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    const tipo = form.tipo ?? "informativo";
    if (tipo === "evento" && !form.eventoId?.trim()) {
      showMessage("erro", "Selecione um evento.");
      return;
    }
    if (tipo === "foto_link" && (!form.linkUrl?.trim() || !form.imagemUrl?.trim())) {
      showMessage("erro", "Imagem e link são obrigatórios para tipo Foto/Link.");
      return;
    }
    if (tipo === "informativo" && !form.titulo?.trim()) {
      showMessage("erro", "Título é obrigatório para cards informativos.");
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Não autenticado.");

      let nextCards: HomeCard[] = [...cards];
      const cardData = {
        ordem: editingIndex === -1 ? nextCards.length : editingIndex,
        tipo: form.tipo ?? "informativo",
        imagemUrl: (form.imagemUrl ?? "").trim() || undefined,
        titulo: (form.titulo ?? "").trim() || undefined,
        descricao: (form.descricao ?? "").trim() || undefined,
        conteudoExpandido: (form.conteudoExpandido ?? "").trim() || undefined,
        linkUrl: (form.linkUrl ?? "").trim() || undefined,
        eventoId: (form.eventoId ?? "").trim() || undefined,
      };

      if (editingIndex === -1) {
        if (nextCards.length >= 3) {
          showMessage("erro", "Máximo de 3 cards.");
          setSaving(false);
          return;
        }
        nextCards = [...nextCards, { ...cardData, id: `c${nextCards.length}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as HomeCard];
      } else {
        nextCards[editingIndex] = { ...nextCards[editingIndex], ...cardData };
      }

      const payload = nextCards.map((c, i) => ({
        ordem: i,
        tipo: c.tipo,
        imagemUrl: c.imagemUrl ?? "",
        titulo: c.titulo ?? "",
        descricao: c.descricao ?? "",
        conteudoExpandido: c.conteudoExpandido ?? "",
        linkUrl: c.linkUrl ?? "",
        eventoId: c.eventoId ?? "",
      }));

      const res = await fetch("/api/admin/home-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cards: payload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `API ${res.status}`);
      }

      setCards(nextCards);
      cancelEdit();
      showMessage("ok", "Cards guardados com sucesso.");
    } catch (e) {
      showMessage("erro", e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (index: number) => {
    if (!confirm("Remover este card?")) return;
    const nextCards = cards.filter((_, i) => i !== index);
    setSaving(true);
    setMessage(null);
    try {
      const token = await user?.getIdToken?.();
      if (!token) throw new Error("Não autenticado.");
      const payload = nextCards.map((c, i) => ({
        ordem: i,
        tipo: c.tipo,
        imagemUrl: c.imagemUrl ?? "",
        titulo: c.titulo ?? "",
        descricao: c.descricao ?? "",
        conteudoExpandido: c.conteudoExpandido ?? "",
        linkUrl: c.linkUrl ?? "",
        eventoId: c.eventoId ?? "",
      }));
      const res = await fetch("/api/admin/home-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cards: payload }),
      });
      if (!res.ok) throw new Error("Erro ao guardar");
      setCards(nextCards);
      if (editingIndex === index) cancelEdit();
      else if (editingIndex !== null && editingIndex > index)
        setEditingIndex(editingIndex - 1);
      showMessage("ok", "Card removido.");
    } catch (e) {
      showMessage("erro", e instanceof Error ? e.message : "Erro ao remover.");
    } finally {
      setSaving(false);
    }
  };

  const tipoLabels: Record<HomeCardTipo, string> = {
    informativo: "Informativo (clica e expande)",
    foto_link: "Só foto (link abre noutra página)",
    evento: "Evento (de admin/eventos)",
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">Destaques — Página Inicial</h1>
        <Link href="/" className="text-sm text-[#b76e79] hover:underline">
          ← Voltar ao site
        </Link>
      </div>

      <p className="mb-6 text-sm text-[#666]">
        Cards que aparecem acima da secção &quot;Porquê MarDelux&quot;. Máximo 3. Layout adapta-se automaticamente (1, 2 ou 3 colunas).
      </p>

      {message && (
        <div
          role="alert"
          className={`mb-6 rounded-lg px-4 py-3 ${
            message.type === "ok"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="text-[#666]">A carregar…</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {cards.map((c, i) => (
              <div
                key={c.id}
                className="flex w-full max-w-xs flex-col overflow-hidden rounded-xl border border-[#eee] bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3] bg-[#f5f5f5]">
                  {c.imagemUrl || (c.tipo === "evento" && eventos.find((e) => e.id === c.eventoId)) ? (
                    <img
                      src={
                        c.imagemUrl ??
                        (c.tipo === "evento"
                          ? eventos.find((e) => e.id === c.eventoId)?.imagemUrl ?? ""
                          : "")
                      }
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150' fill='%23ddd'%3E%3Crect width='200' height='150'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='14'%3ESem imagem%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[#999]">
                      Sem imagem
                    </div>
                  )}
                  <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                    {tipoLabels[c.tipo]}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-[#171717]">
                    {c.tipo === "evento"
                      ? eventos.find((e) => e.id === c.eventoId)?.titulo ?? `Evento ${c.eventoId}`
                      : c.titulo ?? "(Sem título)"}
                  </h3>
                  {c.descricao && (
                    <p className="mt-1 line-clamp-2 text-sm text-[#666]">{c.descricao}</p>
                  )}
                </div>
                <div className="flex gap-2 border-t border-[#eee] p-2">
                  <button
                    type="button"
                    onClick={() => openEdit(i)}
                    className="flex-1 rounded-lg border border-[#ddd] px-2 py-1.5 text-sm text-[#171717] hover:bg-[#f5f5f5]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    disabled={saving}
                    className="rounded-lg border border-[#ddd] px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            {cards.length < 3 && editingIndex === null && (
              <button
                type="button"
                onClick={openNew}
                className="flex h-40 w-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#ddd] text-[#666] transition hover:border-[#b76e79] hover:text-[#b76e79]"
              >
                <span className="text-2xl">+</span>
                <span className="text-sm">Novo card</span>
              </button>
            )}
          </div>

          {editingIndex !== null && (
            <div className="rounded-xl border-2 border-[#b76e79] bg-[#fdf8f9] p-6">
              <h2 className="mb-4 font-medium text-[#171717]">
                {editingIndex === -1 ? "Novo card" : "Editar card"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[#666]">Tipo de card</label>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tipo: e.target.value as HomeCardTipo }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                  >
                    <option value="informativo">{tipoLabels.informativo}</option>
                    <option value="foto_link">{tipoLabels.foto_link}</option>
                    <option value="evento">{tipoLabels.evento}</option>
                  </select>
                </div>

                {form.tipo === "evento" && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-[#666]">Evento</label>
                    <select
                      value={form.eventoId ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, eventoId: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                    >
                      <option value="">— Selecionar evento —</option>
                      {eventos.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.titulo ?? "(Sem título)"} / {e.slug}
                        </option>
                      ))}
                    </select>
                    {eventos.length === 0 && (
                      <p className="mt-1 text-xs text-[#666]">
                        Crie eventos em{" "}
                        <Link href="/admin/eventos" className="text-[#b76e79] hover:underline">
                          admin/eventos
                        </Link>
                      </p>
                    )}
                  </div>
                )}

                {form.tipo !== "evento" && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-[#666]">Imagem</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                      <div className="mt-1 flex items-center gap-4">
                        {form.imagemUrl && (
                          <img
                            src={form.imagemUrl}
                            alt=""
                            className="h-20 w-28 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={form.imagemUrl ?? ""}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, imagemUrl: e.target.value }))
                            }
                            placeholder="URL da imagem"
                            className="rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage || !storage}
                            className="rounded-lg border border-[#b76e79] px-3 py-2 text-sm text-[#b76e79] hover:bg-[#fdf8f9] disabled:opacity-50"
                          >
                            {uploadingImage ? "A enviar…" : "Enviar imagem"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-[#666]">
                        Título {form.tipo === "informativo" ? "*" : "(opcional para foto/link)"}
                      </label>
                      <input
                        type="text"
                        value={form.titulo ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, titulo: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                        placeholder="Ex: Ambiente sereno"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-[#666]">
                        Descrição curta (no card)
                      </label>
                      <textarea
                        value={form.descricao ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, descricao: e.target.value }))
                        }
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                        placeholder="Breve texto visível no card"
                      />
                    </div>

                    {form.tipo === "informativo" && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-[#666]">
                          Conteúdo expandido (ao clicar)
                        </label>
                        <textarea
                          value={form.conteudoExpandido ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, conteudoExpandido: e.target.value }))
                          }
                          rows={4}
                          className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                          placeholder="Texto completo que aparece ao expandir o card"
                        />
                      </div>
                    )}

                    {form.tipo === "foto_link" && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-[#666]">
                          Link (abre em nova página)
                        </label>
                        <input
                          type="url"
                          value={form.linkUrl ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, linkUrl: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2"
                          placeholder="https://..."
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68] disabled:opacity-60"
                >
                  {saving ? "A guardar…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-full border border-[#ddd] px-4 py-2 text-sm font-medium text-[#171717] hover:bg-[#f5f5f5]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
