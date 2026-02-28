/**
 * Cache em memória com TTL para reduzir chamadas repetidas ao Firestore.
 * Inclui coalescing: chamadas simultâneas partilham a mesma promise para evitar múltiplos fetches.
 */

const caches = new Map<
  string,
  { value: unknown; expires: number }
>();

/** Promises em voo – evita múltiplas chamadas simultâneas para o mesmo recurso */
const inFlight = new Map<string, Promise<unknown>>();

const TTL_MS = {
  config: 5 * 60 * 1000,   // 5 min – horário e config geral
  servicos: 5 * 60 * 1000,  // 5 min – lista de serviços
  marcacoes: 3 * 60 * 1000, // 3 min – lista de marcações (admin usa muito)
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

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetch().then((data) => {
    set(key, data, ttlMs);
    inFlight.delete(key);
    return data;
  }).catch((err) => {
    inFlight.delete(key);
    throw err;
  });
  inFlight.set(key, promise);
  return promise as Promise<T>;
}

export function invalidate(key: string): void {
  caches.delete(key);
}

export const CACHE_KEYS = {
  horario: "horario",
  site: "site",
  servicos: "servicos",
  servicosAdmin: "servicosAdmin",
  marcacoes: "marcacoes",
  /** Prefixo para cache de marcações por cliente: marcacoesCliente:${email} */
  marcacoesCliente: "marcacoesCliente",
} as const;

export function getCacheKeyForEmail(email: string) {
  return `${CACHE_KEYS.marcacoesCliente}:${email}`;
}

export const CACHE_TTL = TTL_MS;
