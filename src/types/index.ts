/** Cliente (área do cliente + CRM) */
export interface Cliente {
  id: string;
  email: string;
  nome: string;
  telefone?: string;
  preferencias?: string;
  notas?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Serviço oferecido pelo estúdio */
export interface Servico {
  id: string;
  nome: string;
  descricao?: string;
  duracaoMinutos: number;
  preco: number;
  ativo: boolean;
  /** Ordem de exibição (menor = primeiro) */
  ordem?: number;
  /** Categoria para filtrar/agrupar (ex.: Massagem, Estética) */
  categoria?: string;
  /** URL de imagem do serviço */
  imagemUrl?: string;
  /** Destaque na listagem */
  destaque?: boolean;
}

/** Marcação/Agendamento */
export interface Marcacao {
  id: string;
  clienteId: string;
  servicoId: string;
  data: Date;
  horaInicio: string;
  horaFim: string;
  status: "pendente" | "confirmada" | "concluida" | "cancelada";
  pagamentoId?: string;
  notasSessao?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Configuração de horário de funcionamento */
export interface HorarioFuncionamento {
  diaSemana: number; // 0-6
  abre: string;
  fecha: string;
  fechado?: boolean;
}
