import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na sua conta MarDelux para ver as suas marcações.",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
