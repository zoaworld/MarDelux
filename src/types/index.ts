/** Sensibilidade à dor */
export type SensibilidadeDor = "baixa" | "media" | "alta";

/** Cliente (ficha completa no painel admin) */
export interface Cliente {
  id: string;
  email: string;
  nome: string;
  telefone?: string;
  /** Data de nascimento (YYYY-MM-DD) */
  dataNascimento?: string;
  /** Data de criação da conta/cliente */
  clienteDesde?: string;
  /** Origem: como conheceu MarDelux */
  origem?: string;
  // Saúde
  problemasSaude?: boolean;
  medicacao?: boolean;
  contraindicatedoes?: boolean;
  sensibilidadeDor?: SensibilidadeDor;
  preferenciasAmbiente?: boolean;
  // Observações
  preferencias?: string; // Óleos, aromas, músicas
  reacoes?: string; // Reações a produtos e técnicas
  horarioPreferido?: string; // Horários de disponibilidade
  notasPessoais?: string; // Notas sobre comportamento e satisfação
  createdAt: string;
  updatedAt: string;
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

/** Método de pagamento (manual: dinheiro na loja, MB Way online, etc.) */
export type MetodoPagamento = "Dinheiro" | "MB Way" | "Multibanco" | "Cartão" | null;

/** Motivo de cancelamento (para avaliação de clientes: só "cliente_cancela" conta no total canceladas) */
export type MotivoCancelamento = "cliente_cancela" | "falha_tecnica" | "outro";

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
  motivoCancelamento?: MotivoCancelamento;
  motivoCancelamentoTexto?: string;
  reagendadoCount?: number;
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
