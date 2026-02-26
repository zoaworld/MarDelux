export { app, auth, db, storage, getAnalyticsSafe } from "./config";
export { getServicos, getServicoById } from "./services";
export {
  getMarcacoesByDate,
  getMarcacoesByClienteEmail,
  getSlotsDisponiveis,
  createMarcacao,
  type MarcacaoInput,
} from "./marcacoes";
