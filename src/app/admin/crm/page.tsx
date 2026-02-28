"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminData } from "@/contexts/AdminDataContext";
import { CRMSkeleton } from "@/components/admin/AdminSkeleton";

function formatDate(str: string) {
  return new Date(str + "T12:00:00").toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminCRMPage() {
  const { marcacoes, loading, updateMarcacaoNotas } = useAdminData();
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [editingNotas, setEditingNotas] = useState<{ id: string; value: string } | null>(null);

  const clients = Array.from(
    new Map(
      marcacoes.map((m) => [
        m.clienteEmail,
        {
          email: m.clienteEmail,
          nome: m.clienteNome,
          telefone: m.clienteTelefone,
        },
      ])
    ).values()
  ).sort((a, b) => a.nome.localeCompare(b.nome));

  const clientMarcacoes = selectedEmail
    ? marcacoes
        .filter((m) => m.clienteEmail === selectedEmail)
        .sort((a, b) => b.data.localeCompare(a.data) || b.horaInicio.localeCompare(a.horaInicio))
    : [];

  const clientInfo = selectedEmail
    ? clients.find((c) => c.email === selectedEmail)
    : null;

  const saveNotas = async () => {
    if (!editingNotas) return;
    try {
      await updateMarcacaoNotas(editingNotas.id, editingNotas.value || undefined);
      setEditingNotas(null);
    } catch {
      setEditingNotas(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#171717]">CRM – Clientes</h1>
        <Link href="/" className="text-sm text-[#b76e79] hover:underline">
          ← Voltar ao site
        </Link>
      </div>

      {loading ? (
        <CRMSkeleton />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full rounded-xl bg-white p-4 shadow-sm lg:w-72">
            <h2 className="mb-3 text-sm font-medium text-[#666]">Lista de clientes</h2>
            <ul className="space-y-1">
              {clients.map((c) => (
                <li key={c.email}>
                  <button
                    type="button"
                    onClick={() => setSelectedEmail(c.email)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedEmail === c.email
                        ? "bg-[#b76e79] text-white"
                        : "hover:bg-[#F5F5F5] text-[#171717]"
                    }`}
                  >
                    {c.nome}
                  </button>
                </li>
              ))}
              {clients.length === 0 && (
                <li className="px-3 py-2 text-sm text-[#666]">Nenhum cliente ainda.</li>
              )}
            </ul>
          </aside>

          <div className="flex-1 rounded-xl bg-white p-6 shadow-sm">
            {!selectedEmail ? (
              <p className="text-[#666]">Selecione um cliente na lista.</p>
            ) : (
              <>
                <div className="mb-6 border-b border-[#eee] pb-4">
                  <h2 className="text-lg font-semibold text-[#171717]">
                    {clientInfo?.nome ?? selectedEmail}
                  </h2>
                  <p className="text-sm text-[#666]">{selectedEmail}</p>
                  {clientInfo?.telefone && (
                    <p className="text-sm text-[#666]">{clientInfo.telefone}</p>
                  )}
                </div>

                <h3 className="mb-3 text-sm font-medium text-[#171717]">
                  Histórico e notas de sessão (SOAP)
                </h3>
                <ul className="space-y-4">
                  {clientMarcacoes.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg border border-[#eee] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-[#171717]">
                          {m.servicoNome}
                        </span>
                        <span className="text-sm text-[#666]">
                          {formatDate(m.data)} · {m.horaInicio} · {m.preco} € ·{" "}
                          {m.status}
                        </span>
                      </div>
                      {editingNotas?.id === m.id ? (
                        <div className="mt-3">
                          <textarea
                            value={editingNotas.value}
                            onChange={(e) =>
                              setEditingNotas((prev) =>
                                prev ? { ...prev, value: e.target.value } : null
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                            rows={3}
                            placeholder="Notas de sessão (SOAP)..."
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={saveNotas}
                              className="rounded-lg bg-[#b76e79] px-3 py-1.5 text-sm text-white hover:bg-[#a65d68]"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNotas(null)}
                              className="rounded-lg border border-[#ddd] px-3 py-1.5 text-sm text-[#666] hover:bg-[#F5F5F5]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          {m.notasSessao ? (
                            <p className="whitespace-pre-wrap text-sm text-[#666]">
                              {m.notasSessao}
                            </p>
                          ) : (
                            <p className="text-sm italic text-[#999]">
                              Sem notas de sessão.
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setEditingNotas({
                                id: m.id,
                                value: m.notasSessao ?? "",
                              })
                            }
                            className="mt-1 text-sm text-[#b76e79] hover:underline"
                          >
                            {m.notasSessao ? "Editar notas" : "Adicionar notas"}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
