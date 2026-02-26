import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-[#171717]`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
