"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type EventoListItem = {
  id: string;
  titulo?: string;
  modelo: "interno" | "externo";
  participacao: "todos" | "users";
  status: "rascunho" | "publicado";
  dataInicio: string;
  dataFim: string;
  slug: string;
};

function formatDate(s: string): string {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export default function AdminEventosPage() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<EventoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchEventos = useCallback(async () => {
    const token = await user?.getIdToken?.();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/eventos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list = (await res.json()) as EventoListItem[];
        setEventos(list);
      } else {
        setEventos([]);
      }
    } catch {
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  const filtered = eventos.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const titulo = (e.titulo ?? "").toLowerCase();
    const slug = (e.slug ?? "").toLowerCase();
    return titulo.includes(q) || slug.includes(q);
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#171717]">Eventos</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/eventos/novo"
            className="rounded-lg bg-[#b76e79] px-4 py-2 text-sm font-medium text-white hover:bg-[#a65d68]"
          >
            + Novo evento
          </Link>
          <Link href="/" className="text-sm text-[#b76e79] hover:underline">
            ← Voltar ao site
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por título ou slug..."
          className="w-full max-w-md rounded-lg border border-[#ddd] px-3 py-2 text-sm"
        />
      </div>

      <section className="rounded-xl bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-[#666]">A carregar eventos…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-[#666]">
            {eventos.length === 0
              ? "Ainda não há eventos. Crie o primeiro para começar."
              : "Nenhum evento encontrado para a pesquisa."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#eee] bg-[#fafafa] text-left text-sm text-[#666]">
                  <th className="p-3 font-medium">Título</th>
                  <th className="p-3 font-medium">Modelo</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Período</th>
                  <th className="p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[#eee] transition hover:bg-[#fafafa]"
                  >
                    <td className="p-3">
                      <span className="font-medium text-[#171717]">
                        {e.titulo || "(Sem título)"}
                      </span>
                      {e.slug && (
                        <span className="ml-2 text-xs text-[#999]">/{e.slug}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          e.modelo === "interno"
                            ? "bg-[#e8f5e9] text-[#2e7d32]"
                            : "bg-[#e3f2fd] text-[#1565c0]"
                        }`}
                      >
                        {e.modelo === "interno" ? "Interno" : "Externo"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          e.status === "publicado"
                            ? "bg-[#e8f5e9] text-[#2e7d32]"
                            : "bg-[#fff3e0] text-[#e65100]"
                        }`}
                      >
                        {e.status === "publicado" ? "Publicado" : "Rascunho"}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-[#666]">
                      {formatDate(e.dataInicio)} — {formatDate(e.dataFim)}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/eventos/${e.id}`}
                        className="text-sm font-medium text-[#b76e79] hover:underline"
                      >
                        Ver/Editar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
