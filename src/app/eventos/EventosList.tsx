"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type EventoPublic = {
  id: string;
  titulo?: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  localTipo?: string;
  localValor?: string;
  imagemUrl?: string;
  slug: string;
  checkoutAtivo?: boolean;
  modelo?: string;
};

function formatDate(s: string): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export default function EventosList() {
  const [eventos, setEventos] = useState<EventoPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eventos")
      .then((r) => r.json())
      .then((list) => {
        setEventos(Array.isArray(list) ? list : []);
      })
      .catch(() => setEventos([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="mt-8 text-[var(--gray-mid)]">A carregar eventos…</p>;
  }
  if (eventos.length === 0) {
    return (
      <p className="mt-8 text-[var(--gray-mid)]">
        Não há eventos agendados. Volte em breve!
      </p>
    );
  }

  return (
    <ul className="mt-8 space-y-6">
      {eventos.map((e) => (
        <li
          key={e.id}
          className="overflow-hidden rounded-xl border border-[var(--gray-light)] bg-[var(--white)] shadow-sm transition hover:shadow-md"
        >
          <Link href={`/eventos/${e.slug}`} className="flex flex-col sm:flex-row">
            {e.imagemUrl && (
              <div className="h-48 w-full shrink-0 sm:h-40 sm:w-48">
                <img
                  src={e.imagemUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                  {e.titulo || "Evento"}
                </h2>
                <p className="mt-1 text-sm text-[var(--gray-dark)]">
                  {formatDate(e.dataInicio)} — {formatDate(e.dataFim)}
                </p>
                {e.descricao && (
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--gray-mid)]">
                    {e.descricao}
                  </p>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--rose-gold)]">
                Ver detalhes →
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
