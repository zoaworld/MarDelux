/**
 * API pública para obter os cards de destaque da homepage.
 * Cards do tipo "evento" são enriquecidos com dados do evento (titulo, descricao, imagemUrl, slug).
 * Usa Firebase Admin no servidor para garantir leitura fiável.
 */

import { NextResponse } from "next/server";
import { getHomeCards, getEventoById } from "@/lib/firebase";
import { getAdminFirestore } from "@/lib/firebase-admin";

async function getEventoParaCard(
  eventoId: string
): Promise<{ titulo?: string; descricao?: string; imagemUrl?: string; slug: string } | null> {
  const adminDb = getAdminFirestore();
  if (adminDb) {
    try {
      const docSnap = await adminDb.collection("eventos").doc(eventoId).get();
      if (!docSnap.exists) return null;
      const x = docSnap.data();
      const status = (x?.status as string) ?? "rascunho";
      const slug = (x?.slug as string) ?? "";
      if (status !== "publicado" || !slug) return null;
      const imagemUrl = typeof x?.imagemUrl === "string" && x.imagemUrl.trim() ? x.imagemUrl : undefined;
      return {
        titulo: (x?.titulo as string) ?? "",
        descricao: (x?.descricao as string) ?? "",
        imagemUrl,
        slug,
      };
    } catch {
      return null;
    }
  }
  const evento = await getEventoById(eventoId);
  if (!evento || evento.status !== "publicado" || !evento.slug) return null;
  return {
    titulo: evento.titulo ?? "",
    descricao: evento.descricao ?? "",
    imagemUrl: evento.imagemUrl && evento.imagemUrl.trim() ? evento.imagemUrl : undefined,
    slug: evento.slug,
  };
}

export async function GET() {
  try {
    const cards = await getHomeCards();
    const enriched = await Promise.all(
      cards.map(async (c) => {
        if (c.tipo === "evento" && c.eventoId) {
          const evento = await getEventoParaCard(c.eventoId);
          if (!evento) return null;
          return {
            ...c,
            titulo: evento.titulo ?? c.titulo ?? "",
            descricao: evento.descricao ?? c.descricao ?? "",
            imagemUrl: evento.imagemUrl ?? c.imagemUrl ?? undefined,
            slug: evento.slug,
          };
        }
        return c;
      })
    );

    const filtered = enriched.filter((c): c is NonNullable<typeof c> => c !== null);
    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[api/home-cards GET]", err);
    return NextResponse.json({ error: "Erro ao carregar" }, { status: 503 });
  }
}
