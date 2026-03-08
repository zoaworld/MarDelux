import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { getSiteConfig } from "@/lib/firebase/app-settings";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "MarDelux | Estúdio de Massagens Exclusivo",
  description:
    "MarDelux - Estúdio de massagens exclusivo para mulheres. Reservas online, serviços e packs. mardelux.pt",
  metadataBase: new URL("https://mardelux.pt"),
  openGraph: {
    title: "MarDelux | Estúdio de Massagens Exclusivo",
    description: "Estúdio de massagens exclusivo para mulheres. Reservar agora.",
    url: "https://mardelux.pt",
  },
};

const WHATSAPP_FALLBACK = "351910885800";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getSiteConfig();
  const phone = (config.telefone?.replace(/\D/g, "") || WHATSAPP_FALLBACK).trim();
  const hasPhone = phone.length >= 9;

  return (
    <html lang="pt">
      <body
        className={`${cormorant.variable} ${dmSans.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}
      >
        <Providers>{children}</Providers>
        {hasPhone && <WhatsAppFloat phoneNumber={phone} />}
      </body>
    </html>
  );
}
