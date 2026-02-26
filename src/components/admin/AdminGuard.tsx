"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname ?? "/admin")}`);
      return;
    }
    if (!isAdmin(user.email ?? undefined)) {
      // não redirecionar, mostrar mensagem
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
        <p className="text-[#666]">A verificar acesso…</p>
      </div>
    );
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
