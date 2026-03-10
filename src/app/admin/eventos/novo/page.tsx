"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import EventoForm, { type EventoFormData } from "@/components/admin/EventoForm";

function toIso(d: string): string {
  if (!d) return "";
  return new Date(d).toISOString();
}

export default function AdminEventoNovoPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (form: EventoFormData) => {
    const token = await user?.getIdToken?.();
    if (!token) {
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
        codigoPromocionalId: undefined,
        checkoutAtivo: form.checkoutAtivo,
        status: form.status,
        slug: form.slug.trim(),
      };

      const res = await fetch("/api/admin/eventos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar evento");
      const eventoId = data.id;

      if (form.codigoAtivo && form.codigoPromocional.codigo.trim()) {
        const resCod = await fetch("/api/admin/codigos-promocionais", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            codigo: form.codigoPromocional.codigo.trim().toUpperCase(),
            descontoPercentagem: form.codigoPromocional.descontoPercentagem,
            tipoAplicacao: form.codigoPromocional.tipoAplicacao,
            eventoId: form.codigoPromocional.tipoAplicacao === "evento" ? eventoId : undefined,
            ativo: true,
          }),
        });
        const dataCod = await resCod.json();
        if (resCod.ok && dataCod.id) {
          await fetch(`/api/admin/eventos/${eventoId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ codigoPromocionalId: dataCod.id }),
          });
        }
      }

      router.push(`/admin/eventos/${eventoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/eventos" className="text-sm text-[#b76e79] hover:underline">
          ← Eventos
        </Link>
        <h1 className="text-2xl font-semibold text-[#171717]">Novo evento</h1>
      </div>
      <EventoForm evento={null} onSave={handleSave} saving={saving} error={error} />
    </div>
  );
}
