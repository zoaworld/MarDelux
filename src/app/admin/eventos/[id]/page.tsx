"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import EventoForm, { type EventoFormData } from "@/components/admin/EventoForm";
import type { Evento } from "@/types";

function toIso(d: string): string {
  if (!d) return "";
  return new Date(d).toISOString();
}

export default function AdminEventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvento = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token || !id) return;
    try {
      const res = await fetch(`/api/admin/eventos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvento(data as Evento);
      } else {
        setEvento(null);
        setError("Evento não encontrado");
      }
    } catch {
      setEvento(null);
      setError("Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    fetchEvento();
  }, [fetchEvento]);

  const handleSave = async (form: EventoFormData) => {
    const token = await user?.getIdToken?.();
    if (!token || !id) {
      setError("Sessão expirada. Faça login novamente.");
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug é obrigatório");
      return;
    }
    const hasInfo = form.titulo.trim() || form.descricao.trim() || form.contactoInfo.trim();
    if (!hasInfo) {
      setError("Preencha pelo menos um campo de informações (título, descrição ou contacto)");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let codigoPromocionalId: string | undefined = form.codigoPromocionalId || undefined;
      if (form.codigoAtivo && form.codigoPromocional.codigo.trim()) {
        const codigoPayload = {
          codigo: form.codigoPromocional.codigo.trim().toUpperCase(),
          descontoPercentagem: form.codigoPromocional.descontoPercentagem,
          tipoAplicacao: form.codigoPromocional.tipoAplicacao,
          eventoId: id,
          ativo: true,
        };
        if (form.codigoPromocionalId) {
          // Atualizar código existente
          const resCod = await fetch(`/api/admin/codigos-promocionais/${form.codigoPromocionalId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(codigoPayload),
          });
          const dataCod = await resCod.json();
          if (!resCod.ok) throw new Error(dataCod.error ?? "Erro ao atualizar código");
        } else {
          // Criar novo código
          const resCod = await fetch("/api/admin/codigos-promocionais", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(codigoPayload),
          });
          const dataCod = await resCod.json();
          if (!resCod.ok) throw new Error(dataCod.error ?? "Erro ao criar código");
          codigoPromocionalId = dataCod.id;
        }
      }

      const payload = {
        modelo: form.modelo,
        participacao: form.participacao,
        titulo: form.titulo.trim() || undefined,
        descricao: form.descricao.trim() || undefined,
        dataInicio: toIso(form.dataInicio + "T" + form.horaInicio),
        dataFim: toIso(form.dataFim + "T" + form.horaFim),
        localTipo: form.localTipo,
        localValor: form.localValor.trim() || undefined,
        contactoInfo: form.contactoInfo.trim() || undefined,
        imagemUrl: form.imagemUrl.trim() || undefined,
        servicosIds: form.servicosIds,
        servicosMaxEscolha: form.servicosMaxEscolha,
        codigoAtivo: form.codigoAtivo,
        codigoPromocionalId,
        checkoutAtivo: form.checkoutAtivo,
        status: form.status,
        slug: form.slug.trim(),
      };

      const res = await fetch(`/api/admin/eventos/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar evento");
      setEvento(data as Evento);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-[#666]">A carregar evento…</p>;
  }
  if (!evento) {
    return (
      <div>
        <Link href="/admin/eventos" className="text-sm text-[#b76e79] hover:underline">
          ← Eventos
        </Link>
        <p className="mt-4 text-[#666]">{error ?? "Evento não encontrado"}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/eventos" className="text-sm text-[#b76e79] hover:underline">
          ← Eventos
        </Link>
        <h1 className="text-2xl font-semibold text-[#171717]">
          {evento.titulo || "Editar evento"}
        </h1>
      </div>
      <EventoForm evento={evento} onSave={handleSave} saving={saving} error={error} />
    </div>
  );
}
