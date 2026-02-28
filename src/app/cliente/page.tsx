"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getMarcacoesByClienteEmail } from "@/lib/firebase";
import Logo from "@/components/Logo";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const CACHE_KEY = "mardelux_cliente_marcacoes";
const CACHE_TTL_MS = 90 * 1000; // 1.5 min – cache local para repeat visits

type MarcacaoCliente = {
  id: string;
  servicoNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  status: string;
  duracaoMinutos: number;
  preco?: number;
};

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

function getCachedMarcacoes(email: string): MarcacaoCliente[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY}:${email}`);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw) as { data: MarcacaoCliente[]; expires: number };
    if (!Array.isArray(data) || Date.now() > expires) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedMarcacoes(email: string, data: MarcacaoCliente[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${CACHE_KEY}:${email}`,
      JSON.stringify({ data, expires: Date.now() + CACHE_TTL_MS })
    );
  } catch {
    /* ignore */
  }
}

export default function ClientePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [marcacoes, setMarcacoes] = useState<MarcacaoCliente[]>(() =>
    user?.email ? getCachedMarcacoes(user.email) ?? [] : []
  );
  const [loading, setLoading] = useState(!user?.email);

  const fetchMarcacoes = useCallback(async (email: string, authUser: { getIdToken: () => Promise<string> } | null, forceRefresh?: boolean) => {
    const cached = !forceRefresh ? getCachedMarcacoes(email) : null;
    if (cached !== null) {
      setMarcacoes(cached);
      setLoading(false);
      // Atualizar em background para garantir dados frescos
      void (async () => {
        try {
          const token = await authUser?.getIdToken?.();
          if (!token) return;
          const res = await fetch("/api/cliente/marcacoes", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const list = (await res.json()) as MarcacaoCliente[];
          setMarcacoes(list);
          setCachedMarcacoes(email, list);
        } catch {
          /* ignore background refresh */
        }
      })();
      return;
    }

    setLoading(true);
    try {
      const token = await authUser?.getIdToken?.();
      let list: MarcacaoCliente[] = [];

      if (token) {
        const url = forceRefresh
          ? "/api/cliente/marcacoes?nocache=1"
          : "/api/cliente/marcacoes";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            list = (await res.json()) as MarcacaoCliente[];
          } else {
            throw new Error("API error");
          }
        } catch (fetchErr) {
          clearTimeout(timeout);
          throw fetchErr;
        }
      } else {
        const firestoreList = await getMarcacoesByClienteEmail(email);
        list = firestoreList as MarcacaoCliente[];
      }

      const sorted = [...list].sort(
        (a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio)
      );
      setMarcacoes(sorted);
      setCachedMarcacoes(email, sorted);
    } catch {
      try {
        const firestoreList = await getMarcacoesByClienteEmail(email);
        const sorted = [...firestoreList].sort(
          (a, b) => (a.data as string).localeCompare(b.data as string) || (a.horaInicio as string).localeCompare(b.horaInicio as string)
        ) as MarcacaoCliente[];
        setMarcacoes(sorted);
        setCachedMarcacoes(email, sorted);
      } catch {
        setMarcacoes([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const forceRefresh = params?.get("fresh") === "1";
    if (forceRefresh && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/cliente");
    }
    fetchMarcacoes(user.email, user, forceRefresh);
  }, [user?.email, user, fetchMarcacoes]);

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
