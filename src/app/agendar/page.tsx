import Link from "next/link";
import AgendarFlow from "@/components/agendar/AgendarFlow";
import Logo from "@/components/Logo";

export const metadata = {
  title: "Reservar | MarDelux",
  description: "Marque a sua sessão de massagem no MarDelux. Escolha o serviço, data e hora.",
};

export default function AgendarPage() {
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

      <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--rose-gold)]">
          Reservar
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
          Agendar sessão
        </h1>
        <p className="mt-3 text-[var(--gray-dark)]">
          Escolha o serviço, a data e a hora. Confirmamos a reserva por email.
        </p>
        <div className="mt-8">
          <AgendarFlow />
        </div>
      </div>
    </div>
  );
}
