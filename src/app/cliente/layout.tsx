import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Área do Cliente",
  description:
    "Veja e gerencie as suas marcações no MarDelux. Aceda à sua área de cliente.",
  robots: { index: false, follow: true },
};

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
