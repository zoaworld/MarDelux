"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

type EventoDetail = {
  id: string;
  titulo?: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  localTipo?: string;
  localValor?: string;
  contactoInfo?: string;
  imagemUrl?: string;
  slug: string;
  participacao?: string;
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

function LocalLink({
  tipo,
  valor,
}: {
  tipo?: string;
  valor?: string;
}) {
  if (tipo === "mardelux" || !tipo) {
    return <span>MarDelux (evento no site)</span>;
  }
  if (tipo === "morada" && valor) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(valor)}`;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--rose-gold)] hover:underline">
        {valor}
      </a>
    );
  }
  if (tipo === "link" && valor) {
    return (
      <a href={valor} target="_blank" rel="noopener noreferrer" className="text-[var(--rose-gold)] hover:underline">
        {valor}
      </a>
    );
  }
  return null;
}

export default function EventoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [evento, setEvento] = useState<EventoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/eventos/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Evento não encontrado");
        return r.json();
      })
      .then(setEvento)
      .catch(() => setError("Evento não encontrado"))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!authLoading && evento?.participacao === "users" && !user) {
      const returnUrl = `/eventos/${slug}`;
      window.location.href = `/login?returnTo=${encodeURIComponent(returnUrl)}`;
    }
  }, [authLoading, evento?.participacao, user, slug]);

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    );
  }

  if (error || !evento) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)]">
          <nav className="mx-auto flex max-w-6xl items-center justify-between">
            <Logo variant="text" height={40} />
            <Link href="/eventos" className="text-sm text-[var(--rose-gold)] hover:underline">
              ← Eventos
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-16 text-center">
          <p className="text-[var(--gray-mid)]">{error ?? "Evento não encontrado"}</p>
          <Link href="/eventos" className="mt-4 inline-block text-[var(--rose-gold)] hover:underline">
            Voltar aos eventos
          </Link>
        </main>
      </div>
    );
  }

  const requiresLogin = evento.participacao === "users" && !user;
  if (requiresLogin) {
    return null;
  }

  const canReservar = evento.checkoutAtivo && evento.modelo === "interno";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)] md:px-8">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo variant="text" height={40} />
          <Link
            href="/eventos"
            className="text-sm font-medium text-[var(--gray-dark)] transition hover:text-[var(--rose-gold)]"
          >
            ← Eventos
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        {evento.imagemUrl && (
          <div className="mb-6 overflow-hidden rounded-xl">
            <img
              src={evento.imagemUrl}
              alt=""
              className="h-64 w-full object-cover md:h-80"
            />
          </div>
        )}

        <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--rose-gold)]">
          Evento
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
          {evento.titulo || "Evento"}
        </h1>

        <div className="mt-6 space-y-4">
          <div>
            <span className="font-medium text-[var(--gray-dark)]">Quando:</span>{" "}
            {formatDate(evento.dataInicio)} — {formatDate(evento.dataFim)}
          </div>
          <div>
            <span className="font-medium text-[var(--gray-dark)]">Onde:</span>{" "}
            <LocalLink tipo={evento.localTipo} valor={evento.localValor} />
          </div>
          {evento.contactoInfo && (
            <div>
              <span className="font-medium text-[var(--gray-dark)]">Contacto:</span>{" "}
              {evento.contactoInfo.includes("@") ? (
                <a
                  href={`mailto:${evento.contactoInfo}`}
                  className="text-[var(--rose-gold)] hover:underline"
                >
                  {evento.contactoInfo}
                </a>
              ) : (
                <a
                  href={`tel:${evento.contactoInfo.replace(/\s/g, "")}`}
                  className="text-[var(--rose-gold)] hover:underline"
                >
                  {evento.contactoInfo}
                </a>
              )}
            </div>
          )}
        </div>

        {evento.descricao && (
          <div className="mt-6 prose prose-sm max-w-none text-[var(--gray-dark)]">
            <p className="whitespace-pre-wrap">{evento.descricao}</p>
          </div>
        )}

        {canReservar && (
          <div className="mt-8">
            <Link
              href={`/eventos/${evento.slug}/reservar`}
              className="inline-flex rounded-full bg-[var(--rose-gold)] px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              Reservar agora
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
