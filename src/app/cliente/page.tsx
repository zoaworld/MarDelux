"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getMarcacoesByClienteEmail } from "@/lib/firebase";

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
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
        <p className="text-[#666]">A carregar…</p>
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
    <div className="min-h-screen bg-[#F5F5F5]">
      <header className="border-b border-[#eee] bg-white px-4 py-4 md:px-8">
        <nav className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-[#b76e79] hover:opacity-90"
          >
            MarDelux
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#666]">{user.email}</span>
            <button
              type="button"
              onClick={() => signOut().then(() => router.push("/"))}
              className="text-sm text-[#b76e79] hover:underline"
            >
              Sair
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-[#171717]">
          Área do Cliente
        </h1>
        <p className="mt-1 text-[#666]">
          As suas marcações e histórico. Para nova reserva use o mesmo email que registou.
        </p>

        <div className="mt-6 flex gap-4">
          <Link
            href="/agendar"
            className="rounded-full bg-[#b76e79] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#a65d68]"
          >
            Nova marcação
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-medium text-[#171717]">Próximas marcações</h2>
          {loading ? (
            <p className="mt-2 text-sm text-[#666]">A carregar…</p>
          ) : proximas.length === 0 ? (
            <p className="mt-2 text-sm text-[#666]">
              Não tem marcações futuras.{" "}
              <Link href="/agendar" className="text-[#b76e79] hover:underline">
                Reservar agora
              </Link>
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {proximas.map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-[#eee] bg-white p-4"
                >
                  <p className="font-medium text-[#171717]">{m.servicoNome}</p>
                  <p className="text-sm text-[#666]">
                    {formatDate(m.data)} · {m.horaInicio} – {m.horaFim} ·{" "}
                    {m.duracaoMinutos} min
                    {m.preco != null && ` · ${m.preco} €`}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.status === "confirmada"
                        ? "bg-green-100 text-green-800"
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

        <section className="mt-10">
          <h2 className="text-lg font-medium text-[#171717]">Histórico</h2>
          {!loading && historico.length === 0 ? (
            <p className="mt-2 text-sm text-[#666]">Ainda não tem sessões no histórico.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {historico.slice(0, 10).map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl border border-[#eee] bg-white p-4 opacity-80"
                >
                  <p className="font-medium text-[#171717]">{m.servicoNome}</p>
                  <p className="text-sm text-[#666]">
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
