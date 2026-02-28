"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminGuard from "@/components/admin/AdminGuard";
import { AdminDataProvider } from "@/contexts/AdminDataContext";
import Logo from "@/components/Logo";

const NAV = [
  { href: "/admin", label: "Agenda" },
  { href: "/admin/crm", label: "CRM" },
  { href: "/admin/financeiro", label: "Financeiro" },
  { href: "/admin/configuracoes", label: "Configurações" },
];

export default function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AdminGuard>
      <AdminDataProvider>
      <div className="min-h-screen bg-[var(--background)]">
        <aside className="fixed left-0 top-0 z-10 h-full w-56 border-r border-[var(--gray-light)] bg-[var(--white)] p-5 shadow-[var(--shadow-soft)]">
          <Link href="/admin" className="flex items-center gap-2 text-[var(--rose-gold)] hover:opacity-90">
            <Logo variant="lotus" height={40} linkToHome={false} />
            <span className="text-sm font-medium">Admin</span>
          </Link>
          <nav className="mt-6 flex flex-col gap-1 text-sm">
            {NAV.map(({ href, label }) => {
              const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-2 transition ${active ? "bg-[var(--rose-gold-light)] font-medium text-[var(--rose-gold)]" : "text-[var(--gray-mid)] hover:bg-[var(--gray-light)] hover:text-[var(--foreground)]"}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="pl-56 p-8">{children}</main>
      </div>
      </AdminDataProvider>
    </AdminGuard>
  );
}
