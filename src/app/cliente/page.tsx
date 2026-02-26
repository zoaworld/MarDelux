"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getMarcacoesByClienteEmail } from "@/lib/firebase";
import Logo from "@/components/Logo";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function formatDate(str: string): string {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function ClientePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [marcacoes, setMarcacoes] = useState<
    Array<{
      id: string;
      servicoNome: string;
      data: string;
      horaInicio: string;
      horaFim: string;
      status: string;
      duracaoMinutos: number;
      preco?: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    getMarcacoesByClienteEmail(user.email)
      .then((list) => {
        const sorted = [...list].sort(
          (a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio)
        );
        setMarcacoes(sorted);
      })
      .catch(() => setMarcacoes([]))
      .finally(() => setLoading(false));
  }, [user?.email]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    );
  }

  const proximas = marcacoes.filter(
    (m) => m.status !== "cancelada" && m.data >= new Date().toISOString().slice(0, 10)
  );
  const historico = marcacoes.filter(
    (m) => m.data < new Date().toISOString().slice(0, 10) || m.status === "concluida"
  );

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)] md:px-8">
        <nav className="mx-auto flex max-w-4xl items-center justify-between">
          <Logo variant="text" height={40} />
          <div className="flex items-center gap-4">
            {isAdmin(user.email ?? undefined) && (
              <Link href="/admin" className="btn-secondary py-2 text-sm">
                Painel Admin
              </Link>
            )}
            <span className="text-sm text-[var(--gray-mid)]">{user.email}</span>
            <button
              type="button"
              onClick={() => signOut().then(() => router.push("/"))}
              className="text-sm font-medium text-[var(--rose-gold)] hover:underline"
            >
              Sair
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="font-display text-sm uppercase tracking-[0.2em] text-[var(--rose-gold)]">
          Área do Cliente
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-[var(--foreground)]">
          As suas marcações
        </h1>
        <p className="mt-2 text-[var(--gray-dark)]">
          Para nova reserva use o mesmo email que registou.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/agendar" className="btn-primary">
            Nova marcação
          </Link>
          <Link href="/cliente/servicos" className="btn-secondary">
            Comprar serviços e packs
          </Link>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Próximas marcações
          </h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--gray-mid)]">A carregar…</p>
          ) : proximas.length === 0 ? (
            <div className="card-elevated mt-3 p-6">
              <p className="text-[var(--gray-dark)]">
                Não tem marcações futuras.{" "}
                <Link href="/agendar" className="font-medium text-[var(--rose-gold)] hover:underline">
                  Reservar agora
                </Link>
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {proximas.map((m) => (
                <li key={m.id} className="card-elevated p-5">
                  <p className="font-medium text-[var(--foreground)]">{m.servicoNome}</p>
                  <p className="mt-1 text-sm text-[var(--gray-dark)]">
                    {formatDate(m.data)} · {m.horaInicio} – {m.horaFim} · {m.duracaoMinutos} min
                    {m.preco != null && ` · ${m.preco} €`}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                      m.status === "confirmada"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {m.status === "pendente" ? "Pendente" : "Confirmada"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Histórico
          </h2>
          {!loading && historico.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--gray-mid)]">
              Ainda não tem sessões no histórico.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {historico.slice(0, 10).map((m) => (
                <li
                  key={m.id}
                  className="card-elevated p-5 opacity-90"
                >
                  <p className="font-medium text-[var(--foreground)]">{m.servicoNome}</p>
                  <p className="text-sm text-[var(--gray-dark)]">
                    {formatDate(m.data)} · {m.horaInicio} · {m.duracaoMinutos} min
                    {m.preco != null && ` · ${m.preco} €`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
