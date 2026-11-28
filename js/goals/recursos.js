// =========================================================
// RECURSOS DA SEMANA — visão central do dinheiro, antes de qualquer objetivo.
// Usa o mesmo plano da semana (buildWeek + allocate): não é um cálculo à parte.
//
//   entra (receitas previstas da semana)
//   − essenciais (vida) − obrigações (atrasados + contas) − mínimos
//   − futuras protegidas − reservas para contas que vêm
//   = potencial para objetivos
//   − objetivos (Guardar, por prioridade) − pedidos
//   = livre (vai para a dívida que mais custa)
//
// Exemplo: entra $500, conta obrigatória $300, dois objetivos de $500
//   → potencial $200; o 1º objetivo recebe $200, o 2º recebe $0.
// =========================================================
import { toISO } from "../core/calendar.js";
import { buildWeek, allocate, rendaEfetiva, tier, TIER_OBJETIVOS } from "../core/plan.js";
import { contasCorrentes } from "../core/caixa.js";
import { saldoAtual, base as baseSaldo } from "../core/saldo.js";

const r2 = (v) => Math.round(v * 100) / 100;
const n = (v) => Number(v) || 0;

function balde(i) {
  if (i.grupo === "colchao") return "objetivos";
  if (i.grupo === "vida") return "essenciais";
  if (i.grupo === "minimos") return "minimos";
  if (i.atrasado || i.acao === "pagar") return "obrigacoes";
  if (i.grupo === "pedidos") return i.protegido ? "futuras" : "pedidos";
  return "reservas";
}
export const BALDES = [
  { id: "essenciais", label: "Despesas essenciais" },
  { id: "obrigacoes", label: "Contas e atrasados" },
  { id: "minimos", label: "Pagamentos mínimos" },
  { id: "futuras", label: "Futuras com data" },
  { id: "reservas", label: "Reservas para contas que vêm" },
  { id: "objetivos", label: "Para os objetivos" },
  { id: "pedidos", label: "Pedidos e ocasiões" },
];

export function recursos(seed, state, payday) {
  const iso = toISO(payday);
  const ef = rendaEfetiva(seed, state, iso);
  const w = buildWeek(seed, state, payday);
  const { cover, ataque } = allocate(w, ef.valor);
  const soma = (f, campo) => r2(w.ordem.filter(f).reduce((a, i) => a + (campo === "cover" ? n(cover[i.id]) : n(i.valor)), 0));
  const baldes = BALDES.map((b) => ({ ...b, precisa: soma((i) => balde(i) === b.id), coberto: soma((i) => balde(i) === b.id, "cover") }));
  const antesDosObjetivos = soma((i) => tier(i) < TIER_OBJETIVOS);
  const objetivos = w.ordem.filter((i) => i.grupo === "colchao").map((i) => ({ id: i.id, objetivo: i.objetivo, nome: i.nome, pede: r2(i.valor), recebe: r2(n(cover[i.id])) }));
  // Já pago nesta semana (confirmado)
  const jaPago = r2(Object.values((state.pagos || {})[iso] || {}).reduce((a, p) => a + (p && typeof p === "object" ? n(p.valor) : 0), 0));
  // Saldo nas contas correntes (só as conferidas contam como confirmado)
  const contas = contasCorrentes(state);
  const conferidas = contas.filter((b) => baseSaldo(state, b));
  const saldo = r2(conferidas.reduce((a, b) => a + n(saldoAtual(state, b)), 0));
  return {
    iso,
    entra: r2(ef.valor), entraFonte: ef.previsao ? "projecao" : "confirmado",
    saldo, saldoFonte: !contas.length ? "pendente" : conferidas.length === contas.length ? "confirmado" : "estimativa",
    jaPago,
    baldes,
    obrigatorio: antesDosObjetivos,
    potencialObjetivos: r2(Math.max(0, ef.valor - antesDosObjetivos)),
    faltaParaObrigacoes: r2(Math.max(0, antesDosObjetivos - ef.valor)),
    objetivos,
    objetivosPedem: r2(objetivos.reduce((a, o) => a + o.pede, 0)),
    objetivosRecebem: r2(objetivos.reduce((a, o) => a + o.recebe, 0)),
    livre: r2(ataque),
  };
}
