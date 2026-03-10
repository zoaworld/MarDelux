"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

type Perfil = { nome: string; email: string; telefone: string };

export default function ClienteContaPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut, updateProfileName, updateUserEmail, updateUserPassword } = useAuth();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formulário de perfil (nome, telefone)
  const [form, setForm] = useState({ nome: "", telefone: "" });

  // Formulário de alterar email
  const [emailForm, setEmailForm] = useState({ novoEmail: "", passwordAtual: "" });
  const [savingEmail, setSavingEmail] = useState(false);

  // Formulário de alterar palavra-passe
  const [passForm, setPassForm] = useState({ novaPass: "", passAtual: "" });
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    const token = user.getIdToken?.();
    if (!token) return;
    setLoading(true);
    token
      .then((t) =>
        fetch("/api/cliente/perfil", { headers: { Authorization: `Bearer ${t}` } })
      )
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar perfil");
        return res.json();
      })
      .then((data: Perfil) => {
        setPerfil(data);
        setForm({ nome: data.nome, telefone: data.telefone ?? "" });
      })
      .catch(() => setError("Não foi possível carregar o perfil."))
      .finally(() => setLoading(false));
  }, [user?.email]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const handleSavePerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const token = await user.getIdToken?.();
      if (!token) throw new Error("Sessão inválida");
      const res = await fetch("/api/cliente/perfil", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome: form.nome.trim(), telefone: form.telefone.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data.error as string) ?? "Erro ao guardar");
      }
      const data = (await res.json()) as Perfil;
      setPerfil(data);
      setForm({ nome: data.nome, telefone: data.telefone ?? "" });
      if (form.nome.trim()) await updateProfileName(form.nome.trim());
      setSuccess("Dados atualizados com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    const newEmail = emailForm.novoEmail.trim();
    if (!newEmail || !emailForm.passwordAtual) {
      setError("Preencha o novo email e a palavra-passe atual.");
      return;
    }
    setError(null);
    setSuccess(null);
    setSavingEmail(true);
    try {
      const oldEmail = user.email;
      await updateUserEmail(newEmail, emailForm.passwordAtual);
      const token = await auth?.currentUser?.getIdToken?.(true);
      if (token) {
        const res = await fetch("/api/cliente/perfil/alterar-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ oldEmail }),
        });
        if (!res.ok) throw new Error("Erro ao atualizar email nas marcações");
      }
      setSuccess("Email alterado com sucesso. Irá receber um email de confirmação.");
      setEmailForm({ novoEmail: "", passwordAtual: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!passForm.passAtual || !passForm.novaPass || passForm.novaPass.length < 6) {
      setError("Preencha a palavra-passe atual e a nova (mín. 6 caracteres).");
      return;
    }
    setError(null);
    setSuccess(null);
    setSavingPass(true);
    try {
      await updateUserPassword(passForm.novaPass, passForm.passAtual);
      setSuccess("Palavra-passe alterada com sucesso.");
      setPassForm({ novaPass: "", passAtual: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar palavra-passe.");
    } finally {
      setSavingPass(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--gray-mid)]">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gray-light)] bg-[var(--white)] px-4 py-4 shadow-[var(--shadow-soft)] md:px-8">
        <nav className="mx-auto flex max-w-4xl items-center justify-between">
          <Logo variant="text" height={40} />
          <div className="flex items-center gap-4">
            <Link href="/cliente" className="text-sm font-medium text-[var(--gray-dark)] hover:text-[var(--rose-gold)]">
              As minhas marcações
            </Link>
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

      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/cliente" className="text-sm text-[var(--gray-mid)] hover:text-[var(--rose-gold)]">
          ← Voltar às marcações
        </Link>
        <p className="font-display mt-4 text-sm uppercase tracking-[0.2em] text-[var(--rose-gold)]">
          Editar Conta
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold text-[var(--foreground)]">
          Informações pessoais
        </h1>
        <p className="mt-2 text-[var(--gray-dark)]">
          Atualize o seu nome, telefone, email ou palavra-passe.
        </p>

        {success && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-[var(--gray-mid)]">A carregar…</p>
        ) : (
          <div className="mt-8 space-y-10">
            {/* Nome e telefone */}
            <section className="card-elevated p-6">
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                Dados de contacto
              </h2>
              <form onSubmit={handleSavePerfil} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]">Nome</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="O seu nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]">Telemóvel</label>
                  <input
                    type="tel"
                    value={form.telefone}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="ex: 912 345 678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--gray-mid)]">Email atual</label>
                  <p className="mt-1 text-sm text-[var(--foreground)]">{perfil?.email ?? user.email}</p>
                  <p className="mt-1 text-xs text-[var(--gray-mid)]">
                    Para alterar o email, use o formulário abaixo.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary disabled:opacity-60"
                >
                  {saving ? "A guardar…" : "Guardar alterações"}
                </button>
              </form>
            </section>

            {/* Alterar email */}
            <section className="card-elevated p-6">
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                Alterar email
              </h2>
              <p className="mt-1 text-sm text-[var(--gray-dark)]">
                Será necessário confirmar a alteração e voltar a iniciar sessão.
              </p>
              <form onSubmit={handleChangeEmail} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]">Novo email</label>
                  <input
                    type="email"
                    value={emailForm.novoEmail}
                    onChange={(e) => setEmailForm((f) => ({ ...f, novoEmail: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="novo@email.pt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]">
                    Palavra-passe atual (confirmação)
                  </label>
                  <input
                    type="password"
                    value={emailForm.passwordAtual}
                    onChange={(e) => setEmailForm((f) => ({ ...f, passwordAtual: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="Para confirmar a alteração"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="btn-secondary disabled:opacity-60"
                >
                  {savingEmail ? "A processar…" : "Alterar email"}
                </button>
              </form>
            </section>

            {/* Alterar palavra-passe */}
            <section className="card-elevated p-6">
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
                Alterar palavra-passe
              </h2>
              <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]">Palavra-passe atual</label>
                  <input
                    type="password"
                    value={passForm.passAtual}
                    onChange={(e) => setPassForm((f) => ({ ...f, passAtual: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="Para confirmar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)]">Nova palavra-passe</label>
                  <input
                    type="password"
                    value={passForm.novaPass}
                    onChange={(e) => setPassForm((f) => ({ ...f, novaPass: e.target.value }))}
                    minLength={6}
                    className="input-elegant mt-1"
                    placeholder="Mín. 6 caracteres"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingPass}
                  className="btn-secondary disabled:opacity-60"
                >
                  {savingPass ? "A processar…" : "Alterar palavra-passe"}
                </button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
