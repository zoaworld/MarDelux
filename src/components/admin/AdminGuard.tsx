"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const CACHE_KEY = "mardelux_admin_verified";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function getCachedAdmin(): { email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { email, verifiedAt } = JSON.parse(raw) as { email: string; verifiedAt: number };
    if (!email || typeof verifiedAt !== "number") return null;
    if (Date.now() - verifiedAt > CACHE_TTL_MS) return null;
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) return null;
    return { email };
  } catch {
    return null;
  }
}

function setCachedAdmin(email: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ email, verifiedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

function clearCachedAdmin(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [hasCachedSession] = useState(() => getCachedAdmin());

  useEffect(() => {
    if (loading) return;
    if (!user) {
      clearCachedAdmin();
      router.replace(`/login?redirect=${encodeURIComponent(pathname ?? "/admin")}`);
      return;
    }
    if (!isAdmin(user.email ?? undefined)) {
      clearCachedAdmin();
      return;
    }
    setCachedAdmin(user.email ?? "");
  }, [loading, user, router, pathname]);

  // Se temos cache válido e ainda estamos a carregar, mostramos o painel imediatamente
  const showOptimistically = loading && hasCachedSession;

  if (loading && !showOptimistically) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F5F5F5]">
        <div className="h-10 w-10 animate-pulse rounded-full bg-[#ddd]" />
        <p className="text-sm text-[#666]">A verificar acesso…</p>
      </div>
    );
  }

  // Firebase ainda a carregar, mas temos sessão em cache — mostramos o painel
  if (showOptimistically) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  if (!isAdmin(user.email ?? undefined)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F5] px-4">
        <p className="text-center text-lg font-medium text-[#171717]">
          Acesso reservado ao administrador.
        </p>
        <p className="mt-2 text-center text-sm text-[#666]">
          O seu email não está autorizado a aceder a esta área.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-[#b76e79] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#a65d68]"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
