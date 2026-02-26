"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default function HeaderAdminLink() {
  const { user } = useAuth();
  if (!user?.email) return null;
  const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
  if (!isAdmin) return null;
  return (
    <Link href="/admin" className="btn-secondary py-2 text-sm">
      Painel Admin
    </Link>
  );
}
