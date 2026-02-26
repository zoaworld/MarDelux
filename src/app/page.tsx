import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#171717]">
      <header className="border-b border-[#F5F5F5] px-4 py-6 md:px-8">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xl font-semibold tracking-tight text-[#b76e79]">
            MarDelux
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/cliente"
              className="text-sm font-medium text-[#666] hover:text-[#b76e79]"
            >
              Área do Cliente
            </Link>
            <Link
              href="/agendar"
              className="rounded-full bg-[#b76e79] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a65d68]"
            >
              Reservar Agora
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <section className="text-center">
          <h1 className="text-4xl font-light tracking-tight text-[#171717] md:text-5xl lg:text-6xl">
            Estúdio de massagens
            <br />
            <span className="text-[#b76e79]">exclusivo para si</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#666]">
            Cuide de si num espaço pensado para o seu bem-estar. Marque a sua
            sessão online.
          </p>
          <Link
            href="/agendar"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#b76e79] px-8 py-4 text-base font-medium text-white shadow-sm transition hover:bg-[#a65d68]"
          >
            Reservar Agora
          </Link>
        </section>
      </main>
    </div>
  );
}
