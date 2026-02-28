import Link from "next/link";
import Image from "next/image";
import HeaderAdminLink from "@/components/HeaderAdminLink";
import Logo from "@/components/Logo";

/* Hero: pedras de spa (imagem principal) */
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=1920&q=85&auto=format&fit=crop";
const SECTION_IMAGES = [
  /* Ambiente sereno: espaço tranquilo (a preencher - precisa de imagem adequada) */
  "https://picsum.photos/id/18/600/400",
  /* Tratamentos de qualidade: toalhas e tulipas */
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&q=80",
  /* Reservas simples: reserva online (a preencher - precisa de imagem adequada) */
  "https://picsum.photos/id/119/600/400",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[var(--gray-light)]/80 bg-[var(--background)]/95 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
          <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
            <Logo variant="lotus" height={44} linkToHome={false} priority />
            <Logo variant="text" height={44} linkToHome={false} priority />
          </Link>
          <div className="flex items-center gap-6">
            <HeaderAdminLink />
            <Link
              href="/cliente"
              className="text-sm font-medium text-[var(--gray-dark)] transition hover:text-[var(--rose-gold)]"
            >
              Área do Cliente
            </Link>
            <Link href="/agendar" className="btn-primary">
              Reservar Agora
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative min-h-[90vh] w-full overflow-hidden">
          <div className="absolute inset-0">
            {/* unoptimized: carrega direto do Unsplash; se não aparecer, usa o URL que obtiveres ao clicar com o botão direito na foto → "Copiar endereço da imagem" */}
            <Image
              src={HERO_IMAGE}
              alt="Espaço de bem-estar e massagens"
              fill
              className="object-cover"
              priority
              sizes="100vw"
              unoptimized
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(44,44,44,0.35) 0%, rgba(44,44,44,0.6) 60%, rgba(250,249,247,0.97) 100%)",
              }}
            />
          </div>
          <div className="relative mx-auto flex min-h-[90vh] max-w-6xl flex-col justify-end px-4 pb-24 pt-32 md:px-8 md:pb-32">
            <p
              className="font-display text-lg tracking-[0.3em] text-[var(--gold-light)] md:text-xl"
              style={{ letterSpacing: "0.35em" }}
            >
              ESTÚDIO EXCLUSIVO
            </p>
            <h1 className="font-display mt-2 max-w-2xl text-4xl font-semibold leading-tight text-white drop-shadow-lg md:text-5xl lg:text-6xl">
              O seu momento
              <br />
              <span className="text-[var(--gold-light)]">de bem-estar</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-white/90">
              Cuide de si num espaço pensado para o seu conforto. Massagens
              profissionais e um ambiente sereno para recarregar.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/agendar"
                className="btn-primary bg-white/95 px-8 py-4 text-[var(--foreground)] shadow-xl hover:bg-white"
              >
                Reservar Agora
              </Link>
              <Link
                href="/cliente"
                className="btn-secondary border-white/60 bg-transparent px-8 py-4 text-white hover:bg-white/10 hover:border-white"
              >
                Área do Cliente
              </Link>
            </div>
          </div>
        </section>

        {/* Porquê nós */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
          <p className="font-display text-sm uppercase tracking-[0.25em] text-[var(--rose-gold)]">
            Porquê MarDelux
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-[var(--foreground)] md:text-4xl">
            Um espaço só seu
          </h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                img: SECTION_IMAGES[0],
                title: "Ambiente sereno",
                text: "Cada detalhe foi pensado para que se sinta em casa. Silêncio, luz suave e aromas delicados.",
              },
              {
                img: SECTION_IMAGES[1],
                title: "Tratamentos de qualidade",
                text: "Massagens profissionais adaptadas às suas necessidades. Da relaxante à terapêutica.",
              },
              {
                img: SECTION_IMAGES[2],
                title: "Reservas simples",
                text: "Marque a sua sessão online em poucos cliques. Confirmamos por email e está tudo tratado.",
              },
            ].map((item, i) => (
              <article
                key={i}
                className="card-elevated overflow-hidden transition hover:shadow-[0_12px_40px_rgba(44,44,44,0.12)]"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={item.img}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="p-6 md:p-7">
                  <h3 className="font-display text-xl font-semibold text-[var(--foreground)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[var(--gray-dark)] leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-[var(--gray-dark)] px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-semibold text-white md:text-4xl">
              Pronta para a sua primeira sessão?
            </h2>
            <p className="mt-4 text-lg text-white/80">
              Reserve online e receba a confirmação por email. Sem complicações.
            </p>
            <Link
              href="/agendar"
              className="btn-primary mt-8 inline-flex shadow-lg"
            >
              Reservar Agora
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--gray-light)] bg-[var(--white)] px-4 py-12 md:px-8">
          <div className="mx-auto flex max-w-6xl justify-center">
            <div className="flex gap-8 text-sm text-[var(--gray-mid)]">
              <Link href="/agendar" className="hover:text-[var(--rose-gold)]">
                Reservar
              </Link>
              <Link href="/cliente" className="hover:text-[var(--rose-gold)]">
                Área do Cliente
              </Link>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-6xl text-center text-xs text-[var(--gray-mid)]">
            © {new Date().getFullYear()} MarDelux. Estúdio de massagens exclusivo.
          </p>
        </footer>
      </main>
    </div>
  );
}
