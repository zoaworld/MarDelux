"use client";

/**
 * Badges para exibir associação a parceiros:
 * Mostra apenas o nome (ou código) do parceiro.
 */
export function ParceiroBadges({
  parceiroNome,
  parceiroCodigo,
  compact,
}: {
  parceiroNome?: string | null;
  parceiroCodigo?: string | null;
  compact?: boolean;
}) {
  if (!parceiroNome && !parceiroCodigo) return null;

  const label = parceiroNome ?? parceiroCodigo ?? null;
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#b76e79]/15 px-2 py-0.5 text-xs font-medium text-[#b76e79] ${compact ? "ml-1" : "mt-1 inline-block"}`}
      title={label}
    >
      {label}
    </span>
  );
}
