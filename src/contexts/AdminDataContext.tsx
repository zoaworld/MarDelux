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

export type MarcacaoAdmin = {
  id: string;
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
};

interface AdminDataContextValue {
  marcacoes: MarcacaoAdmin[];
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  updateMarcacaoStatus: (id: string, status: string) => Promise<void>;
  updateMarcacaoNotas: (id: string, notasSessao?: string) => Promise<void>;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [marcacoes, setMarcacoes] = useState<MarcacaoAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      let list: MarcacaoAdmin[];
      const token = await user?.getIdToken?.();
      if (token) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch("/api/admin/marcacoes", {
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
    async (id: string, status: string) => {
      try {
        await updateMarcacao(id, { status });
        setMarcacoes((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status } : m))
        );
      } catch {
        await refresh();
      }
    },
    [refresh]
  );

  const updateMarcacaoNotas = useCallback(
    async (id: string, notasSessao?: string) => {
      try {
        await updateMarcacao(id, { notasSessao });
        setMarcacoes((prev) =>
          prev.map((m) => (m.id === id ? { ...m, notasSessao } : m))
        );
      } catch {
        await refresh();
      }
    },
    [refresh]
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
