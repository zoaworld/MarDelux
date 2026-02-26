"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  const tipo = searchParams.get("tipo") ?? "";
  const id = searchParams.get("id") ?? "";
  const nome = searchParams.get("nome") ?? "Item";
  const preco = searchParams.get("preco") ?? "0";
  const precoNum = Number(preco) || 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || authLoading) return;
    if (!user) router.push("/login?redirect=/cliente/servicos");
  }, [mounted, authLoading, user, router]);

  if (!mounted || authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    );
  }

  if (!tipo || !id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4">
        <p className="text-[var(--gray-dark)]">Item inválido.</p>
        <Link href="/cliente/servicos" className="mt-4 text-[var(--rose-gold)] hover:underline">
          Voltar aos serviços
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)] md:px-8">
        <nav className="mx-auto flex max-w-4xl items-center justify-between">
          <Logo variant="text" height={40} />
          <Link
            href="/cliente/servicos"
            className="text-sm font-medium text-[var(--gray-dark)] transition hover:text-[var(--rose-gold)]"
          >
            ← Serviços
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--rose-gold)]">
          Checkout
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-[var(--foreground)]">
          Confirme o seu pedido
        </h1>
        <p className="mt-2 text-[var(--gray-dark)]">
          Pagamento em breve via Stripe.
        </p>

        <div className="card-elevated mt-8 p-6">
          <p className="font-medium text-[var(--foreground)]">{decodeURIComponent(nome)}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-[var(--rose-gold)]">
            {precoNum.toFixed(2)} €
          </p>
          <p className="mt-4 text-sm text-[var(--gray-dark)]">
            Email da conta: <strong>{user.email}</strong>
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/80 p-6">
          <h2 className="font-display font-medium text-[var(--foreground)]">
            Pagamento (em breve)
          </h2>
          <p className="mt-2 text-sm text-[var(--gray-dark)]">
            A integração com Stripe para pagamento seguro está prevista em breve.
            Por agora, pode reservar a sua sessão em{" "}
            <Link href="/agendar" className="font-medium text-[var(--rose-gold)] hover:underline">
              Agendar
            </Link>{" "}
            e combinar o pagamento no local.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/cliente/servicos" className="btn-secondary text-center">
            Voltar aos serviços
          </Link>
          <Link href="/cliente" className="btn-primary text-center">
            Ir para a área do cliente
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function ClienteCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
