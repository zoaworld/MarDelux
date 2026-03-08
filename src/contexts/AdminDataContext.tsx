"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAllMarcacoes, updateMarcacao } from "@/lib/firebase";
import type { MetodoPagamento } from "@/types";

export type MarcacaoAdmin = {
  id: string;
  clienteId?: string | null;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone?: string;
  servicoNome: string;
  servicoId: string;
  duracaoMinutos: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  status: string;
  preco: number;
  notasSessao?: string;
  preferenciaPagamento?: "na_sessao" | "agora";
  pagamentoRecebido?: boolean;
  metodoPagamento?: MetodoPagamento;
  motivoCancelamento?: "cliente_cancela" | "falha_tecnica" | "outro";
  motivoCancelamentoTexto?: string;
  reagendadoCount?: number;
};

interface AdminDataContextValue {
  marcacoes: MarcacaoAdmin[];
  loading: boolean;
  error: boolean;
  refresh: (force?: boolean) => Promise<void>;
  updateMarcacaoStatus: (id: string, status: string, extra?: { motivoCancelamento: "cliente_cancela" | "falha_tecnica" | "outro"; motivoCancelamentoTexto?: string }) => Promise<void>;
  updateMarcacaoNotas: (id: string, notasSessao?: string) => Promise<void>;
  updateMarcacaoPagamento: (id: string, data: { pagamentoRecebido: boolean; metodoPagamento?: MetodoPagamento; status?: string }) => Promise<void>;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [marcacoes, setMarcacoes] = useState<MarcacaoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async (force?: boolean) => {
    setLoading(true);
    setError(false);
    try {
      let list: MarcacaoAdmin[];
      const token = await user?.getIdToken?.();
      if (token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const url = force ? "/api/admin/marcacoes?nocache=1" : "/api/admin/marcacoes";
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          list = (await res.json()) as MarcacaoAdmin[];
        } else {
          throw new Error("API error");
        }
      } else {
        list = (await getAllMarcacoes()) as MarcacaoAdmin[];
      }
      setMarcacoes(list);
    } catch {
      try {
        const list = await getAllMarcacoes();
        setMarcacoes(list as MarcacaoAdmin[]);
      } catch {
        setError(true);
        setMarcacoes([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateMarcacaoStatus = useCallback(
    async (
      id: string,
      status: string,
      extra?: { motivoCancelamento: "cliente_cancela" | "falha_tecnica" | "outro"; motivoCancelamentoTexto?: string }
    ) => {
      const token = await user?.getIdToken?.();
      try {
        if (token) {
          const res = await fetch(`/api/admin/marcacoes/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status, ...extra }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data.error as string) ?? "Erro ao atualizar");
          }
        } else {
          await updateMarcacao(id, { status, ...extra });
        }
        setMarcacoes((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status, ...extra } : m))
        );
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [user, refresh]
  );

  const updateMarcacaoNotas = useCallback(
    async (id: string, notasSessao?: string) => {
      const token = await user?.getIdToken?.();
      try {
        if (token) {
          const res = await fetch(`/api/admin/marcacoes/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ notasSessao }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error((errData.error as string) ?? "Erro ao atualizar");
          }
        } else {
          await updateMarcacao(id, { notasSessao });
        }
        setMarcacoes((prev) =>
          prev.map((m) => (m.id === id ? { ...m, notasSessao } : m))
        );
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [user, refresh]
  );

  const updateMarcacaoPagamento = useCallback(
    async (id: string, data: { pagamentoRecebido: boolean; metodoPagamento?: MetodoPagamento; status?: string }) => {
      const token = await user?.getIdToken?.();
      try {
        if (token) {
          const res = await fetch(`/api/admin/marcacoes/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error((errData.error as string) ?? "Erro ao atualizar");
          }
        } else {
          await updateMarcacao(id, data);
        }
        setMarcacoes((prev) =>
          prev.map((m) => (m.id === id ? { ...m, ...data } : m))
        );
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [user, refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AdminDataContext.Provider
      value={{
        marcacoes,
        loading,
        error,
        refresh,
        updateMarcacaoStatus,
        updateMarcacaoNotas,
        updateMarcacaoPagamento,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error("useAdminData must be used within AdminDataProvider");
  return ctx;
}
