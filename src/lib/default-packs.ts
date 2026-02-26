export interface Pack {
  id: string;
  nome: string;
  descricao: string;
  numSessoes: number;
  preco: number;
  precoUnitario: number; // preço por sessão (para mostrar desconto)
  ativo: boolean;
}

export const DEFAULT_PACKS: Pack[] = [
  {
    id: "pack-3",
    nome: "Pack 3 Sessões",
    descricao: "3 sessões de massagem de relaxamento (60 min). Válido 6 meses.",
    numSessoes: 3,
    preco: 150,
    precoUnitario: 50,
    ativo: true,
  },
  {
    id: "pack-5",
    nome: "Pack 5 Sessões",
    descricao: "5 sessões à sua escolha. Válido 12 meses. Melhor valor.",
    numSessoes: 5,
    preco: 230,
    precoUnitario: 46,
    ativo: true,
  },
  {
    id: "pack-10",
    nome: "Pack 10 Sessões",
    descricao: "10 sessões com o máximo desconto. Válido 18 meses.",
    numSessoes: 10,
    preco: 420,
    precoUnitario: 42,
    ativo: true,
  },
];
