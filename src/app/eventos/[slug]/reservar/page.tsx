"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import EventoCheckoutFlow from "@/components/eventos/EventoCheckoutFlow";

export default function EventoReservarPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)] md:px-8">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo variant="text" height={40} />
          <Link
            href={slug ? `/eventos/${slug}` : "/eventos"}
            className="text-sm font-medium text-[var(--gray-dark)] transition hover:text-[var(--rose-gold)]"
          >
            ← Voltar ao evento
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {slug ? (
          <EventoCheckoutFlow slug={slug} />
        ) : (
          <p className="text-[var(--gray-mid)]">Evento não encontrado.</p>
        )}
      </main>
    </div>
  );
}
