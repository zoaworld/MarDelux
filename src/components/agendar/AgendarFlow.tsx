"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import {
  getServicos,
  getMarcacoesByDate,
  getSlotsDisponiveis,
  createMarcacao,
  getHorarioConfig,
} from "@/lib/firebase";
import { SlotPicker } from "@/components/ui/SlotPicker";
import { DEFAULT_SERVICOS } from "@/lib/default-servicos";
import type { Servico } from "@/types";
import type { HorarioConfig } from "@/lib/firebase";

const STEPS = ["Serviço", "Data e hora", "Confirmação"] as const;

function formatDate(str: string): string {
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Calendário mensal para seleção de data */
function Calendario({
  selectedData,
  onSelect,
  minDate,
}: {
  selectedData: string | null;
  onSelect: (date: string) => void;
  minDate: string;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);

  const monthLabel = viewDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = new Date().toISOString().slice(0, 10);
  const minTime = new Date(minDate + "T00:00:00").getTime();

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(prevMonth)}
          className="rounded-lg p-2 text-[var(--gray-dark)] hover:bg-[var(--gray-light)]"
          aria-label="Mês anterior"
        >
          ←
        </button>
        <span className="font-semibold capitalize text-[var(--foreground)]">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewDate(nextMonth)}
          className="rounded-lg p-2 text-[var(--gray-dark)] hover:bg-[var(--gray-light)]"
          aria-label="Mês seguinte"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekdays.map((w) => (
          <div key={w} className="py-1 font-medium text-[var(--gray-mid)]">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const cellDate = new Date(year, month, d);
          const cellTime = cellDate.getTime();
          const isPast = cellTime < minTime;
          const isSelected = selectedData === dateStr;
          const isToday = dateStr === today;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && onSelect(dateStr)}
              className={`aspect-square rounded-lg py-1 text-sm transition ${
                isPast
                  ? "cursor-not-allowed text-[var(--gray-mid)]/50"
                  : isSelected
                    ? "bg-[var(--rose-gold)] text-white"
                    : isToday
                      ? "bg-[var(--rose-gold-light)] font-semibold text-[var(--rose-gold)]"
                      : "text-[var(--foreground)] hover:bg-[var(--gray-light)]"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Converte hora início + duração em hora fim (HH:mm) */
function horaFim(horaInicio: string, duracaoMinutos: number): string {
  const [h, m] = horaInicio.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + duracaoMinutos;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

interface ParceiroValidado {
  id: string;
  nome: string;
  tipo: "essencial" | "premium";
  codigo: string;
}

export default function AgendarFlow() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedData, setSelectedData] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedHora, setSelectedHora] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "" });
  /** Cliente existente resolvido por email+telefone (sem login). Usar nome e id da ficha na marcação. */
  const [clienteResolvido, setClienteResolvido] = useState<{
    id: string;
    nome: string;
    indicadoPorParceiroNome?: string;
    indicadoPorParceiroCodigo?: string;
    indicadoPorParceiroId?: string;
  } | null>(null);
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [resolvendoCliente, setResolvendoCliente] = useState(false);
  const [codigoParceiro, setCodigoParceiro] = useState("");
  const [parceiroValidado, setParceiroValidado] = useState<ParceiroValidado | null>(null);
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [erroCodigo, setErroCodigo] = useState<string | null>(null);
  const [codigoPromo, setCodigoPromo] = useState("");
  const [codigoPromoValidado, setCodigoPromoValidado] = useState<{
    id: string;
    descontoPercentagem: number;
  } | null>(null);
  const [validandoCodigoPromo, setValidandoCodigoPromo] = useState(false);
  const [erroCodigoPromo, setErroCodigoPromo] = useState<string | null>(null);

  // Ler ref da URL e preencher código + validar (sem email/telefone na 1ª carga)
  useEffect(() => {
    const ref = searchParams.get("ref")?.trim().toUpperCase();
    if (!ref) return;
    setCodigoParceiro(ref);
    setValidandoCodigo(true);
    setErroCodigo(null);
    fetch(`/api/parceiros/validar?codigo=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valido && data.parceiro) {
          setParceiroValidado({
            id: data.parceiro.id,
            nome: data.parceiro.nome,
            tipo: data.parceiro.tipo,
            codigo: data.parceiro.codigo,
          });
        } else {
          setErroCodigo(
            data.erroCodigoExclusivo ?? "Código inválido ou inativo."
          );
        }
      })
      .catch(() => setErroCodigo("Não foi possível validar o código."))
      .finally(() => setValidandoCodigo(false));
  }, [searchParams]);

  const validarCodigo = useCallback(async () => {
    const code = codigoParceiro.trim().toUpperCase();
    if (!code) {
      setParceiroValidado(null);
      setErroCodigo(null);
      return;
    }
    setValidandoCodigo(true);
    setErroCodigo(null);
    try {
      const params = new URLSearchParams({ codigo: code });
      if (form.email.trim()) params.set("email", form.email.trim());
      if (form.telefone.trim()) params.set("telefone", form.telefone.trim());
      const res = await fetch(`/api/parceiros/validar?${params.toString()}`);
      const data = await res.json();
      if (data.valido && data.parceiro) {
        setParceiroValidado({
          id: data.parceiro.id,
          nome: data.parceiro.nome,
          tipo: data.parceiro.tipo,
          codigo: data.parceiro.codigo,
        });
        setCodigoParceiro(data.parceiro.codigo);
      } else {
        setParceiroValidado(null);
        setErroCodigo(
          data.erroCodigoExclusivo ?? "Código inválido ou inativo."
        );
      }
    } catch {
      setParceiroValidado(null);
      setErroCodigo("Não foi possível validar o código.");
    } finally {
      setValidandoCodigo(false);
    }
  }, [codigoParceiro, form.email, form.telefone]);

  const validarCodigoPromo = useCallback(async () => {
    const code = codigoPromo.trim().toUpperCase();
    if (!code) {
      setCodigoPromoValidado(null);
      setErroCodigoPromo(null);
      return;
    }
    setValidandoCodigoPromo(true);
    setErroCodigoPromo(null);
    try {
      const res = await fetch(`/api/codigos/validar?codigo=${encodeURIComponent(code)}&tipo=site`);
      const data = await res.json();
      if (data.valido && data.descontoPercentagem != null) {
        setCodigoPromoValidado({ id: data.id, descontoPercentagem: data.descontoPercentagem });
      } else {
        setCodigoPromoValidado(null);
        setErroCodigoPromo(data.erro ?? "Código inválido ou inativo.");
      }
    } catch {
      setCodigoPromoValidado(null);
      setErroCodigoPromo("Não foi possível validar o código.");
    } finally {
      setValidandoCodigoPromo(false);
    }
  }, [codigoPromo]);

  // Preencher email automaticamente quando o utilizador está logado
  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email ?? "" }));
    }
  }, [user?.email, form.email]);

  // Passo 3 com utilizador logado: carregar perfil e preencher nome/telefone (não pedir dados)
  useEffect(() => {
    if (step !== 3 || !user) return;
    let cancelled = false;
    user.getIdToken().then((token) => {
      if (cancelled) return;
      fetch("/api/cliente/perfil", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || data.error) return;
          const nome = (data.nome ?? "").trim();
          const email = (data.email ?? "").trim();
          const telefone = (data.telefone ?? "").trim();
          setForm({ nome, email, telefone });
          setPerfilCarregado(true);
          // Resolver cliente para obter clienteId e ligar a marcação à ficha
          if (email && telefone) {
            const params = new URLSearchParams({ email, telefone });
            fetch(`/api/agendar/resolver-cliente?${params}`)
              .then((r2) => r2.json())
              .then((data2) => {
                if (!cancelled && data2.encontrado && data2.cliente) {
                  setClienteResolvido({
                    id: data2.cliente.id,
                    nome: data2.cliente.nome ?? nome,
                    indicadoPorParceiroNome: data2.cliente.indicadoPorParceiroNome,
                    indicadoPorParceiroCodigo: data2.cliente.indicadoPorParceiroCodigo,
                    indicadoPorParceiroId: data2.cliente.indicadoPorParceiroId,
                  });
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [step, user]);

  // Sem login: resolver cliente por email+telefone quando ambos estão preenchidos
  useEffect(() => {
    if (user || step !== 3) return;
    const email = form.email.trim().toLowerCase();
    const telefone = form.telefone.trim();
    if (!email || !email.includes("@") || !telefone || telefone.replace(/\D/g, "").length < 6) {
      setClienteResolvido(null);
      return;
    }
    setResolvendoCliente(true);
    const params = new URLSearchParams({ email, telefone });
    fetch(`/api/agendar/resolver-cliente?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.encontrado && data.cliente) {
          setClienteResolvido({
            id: data.cliente.id,
            nome: data.cliente.nome ?? "",
            indicadoPorParceiroNome: data.cliente.indicadoPorParceiroNome,
            indicadoPorParceiroCodigo: data.cliente.indicadoPorParceiroCodigo,
            indicadoPorParceiroId: data.cliente.indicadoPorParceiroId,
          });
          setForm((f) => ({ ...f, nome: (data.cliente.nome ?? "").trim() }));
        } else {
          setClienteResolvido(null);
        }
      })
      .catch(() => setClienteResolvido(null))
      .finally(() => setResolvendoCliente(false));
  }, [step, user, form.email, form.telefone]);

  const [preferenciaPagamento, setPreferenciaPagamento] = useState<"na_sessao" | "agora">("na_sessao");
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [horarioConfig, setHorarioConfig] = useState<HorarioConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHorarioConfig(), getServicos()])
      .then(([config, list]) => {
        if (cancelled) return;
        setHorarioConfig(config);
        if (list.length > 0) setServicos(list);
        else setServicos(DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` })));
      })
      .catch(() => {
        if (!cancelled) setServicos(DEFAULT_SERVICOS.map((s, i) => ({ ...s, id: `default-${i}` })));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (step !== 2 || !selectedData || !selectedServico) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedHora(null);
    getMarcacoesByDate(selectedData)
      .then((ocupados) => {
        const config = horarioConfig ?? undefined;
        const disp = getSlotsDisponiveis(selectedData, selectedServico.duracaoMinutos, ocupados, config);
        setSlots(disp);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [step, selectedData, selectedServico, horarioConfig]);

  const precoOriginal = selectedServico?.preco ?? 0;
  const temDescontoParceiro = !!parceiroValidado;
  const temDescontoPromo = !!codigoPromoValidado;
  const precoFinal = temDescontoPromo
    ? Math.round(precoOriginal * (1 - codigoPromoValidado!.descontoPercentagem / 100) * 100) / 100
    : temDescontoParceiro
      ? Math.round(precoOriginal * 0.9 * 100) / 100
      : precoOriginal;

  const handleConfirmar = async () => {
    if (!selectedServico || !selectedData || !selectedHora) return;
    if (!form.nome.trim() || !form.email.trim() || !form.telefone.trim()) {
      setError("Por favor preencha nome, email e telefone.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const horaFimCalc = horaFim(selectedHora, selectedServico.duracaoMinutos);
      const marcacaoPayload = {
        clienteNome: form.nome.trim(),
        clienteEmail: form.email.trim(),
        clienteTelefone: form.telefone.trim() || undefined,
        ...(clienteResolvido?.id && { clienteId: clienteResolvido.id }),
        ...(clienteResolvido?.indicadoPorParceiroNome && !parceiroValidado && {
          origemParceiroNome: clienteResolvido.indicadoPorParceiroNome,
        }),
        servicoId: selectedServico.id,
        servicoNome: selectedServico.nome,
        duracaoMinutos: selectedServico.duracaoMinutos,
        preco: precoFinal,
        data: selectedData,
        horaInicio: selectedHora,
        preferenciaPagamento,
        ...(parceiroValidado && !temDescontoPromo && {
          parceiroId: parceiroValidado.id,
          parceiroCodigo: parceiroValidado.codigo,
          precoOriginal: precoOriginal,
          descontoParceiro: precoOriginal - precoFinal,
          primeiraSessaoIndicacao: true,
        }),
        ...(codigoPromoValidado && {
          codigoPromocionalId: codigoPromoValidado.id,
          precoOriginal: precoOriginal,
          descontoEvento: precoOriginal - precoFinal,
        }),
      };
      const id = await createMarcacao(marcacaoPayload);
      if (codigoPromoValidado) {
        try {
          await fetch("/api/codigos/incrementar-uso", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigoId: codigoPromoValidado.id }),
          });
        } catch {
          /* ignorar */
        }
      }
      try {
        await fetch("/api/email/confirmacao-marcacao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteEmail: form.email.trim(),
            clienteNome: form.nome.trim(),
            data: selectedData,
            horaInicio: selectedHora,
            horaFim: horaFimCalc,
            servicoNome: selectedServico.nome,
            preco: precoFinal,
          }),
        });
      } catch {
        /* ignorar falha no email – marcação já foi criada */
      }
      setCreatedId(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível guardar a marcação. Tente novamente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const mbWayPhone = process.env.NEXT_PUBLIC_MBWAY_PHONE ?? "";

  if (createdId && selectedServico) {
    return (
      <div className="card-elevated mx-auto max-w-lg p-8 text-center">
        <div className="text-5xl text-[var(--rose-gold)]">✓</div>
        <h2 className="font-display mt-4 text-xl font-semibold text-[var(--foreground)]">
          Marcação efetuada
        </h2>
        <p className="mt-2 text-[var(--gray-dark)]">
          A sua sessão foi registada e receberá um email de confirmação em{" "}
          <strong>{form.email}</strong>.
        </p>
        {preferenciaPagamento === "agora" && (
          <div className="mt-6 rounded-xl border-2 border-[var(--rose-gold-light)] bg-[var(--rose-gold-light)]/30 p-5 text-left">
            <h3 className="font-display font-semibold text-[var(--foreground)]">
              Pagamento por MB Way
            </h3>
            <p className="mt-2 text-sm text-[var(--gray-dark)]">
              Envie <strong>{precoFinal} €</strong>
              {mbWayPhone ? (
                <> para o número <strong>{mbWayPhone}</strong> (MarDelux).</>
              ) : (
                <> — entre em contacto connosco para obter o número de pagamento.</>
              )}
            </p>
            <p className="mt-1 text-sm text-[var(--gray-dark)]">
              Após o envio, iremos confirmar a sua marcação brevemente.
            </p>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/cliente?fresh=1" className="btn-primary">
            Ver as minhas marcações
          </Link>
          <Link href="/" className="btn-secondary">
            Voltar ao início
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreatedId(null);
              setStep(1);
              setSelectedServico(null);
              setSelectedData(null);
              setSelectedHora(null);
              setForm({ nome: "", email: "", telefone: "" });
              setPerfilCarregado(false);
              setClienteResolvido(null);
              setPreferenciaPagamento("na_sessao");
              setCodigoParceiro("");
              setParceiroValidado(null);
              setErroCodigo(null);
            }}
            className="btn-secondary"
          >
            Nova marcação
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const bufferMin = horarioConfig?.bufferMinutes ?? 15;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Indicador de passos */}
      <div className="mb-8 flex justify-between gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-center text-sm font-medium transition ${
              i + 1 === step
                ? "bg-[var(--rose-gold)] text-white shadow-md"
                : i + 1 < step
                  ? "bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                  : "bg-[var(--gray-light)] text-[var(--gray-mid)]"
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              {i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {/* Passo 1: Serviço */}
      {step === 1 && (
        <div className="card-elevated overflow-hidden p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Escolha o serviço
          </h2>
          <p className="mt-1 text-sm text-[var(--gray-dark)]">
            Selecione o tipo de sessão e duração.
          </p>
          {loading ? (
            <p className="mt-6 text-[var(--gray-mid)]">A carregar serviços...</p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-1">
              {servicos.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServico(s);
                      setStep(2);
                    }}
                    className={`flex w-full flex-col rounded-xl border-2 p-4 text-left transition-all ${
                      selectedServico?.id === s.id
                        ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)] shadow-sm"
                        : "border-[var(--gray-light)] hover:border-[var(--rose-gold)]/40 hover:bg-[var(--gray-light)]/80"
                    }`}
                  >
                    <span className="font-semibold text-[var(--foreground)]">{s.nome}</span>
                    {s.descricao && (
                      <p className="mt-1 text-sm text-[var(--gray-dark)]">{s.descricao}</p>
                    )}
                    <p className="mt-2 text-sm font-medium text-[var(--rose-gold)]">
                      {s.duracaoMinutos} min · {s.preco} €
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Passo 2: Data e hora + timeline */}
      {step === 2 && selectedServico && (
        <div className="card-elevated overflow-hidden p-6 md:p-8">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-4 text-sm font-medium text-[var(--rose-gold)] hover:underline"
          >
            ← Alterar serviço
          </button>
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">
            Data e hora
          </h2>
          <p className="mt-1 text-sm text-[var(--gray-dark)]">
            {selectedServico.nome} · {selectedServico.duracaoMinutos} min. Intervalo de {bufferMin} min entre sessões para preparação.
          </p>

          <p className="mt-6 text-sm font-semibold text-[var(--foreground)]">Data</p>
          <div className="mt-2">
            <Calendario
              selectedData={selectedData}
              onSelect={setSelectedData}
              minDate={today}
            />
          </div>

          {selectedData && (
            <>
              <p className="mt-6 text-sm font-semibold text-[var(--foreground)]">Hora de início</p>
              <div className="mt-2">
                <SlotPicker
                  slots={slots}
                  value={selectedHora ?? ""}
                  onChange={(h) => setSelectedHora(h)}
                  loading={loadingSlots}
                  emptyMessage="Sem horários disponíveis neste dia. Escolha outra data."
                  variant="default"
                  showPeriodTabs={slots.length > 6}
                />
              </div>

              {selectedData && selectedHora && (
                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-primary"
                  >
                    Continuar para confirmação
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Passo 3: Confirmação */}
      {step === 3 && selectedServico && selectedData && selectedHora && (
        <div className="card-elevated overflow-hidden p-6 md:p-8">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mb-4 text-sm font-medium text-[var(--rose-gold)] hover:underline"
          >
            ← Alterar data/hora
          </button>
          <h2 className="font-display text-xl font-semibold text-[var(--foreground)]">Confirmação</h2>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">Tem um código promocional?</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoParceiro}
                onChange={(e) => {
                  setCodigoParceiro(e.target.value.toUpperCase());
                  setParceiroValidado(null);
                  setErroCodigo(null);
                }}
                className="input-elegant flex-1"
                placeholder="ex: Delux-XX"
              />
              <button
                type="button"
                onClick={validarCodigo}
                disabled={validandoCodigo || !codigoParceiro.trim()}
                className="btn-secondary shrink-0 disabled:opacity-60"
              >
                {validandoCodigo ? "A validar…" : "Aplicar"}
              </button>
            </div>
            {erroCodigo && <p className="text-sm text-red-600">{erroCodigo}</p>}
            {parceiroValidado && !codigoPromoValidado && (
              <p className="text-sm text-green-700">
                10% de desconto aplicado (parceiro: {parceiroValidado.nome})
              </p>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">Código promocional (campanha)?</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={codigoPromo}
                onChange={(e) => {
                  setCodigoPromo(e.target.value.toUpperCase());
                  setCodigoPromoValidado(null);
                  setErroCodigoPromo(null);
                }}
                className="input-elegant flex-1"
                placeholder="ex: VERAO25"
              />
              <button
                type="button"
                onClick={validarCodigoPromo}
                disabled={validandoCodigoPromo || !codigoPromo.trim()}
                className="btn-secondary shrink-0 disabled:opacity-60"
              >
                {validandoCodigoPromo ? "A validar…" : "Aplicar"}
              </button>
            </div>
            {erroCodigoPromo && <p className="text-sm text-red-600">{erroCodigoPromo}</p>}
            {codigoPromoValidado && (
              <p className="text-sm text-green-700">
                {codigoPromoValidado.descontoPercentagem}% de desconto aplicado
              </p>
            )}
          </div>

          <div className="mt-4 rounded-xl border-2 border-[var(--rose-gold-light)] bg-[var(--rose-gold-light)]/50 p-5">
            <p className="font-semibold text-[var(--foreground)]">{selectedServico.nome}</p>
            <p className="mt-1 text-sm text-[var(--gray-dark)]">
              {formatDate(selectedData)}
            </p>
            <p className="text-sm font-medium text-[var(--rose-gold)]">
              {selectedHora} – {horaFim(selectedHora, selectedServico.duracaoMinutos)} · {selectedServico.duracaoMinutos} min
              {(temDescontoParceiro || temDescontoPromo) ? (
                <>
                  {" "}
                  <span className="line-through text-[var(--gray-mid)]">{precoOriginal} €</span>{" "}
                  <span>{precoFinal} €</span>{" "}
                  <span className="text-xs text-green-700">
                    (-{temDescontoPromo ? codigoPromoValidado!.descontoPercentagem : 10}%)
                  </span>
                </>
              ) : (
                <> · {precoOriginal} €</>
              )}
            </p>
          </div>

          <div className="mt-6">
            <p className="text-sm text-[var(--gray-dark)]">
              Pode pagar durante a sessão ou agora por MB Way, conforme for mais conveniente.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPreferenciaPagamento("na_sessao")}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                  preferenciaPagamento === "na_sessao"
                    ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                    : "border-[var(--gray-light)] text-[var(--foreground)] hover:border-[var(--rose-gold)]/40"
                }`}
              >
                Na sessão
              </button>
              <button
                type="button"
                onClick={() => setPreferenciaPagamento("agora")}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                  preferenciaPagamento === "agora"
                    ? "border-[var(--rose-gold)] bg-[var(--rose-gold-light)] text-[var(--rose-gold)]"
                    : "border-[var(--gray-light)] text-[var(--foreground)] hover:border-[var(--rose-gold)]/40"
                }`}
              >
                Agora por MB Way
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {user && perfilCarregado ? (
              <div className="rounded-xl border-2 border-[var(--gray-light)] bg-[var(--gray-light)]/30 p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">A marcar como</p>
                <p className="mt-1 text-[var(--gray-dark)]">
                  {form.nome || "—"} · {form.email || "—"} · {form.telefone || "—"}
                </p>
                {(clienteResolvido?.indicadoPorParceiroNome || clienteResolvido?.indicadoPorParceiroCodigo) && (
                  <p className="mt-2 text-sm text-[var(--gray-dark)]">
                    Código de parceiro utilizado:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {clienteResolvido.indicadoPorParceiroCodigo ?? "—"}
                    </span>
                    {clienteResolvido.indicadoPorParceiroNome && (
                      <> — {clienteResolvido.indicadoPorParceiroNome}</>
                    )}
                  </p>
                )}
                <p className="mt-2 text-xs text-[var(--gray-mid)]">
                  Os dados são os da sua conta. Para alterar, edite o seu perfil na área de cliente.
                </p>
              </div>
            ) : (
              <>
                {clienteResolvido && (
                  <div className="rounded-xl border-2 border-[var(--rose-gold-light)] bg-[var(--rose-gold-light)]/30 p-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Cliente reconhecido: utilizamos os dados da sua ficha
                      {clienteResolvido.indicadoPorParceiroNome
                        ? ` (origem: ${clienteResolvido.indicadoPorParceiroNome})`
                        : ""}.
                    </p>
                    {resolvendoCliente && (
                      <p className="mt-1 text-xs text-[var(--gray-mid)]">A verificar…</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)]">Nome *</label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="O seu nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)]">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="o seu@email.pt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)]">Telefone *</label>
                  <input
                    type="tel"
                    value={form.telefone}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                    className="input-elegant mt-1"
                    placeholder="ex: 912 345 678"
                    required
                  />
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={submitting || (!!user && !perfilCarregado)}
              className="btn-primary disabled:opacity-60"
            >
              {user && !perfilCarregado
                ? "A carregar…"
                : submitting
                  ? "A guardar…"
                  : "Confirmar marcação"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-[var(--gray-mid)]">
        <Link href="/" className="text-[var(--rose-gold)] hover:underline">
          ← Voltar ao início
        </Link>
      </p>
    </div>
  );
}
