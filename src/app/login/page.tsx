"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/cliente";
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password, nome || undefined);
      }
      router.push(redirect.startsWith("/") ? redirect : "/cliente");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Ocorreu um erro. Tente novamente.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md card-elevated p-8 md:p-10">
        <Logo variant="text" height={40} className="block" />
        <h1 className="font-display mt-8 text-2xl font-semibold text-[var(--foreground)]">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-[var(--gray-dark)]">
          {mode === "login"
            ? "Aceda à sua área de cliente."
            : "Registe-se para ver as suas marcações e histórico."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input-elegant mt-1"
                placeholder="O seu nome"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-elegant mt-1"
              placeholder="o seu@email.pt"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)]">
              Palavra-passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input-elegant mt-1"
              placeholder="Mín. 6 caracteres"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? "A processar…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "login" ? "register" : "login"));
            setError(null);
          }}
          className="mt-6 w-full text-center text-sm text-[var(--gray-mid)] hover:text-[var(--rose-gold)]"
        >
          {mode === "login"
            ? "Ainda não tem conta? Registe-se"
            : "Já tem conta? Entrar"}
        </button>

        <p className="mt-8 text-center text-sm text-[var(--gray-mid)]">
          <Link href="/" className="text-[var(--rose-gold)] hover:underline">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
