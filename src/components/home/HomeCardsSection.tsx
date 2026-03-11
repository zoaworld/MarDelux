"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

type HomeCardDisplay = {
  id: string;
  tipo: "informativo" | "foto_link" | "evento";
  imagemUrl?: string;
  titulo?: string;
  descricao?: string;
  conteudoExpandido?: string;
  linkUrl?: string;
  slug?: string;
};

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80";

export default function HomeCardsSection() {
  const [cards, setCards] = useState<HomeCardDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/home-cards")
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setCards(data);
        else setCards([]);
      })
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || cards.length === 0) return null;

  const cols = cards.length === 1 ? 1 : cards.length === 2 ? 2 : 3;
  const gridCols =
    cols === 1
      ? "grid-cols-1"
      : cols === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
      <div className={`mt-14 grid gap-8 ${gridCols}`}>
        {cards.map((card) => {
          const imgSrc = card.imagemUrl || PLACEHOLDER_IMAGE;
          const isInformativo = card.tipo === "informativo";
          const isFotoLink = card.tipo === "foto_link";
          const isEvento = card.tipo === "evento";

          const href =
            isEvento && card.slug
              ? `/eventos/${card.slug}`
              : isFotoLink && card.linkUrl
                ? card.linkUrl
                : null;

          const content = (
            <article
              className={`card-elevated overflow-hidden transition hover:shadow-[0_12px_40px_rgba(44,44,44,0.12)] ${
                href ? "cursor-pointer" : ""
              } ${!href && isInformativo ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (isInformativo && card.conteudoExpandido) {
                  setExpandedId((id) => (id === card.id ? null : card.id));
                }
              }}
            >
              <div className="relative aspect-[4/3] min-h-0 w-full max-h-[min(50vh,28rem)]">
                <Image
                  src={imgSrc}
                  alt={card.titulo ?? ""}
                  fill
                  className="object-cover"
                  sizes={
                    cols === 1
                      ? "100vw"
                      : cols === 2
                        ? "50vw"
                        : "(max-width: 768px) 100vw, 33vw"
                  }
                  unoptimized
                />
              </div>
              <div className="p-6 md:p-7">
                <h3 className="font-display text-xl font-semibold text-[var(--foreground)]">
                  {card.titulo ?? ""}
                </h3>
                {card.descricao && (
                  <p className="mt-3 text-[var(--gray-dark)] leading-relaxed line-clamp-3">
                    {card.descricao}
                  </p>
                )}
                {isInformativo && card.conteudoExpandido && (
                  <p className="mt-2 text-sm font-medium text-[var(--rose-gold)]">
                    Clicar para ver mais →
                  </p>
                )}
              </div>
            </article>
          );

          if (href) {
            return (
              <Link
                key={card.id}
                href={href}
                target={isFotoLink ? "_blank" : undefined}
                rel={isFotoLink ? "noopener noreferrer" : undefined}
                className="block"
              >
                {content}
              </Link>
            );
          }

          return <div key={card.id}>{content}</div>;
        })}
      </div>

      {expandedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setExpandedId(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Escape" && setExpandedId(null)}
        >
          <div
            className="max-h-[80vh] max-w-2xl overflow-y-auto rounded-2xl bg-[var(--background)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const c = cards.find((x) => x.id === expandedId);
              if (!c) return null;
              return (
                <>
                  <h3 className="font-display text-2xl font-semibold text-[var(--foreground)]">
                    {c.titulo}
                  </h3>
                  <div className="mt-4 whitespace-pre-wrap text-[var(--gray-dark)] leading-relaxed">
                    {c.conteudoExpandido}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    className="btn-primary mt-6"
                  >
                    Fechar
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
