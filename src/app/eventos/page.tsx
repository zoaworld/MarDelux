import { Suspense } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import EventosList from "./EventosList";

export const metadata = {
  title: "Eventos | MarDelux",
  description: "Descubra os próximos eventos MarDelux: workshops, sessões especiais e mais.",
};

export default function EventosPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)] md:px-8">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Logo variant="text" height={40} />
          <Link
            href="/"
            className="text-sm font-medium text-[var(--gray-dark)] transition hover:text-[var(--rose-gold)]"
          >
            Início
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--rose-gold)]">
          Eventos
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
          Próximos eventos
        </h1>
        <p className="mt-3 text-[var(--gray-dark)]">
          Participe nos nossos workshops e eventos especiais.
        </p>

        <Suspense fallback={<p className="mt-8 text-[var(--gray-mid)]">A carregar eventos…</p>}>
          <EventosList />
        </Suspense>
      </main>
    </div>
  );
}
