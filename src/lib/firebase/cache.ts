/**
 * Cache em memória com TTL para reduzir chamadas repetidas ao Firestore.
 * Melhora a sensação de velocidade ao navegar no admin e no agendamento.
 */

const caches = new Map<
  string,
  { value: unknown; expires: number }
>();

const TTL_MS = {
  config: 2 * 60 * 1000,   // 2 min – horário e config geral
  servicos: 2 * 60 * 1000,  // 2 min – lista de serviços
  marcacoes: 1 * 60 * 1000, // 1 min – lista de marcações
};

function get<T>(key: string): T | undefined {
  const entry = caches.get(key);
  if (!entry || Date.now() > entry.expires) return undefined;
  return entry.value as T;
}

function set(key: string, value: unknown, ttlMs: number): void {
  caches.set(key, { value, expires: Date.now() + ttlMs });
}

export function getCached<T>(key: string, ttlMs: number, fetch: () => Promise<T>): Promise<T> {
  const cached = get<T>(key);
  if (cached !== undefined) return Promise.resolve(cached);
  return fetch().then((data) => {
    set(key, data, ttlMs);
    return data;
  });
}

export function invalidate(key: string): void {
  caches.delete(key);
}

export const CACHE_KEYS = {
  horario: "horario",
  servicos: "servicos",
  servicosAdmin: "servicosAdmin",
  marcacoes: "marcacoes",
} as const;

export const CACHE_TTL = TTL_MS;
