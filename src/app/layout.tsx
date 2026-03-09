import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import JsonLd from "@/components/JsonLd";
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

const SITE_URL = "https://mardelux.pt";

export const metadata: Metadata = {
  title: {
    default: "MarDelux | Estúdio de Massagens Exclusivo | Reservas Online",
    template: "%s | MarDelux",
  },
  description:
    "MarDelux - Estúdio de massagens exclusivo para mulheres em Portugal. Massagens relaxantes e terapêuticas. Reserve online de forma rápida e simples. mardelux.pt",
  keywords: [
    "massagens",
    "estúdio de massagens",
    "massagem relaxante",
    "massagem terapêutica",
    "bem-estar",
    "spa",
    "reservas online",
    "mardelux",
    "Portugal",
  ],
  authors: [{ name: "MarDelux", url: SITE_URL }],
  creator: "MarDelux",
  publisher: "MarDelux",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: SITE_URL,
    siteName: "MarDelux",
    title: "MarDelux | Estúdio de Massagens Exclusivo",
    description: "Estúdio de massagens exclusivo para mulheres. Massagens relaxantes e terapêuticas. Reserve agora em mardelux.pt.",
    images: [
      {
        url: "/images/ambiente-sereno.png",
        width: 1200,
        height: 630,
        alt: "MarDelux - Ambiente sereno para massagens",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MarDelux | Estúdio de Massagens Exclusivo",
    description: "Estúdio de massagens exclusivo para mulheres. Reserve online.",
    images: ["/images/ambiente-sereno.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  category: "beauty",
};

export const viewport = {
  themeColor: "#b76e79",
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
        <JsonLd config={config} />
        <Providers>{children}</Providers>
        {hasPhone && <WhatsAppFloat phoneNumber={phone} />}
      </body>
    </html>
  );
}
