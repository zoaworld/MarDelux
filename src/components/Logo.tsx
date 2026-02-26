"use client";

import Link from "next/link";
import Image from "next/image";

type LogoVariant = "full" | "text" | "lotus";

const LOGO = {
  full: { src: "/logo/logo-completo.png", width: 160, height: 52 },
  text: { src: "/logo/logo-texto.png", width: 140, height: 40 },
  lotus: { src: "/logo/logo-lotus.png", width: 48, height: 48 },
} as const;

type LogoProps = {
  variant?: LogoVariant;
  /** Altura em px; a largura escala proporcionalmente */
  height?: number;
  /** Se false, não envolve em Link (ex.: dentro de outro link) */
  linkToHome?: boolean;
  className?: string;
  priority?: boolean;
};

export default function Logo({
  variant = "full",
  height,
  linkToHome = true,
  className = "",
  priority = false,
}: LogoProps) {
  const cfg = LOGO[variant];
  const h = height ?? cfg.height;
  const w = Math.round((cfg.width / cfg.height) * h);

  const img = (
    <Image
      src={cfg.src}
      alt="MarDelux"
      width={w}
      height={h}
      className={`object-contain ${className}`}
      priority={priority}
    />
  );

  if (linkToHome) {
    return (
      <Link href="/" className={`inline-flex items-center hover:opacity-90 transition-opacity ${className}`}>
        {img}
      </Link>
    );
  }
  return img;
}
