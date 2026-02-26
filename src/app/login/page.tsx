"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
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
      router.push("/cliente");
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
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="text-lg font-semibold text-[#b76e79] hover:underline"
        >
          MarDelux
        </Link>
        <h1 className="mt-6 text-xl font-semibold text-[#171717]">
          {mode === "login" ? "Entrar" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-[#666]">
          {mode === "login"
            ? "Aceda à sua área de cliente."
            : "Registe-se para ver as suas marcações e histórico."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-[#171717]">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717] focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
                placeholder="O seu nome"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#171717]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717] focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
              placeholder="o seu@email.pt"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#171717]">
              Palavra-passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-[#171717] focus:border-[#b76e79] focus:outline-none focus:ring-1 focus:ring-[#b76e79]"
              placeholder="Mín. 6 caracteres"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#b76e79] py-2.5 text-sm font-medium text-white transition hover:bg-[#a65d68] disabled:opacity-60"
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
          className="mt-4 w-full text-center text-sm text-[#666] hover:text-[#b76e79]"
        >
          {mode === "login"
            ? "Ainda não tem conta? Registe-se"
            : "Já tem conta? Entrar"}
        </button>

        <p className="mt-6 text-center text-sm text-[#666]">
          <Link href="/" className="text-[#b76e79] hover:underline">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
