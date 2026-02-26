import Link from "next/link";
import AgendarFlow from "@/components/agendar/AgendarFlow";

export const metadata = {
  title: "Reservar | MarDelux",
  description: "Marque a sua sessão de massagem no MarDelux. Escolha o serviço, data e hora.",
};

export default function AgendarPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="border-b border-[#eee] bg-white px-4 py-4 md:px-8">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-[#b76e79] hover:opacity-90"
          >
            MarDelux
          </Link>
          <Link
            href="/"
            className="text-sm text-[#666] hover:text-[#171717]"
          >
            Início
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <h1 className="mb-2 text-2xl font-semibold text-[#171717]">
          Agendar sessão
        </h1>
        <p className="mb-8 text-[#666]">
          Escolha o serviço, a data e a hora. Confirmamos a reserva por email.
        </p>
        <AgendarFlow />
      </div>
    </div>
  );
}
