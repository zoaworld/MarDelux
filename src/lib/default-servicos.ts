import type { Servico } from "@/types";

/** Serviços exibidos quando a coleção Firestore "servicos" está vazia (para demo/primeira utilização) */
export const DEFAULT_SERVICOS: Omit<Servico, "id">[] = [
  {
    nome: "Massagem de Relaxamento",
    descricao: "Sessão de 60 minutos para aliviar tensão e promover bem-estar.",
    duracaoMinutos: 60,
    preco: 55,
    ativo: true,
  },
  {
    nome: "Massagem Terapêutica",
    descricao: "Foco em zonas de tensão e recuperação muscular. 75 minutos.",
    duracaoMinutos: 75,
    preco: 65,
    ativo: true,
  },
  {
    nome: "Rituais MarDelux",
    descricao: "Experiência premium com aromas e pressão personalizada. 90 minutos.",
    duracaoMinutos: 90,
    preco: 85,
    ativo: true,
  },
];
