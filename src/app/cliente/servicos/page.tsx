"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getServicos } from "@/lib/firebase";
import { DEFAULT_SERVICOS } from "@/lib/default-servicos";
import { DEFAULT_PACKS } from "@/lib/default-packs";
import type { Servico } from "@/types";
import Logo from "@/components/Logo";

export default function ClienteServicosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    getServicos()
      .then((list) => {
        if (list.length > 0) setServicos(list);
        else setServicos(DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` })));
      })
      .catch(() => setServicos(DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` }))))
      .finally(() => setLoading(false));
  }, []);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    );
  }

  const packs = DEFAULT_PACKS.filter((p) => p.ativo);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)] md:px-8">
        <nav className="mx-auto flex max-w-4xl items-center justify-between">
          <Logo variant="text" height={40} />
          <Link
            href="/cliente"
            className="text-sm font-medium text-[var(--gray-dark)] transition hover:text-[var(--rose-gold)]"
          >
            Área do Cliente
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--rose-gold)]">
          Serviços
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-[var(--foreground)]">
          Serviços e packs
        </h1>
        <p className="mt-2 text-[var(--gray-dark)]">
          Compre sessões avulso ou packs com desconto. O pagamento será processado em breve via Stripe.
        </p>

        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Serviços
          </h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--gray-mid)]">A carregar…</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {servicos.map((s) => (
                <li
                  key={s.id}
                  className="card-elevated flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-[var(--foreground)]">{s.nome}</p>
                    {s.descricao && (
                      <p className="mt-1 text-sm text-[var(--gray-dark)]">{s.descricao}</p>
                    )}
                    <p className="mt-2 text-sm font-medium text-[var(--rose-gold)]">
                      {s.duracaoMinutos} min · {s.preco} €
                    </p>
                  </div>
                  <Link
                    href={`/cliente/checkout?tipo=servico&id=${encodeURIComponent(s.id)}&nome=${encodeURIComponent(s.nome)}&preco=${s.preco}`}
                    className="btn-primary shrink-0"
                  >
                    Comprar
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Packs
          </h2>
          <ul className="mt-4 space-y-4">
            {packs.map((p) => (
              <li
                key={p.id}
                className="card-elevated flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">{p.nome}</p>
                  <p className="mt-1 text-sm text-[var(--gray-dark)]">{p.descricao}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--rose-gold)]">
                    {p.numSessoes} sessões · {p.preco} € ({p.precoUnitario} €/sessão)
                  </p>
                </div>
                <Link
                  href={`/cliente/checkout?tipo=pack&id=${encodeURIComponent(p.id)}&nome=${encodeURIComponent(p.nome)}&preco=${p.preco}`}
                  className="btn-primary shrink-0"
                >
                  Comprar pack
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-sm text-[var(--gray-mid)]">
          <Link href="/cliente" className="text-[var(--rose-gold)] hover:underline">
            ← Voltar à área do cliente
          </Link>
        </p>
      </main>
    </div>
  );
}
