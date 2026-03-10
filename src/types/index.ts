/** Sensibilidade à dor */
export type SensibilidadeDor = "baixa" | "media" | "alta";

/** Tipo de parceria */
export type TipoParceria = "essencial" | "premium";

/** Parceiro (referral) */
export interface Parceiro {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoParceria;
  email: string;
  telefone?: string;
  estabelecimento?: string;
  notas?: string;
  sessaoGratuitaUtilizada: boolean;
  ativo: boolean;
  /** Parceiro eliminado (vs inativo: eliminado remove refs em clientes) */
  eliminado?: boolean;
  motivoEliminacao?: string;
  dataEliminacao?: string;
  createdAt: string;
  updatedAt: string;
}

/** Tipo de comissão */
export type TipoComissao = "primeira_sessao" | "sessao_seguinte";

/** Status da comissão */
export type StatusComissao = "pendente" | "pago";

/** Comissão de parceiro */
export interface Comissao {
  id: string;
  parceiroId: string;
  marcacaoId: string;
  clienteEmail: string;
  tipo: TipoComissao;
  valorSessao: number;
  percentagem: number;
  valorComissao: number;
  status: StatusComissao;
  /** Indica se o parceiro estava ativo na data da sessão (comissões de inativos não são pagas) */
  parceiroAtivoNaData?: boolean;
  dataSessao: string;
  dataPago?: string;
  createdAt: string;
}

/** Origem: como conheceu MarDelux (valores do select) */
export type Origem =
  | "Redes Sociais"
  | "Indicação"
  | "Parceiro"
  | "Outro"; // Outro pode ter texto livre adicional

/** Cliente (ficha completa no painel admin) */
export interface Cliente {
  id: string;
  email: string;
  nome: string;
  telefone?: string;
  /** Parceiro que indicou este cliente (para comissões em sessões seguintes - Premium) */
  indicadoPorParceiroId?: string;
  /** Nome do parceiro (preenchido pela API) */
  indicadoPorParceiroNome?: string;
  /** Data de nascimento (YYYY-MM-DD) */
  dataNascimento?: string;
  /** Data de criação da conta/cliente */
  clienteDesde?: string;
  /** Origem: como conheceu MarDelux */
  origem?: Origem | string;
  // Saúde
  problemasSaude?: string;
  medicacao?: string;
  contraindicatedoes?: string;
  sensibilidadeDor?: SensibilidadeDor;
  preferenciasAmbiente?: string;
  // Observações
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

/** Modelo do evento: interno (MarDelux) ou externo (referência) */
export type ModeloEvento = "interno" | "externo";

/** Participação: todos ou apenas users com conta */
export type ParticipacaoEvento = "todos" | "users";

/** Tipo de local do evento */
export type LocalEventoTipo = "mardelux" | "morada" | "link";

/** Status do evento */
export type StatusEvento = "rascunho" | "publicado";

/** Aplicação do código promocional */
export type TipoAplicacaoCodigo = "site" | "evento";

/** Evento */
export interface Evento {
  id: string;
  modelo: ModeloEvento;
  participacao: ParticipacaoEvento;
  titulo?: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  localTipo?: LocalEventoTipo;
  localValor?: string;
  contactoInfo?: string;
  imagemUrl?: string;
  servicosIds: string[];
  servicosMaxEscolha?: number;
  codigoAtivo: boolean;
  codigoPromocionalId?: string;
  checkoutAtivo: boolean;
  status: StatusEvento;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

/** Código promocional (independente de parceiros) */
export interface CodigoPromocional {
  id: string;
  codigo: string;
  descontoPercentagem: number;
  tipoAplicacao: TipoAplicacaoCodigo;
  eventoId?: string;
  validadeInicio?: string;
  validadeFim?: string;
  usosMaximos?: number;
  usosAtuais: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
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
  /** Parceiro que indicou (referral) */
  parceiroId?: string;
  parceiroCodigo?: string;
  precoOriginal?: number;
  descontoParceiro?: number;
  primeiraSessaoIndicacao?: boolean;
  /** Evento associado (checkout de evento) */
  eventoId?: string;
  /** Código promocional usado (evento ou site) */
  codigoPromocionalId?: string;
  /** Desconto em € aplicado por código promocional */
  descontoEvento?: number;
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

/** Tipo de card na secção de destaques da página inicial */
export type HomeCardTipo = "informativo" | "foto_link" | "evento";

/** Card da secção de destaques da página inicial (admin editável) */
export interface HomeCard {
  id: string;
  ordem: number;
  tipo: HomeCardTipo;
  /** URL da imagem (obrigatória para informativo e foto_link) */
  imagemUrl?: string;
  titulo?: string;
  /** Descrição curta (card colapsado) */
  descricao?: string;
  /** Conteúdo expandido ao clicar (só tipo informativo) */
  conteudoExpandido?: string;
  /** Link externo que abre em nova página (só tipo foto_link) */
  linkUrl?: string;
  /** ID do evento em admin/eventos (só tipo evento) — usa dados do evento */
  eventoId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Configuração dos cards de destaque da homepage (máx. 3) */
export interface HomeCardsConfig {
  cards: HomeCard[];
}
