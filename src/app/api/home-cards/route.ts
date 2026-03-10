/**
 * API pública para obter os cards de destaque da homepage.
 * Cards do tipo "evento" são enriquecidos com dados do evento (titulo, descricao, imagemUrl, slug).
 */

import { NextResponse } from "next/server";
import { getHomeCards } from "@/lib/firebase";
import { getEventoById } from "@/lib/firebase/eventos";

export async function GET() {
  try {
    const cards = await getHomeCards();
    const enriched = await Promise.all(
      cards.map(async (c) => {
        if (c.tipo === "evento" && c.eventoId) {
          const evento = await getEventoById(c.eventoId);
          if (evento && evento.status === "publicado") {
            return {
              ...c,
              titulo: evento.titulo ?? c.titulo,
              descricao: evento.descricao ?? c.descricao,
              imagemUrl: evento.imagemUrl ?? c.imagemUrl,
              slug: evento.slug,
            };
          }
        }
        return c;
      })
    );
    return NextResponse.json(enriched);
  } catch (err) {
    console.error("[api/home-cards GET]", err);
    return NextResponse.json({ error: "Erro ao carregar" }, { status: 503 });
  }
}
