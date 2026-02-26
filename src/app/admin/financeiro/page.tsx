"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAllMarcacoes } from "@/lib/firebase";

function formatMonth(str: string) {
  return new Date(str + "-01").toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
}

export default function AdminFinanceiroPage() {
  const [marcacoes, setMarcacoes] = useState<
    Array<{ data: string; preco: number; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllMarcacoes()
      .then((list) => setMarcacoes(list))
      .catch(() => setMarcacoes([]))
      .finally(() => setLoading(false));
  }, []);

  const concluidas = marcacoes.filter(
    (m) => m.status === "concluida" || m.status === "confirmada"
  );

  const porDia = concluidas.reduce<Record<string, number>>((acc, m) => {
    acc[m.data] = (acc[m.data] ?? 0) + m.preco;
    return acc;
  }, {});

  const porMes = concluidas.reduce<Record<string, number>>((acc, m) => {
    const mes = m.data.slice(0, 7);
    acc[mes] = (acc[mes] ?? 0) + m.preco;
    return acc;
  }, {});

  const totalGeral = concluidas.reduce((s, m) => s + m.preco, 0);
  const diasOrdenados = Object.keys(porDia).sort().slice(-14);
  const mesesOrdenados = Object.keys(porMes).sort().slice(-6);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#171717]">Gestão Financeira</h1>
        <Link href="/" className="text-sm text-[#b76e79] hover:underline">
          ← Voltar ao site
        </Link>
      </div>

      {loading ? (
        <p className="text-[#666]">A carregar…</p>
      ) : (
        <>
          <div className="mb-8 rounded-xl bg-[#b76e79] p-6 text-white shadow-sm">
            <p className="text-sm opacity-90">Total faturado (confirmadas + concluídas)</p>
            <p className="text-3xl font-semibold">{totalGeral.toFixed(2)} €</p>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-lg font-medium text-[#171717]">
              Faturação por dia (últimos 14 dias)
            </h2>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <ul className="space-y-2">
                {diasOrdenados.length === 0 ? (
                  <li className="text-[#666]">Sem dados.</li>
                ) : (
                  diasOrdenados.map((data) => (
                    <li
                      key={data}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-[#666]">
                        {new Date(data + "T12:00:00").toLocaleDateString("pt-PT", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span className="font-medium text-[#171717]">
                        {porDia[data].toFixed(2)} €
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-lg font-medium text-[#171717]">
              Faturação por mês
            </h2>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <ul className="space-y-2">
                {mesesOrdenados.length === 0 ? (
                  <li className="text-[#666]">Sem dados.</li>
                ) : (
                  [...mesesOrdenados].reverse().map((mes) => (
                    <li
                      key={mes}
                      className="flex justify-between text-sm"
                    >
                      <span className="capitalize text-[#666]">{formatMonth(mes)}</span>
                      <span className="font-medium text-[#171717]">
                        {porMes[mes].toFixed(2)} €
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-[#eee] bg-[#F5F5F5] p-6">
            <h2 className="mb-2 text-lg font-medium text-[#171717]">
              Pagamentos (Stripe)
            </h2>
            <p className="text-sm text-[#666]">
              Integração com Stripe para pagamentos online: em breve. Por agora, o
              controlo é feito pelas marcações confirmadas/concluídas acima.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
