"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redireciona para Clientes - a opção "Nova marcação" está agora
 * disponível dentro da ficha de cada cliente.
 */
export default function AdminNovaMarcacaoRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/clientes");
  }, [router]);
  return (
    <div className="flex items-center justify-center p-12">
      <p className="text-[#666]">A redirecionar para Clientes…</p>
    </div>
  );
}
