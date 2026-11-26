// =========================================================
// ENTRADAS — de onde vem o meu dinheiro, cadastrado uma vez.
//   state.config.entradas: [{
//     id, nome, tipo: "fixo" | "variavel",
//     valor        fixo: o valor · variável: estimativa (se não somar da calculadora)
//     dia          dia da semana em que cai (0–6); vazio = no dia do pagamento
//     conta        conta que recebe
//     divisao      [{ conta, valor }] parte que cai em outras contas (fixo)
//     calc         id da calculadora de Extra que soma o previsto (variável)
//   }]
//   state.renda[iso].entradas: { [id]: { valor, confirmado, ts } }  exceções e confirmações da semana
// Fixo entra sozinho no dia. Variável fica "previsto" até eu confirmar.
// Semanas antigas (só com renda[iso].salario digitado) continuam como eram.
// =========================================================
import { toISO, fromISO, addDays, pagamentoAnterior, getCiclo } from "./calendar.js";
import { liquidoFonte } from "./extra.js";
import { contasCorrentes, contaPrincipal } from "./contasCorrentes.js";

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;

export const lista = (state) => ((state.config || {}).entradas || []);
export const temEntradas = (state) => lista(state).length > 0;

// Semana usa as entradas cadastradas? (semana antiga com salário digitado fica como era)
export function usaEntradas(state, iso) {
  if (!temEntradas(state)) return false;
  const r = state.renda[iso] || {};
  return !!r.entradas || !(Number(r.salario) > 0);
}

// Dia em que a entrada cai dentro do período do pagamento (anterior, pagamento]
export function dataNaSemana(entrada, payday) {
  const p = typeof payday === "string" ? fromISO(payday) : payday;
  if (entrada.dia === "" || entrada.dia == null || getCiclo().tipo !== "semanal") return p;
  const w = Number(entrada.dia);
  const ini = pagamentoAnterior(p);
  for (let d = addDays(ini, 1); d <= p; d = addDays(d, 1)) if (d.getDay() === w) return d;
  return p;
}

// Momento em que o dinheiro conta como "caiu" (fixo: 6h do dia)
const tsDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6).getTime();

// Como cada entrada fica na semana
export function entradasDaSemana(seed, state, iso, agora = Date.now()) {
  const r = state.renda[iso] || {};
  const reg = r.entradas || {};
  const pri = contaPrincipal(state);
  return lista(state).map((e) => {
    const data = dataNaSemana(e, iso);
    const ts = tsDoDia(data);
    const x = reg[e.id] || {};
    const fonte = e.calc && (seed.fontes || []).find((f) => f.id === e.calc);
    // Variável com calculadora: o que já registrei; sem nada ainda, o valor de sempre
    const daCalc = fonte ? r2(liquidoFonte(state, fonte, iso)) : 0;
    const previsto = e.tipo === "fixo" ? n(e.valor) : daCalc > 0 ? daCalc : n(e.valor);
    const valor = x.valor != null && x.valor !== "" ? n(x.valor) : previsto;
    const confirmado = e.tipo === "fixo" ? (x.confirmado !== false && agora >= ts) : !!x.confirmado;
    // Para onde vai: divisão (fixo) e o resto na conta da entrada
    const conta = e.conta || pri;
    const partes = [];
    let fora = 0;
    (e.tipo === "fixo" ? e.divisao || [] : []).forEach((d) => { if (d.conta && n(d.valor) > 0 && d.conta !== conta) { partes.push({ conta: d.conta, valor: n(d.valor) }); fora += n(d.valor); } });
    partes.unshift({ conta, valor: r2(valor - fora) });
    return { ...e, iso, data: toISO(data), ts: confirmado && x.ts ? x.ts : ts, previsto, valor, confirmado, mudou: x.valor != null && x.valor !== "", partes, pendente: e.tipo === "variavel" && !confirmado && agora >= ts };
  });
}

export const totalEntradas = (l) => r2(l.reduce((a, e) => a + e.valor, 0));
// Variáveis ligadas a calculadoras já incluem o Extra Money delas
export const calcsUsadas = (state) => lista(state).filter((e) => e.tipo === "variavel" && e.calc).map((e) => e.calc);

// ---- Entradas avulsas da semana (acontecem uma vez; lanço na Hoje) ----
//   state.renda[iso].avulsas: [{ id, nome, valor, conta, data, ts }]
export const avulsas = (state, iso) => ((state.renda[iso] || {}).avulsas || []);
export const totalAvulsas = (state, iso) => r2(avulsas(state, iso).reduce((a, x) => a + n(x.valor), 0));
export function addAvulsa(state, iso, { nome, valor, conta, data }) {
  const r = state.renda[iso] || {};
  const ts = data ? fromISO(data).getTime() + 12 * 3600 * 1000 : Date.now();
  state.renda[iso] = { ...r, avulsas: [...(r.avulsas || []), { id: "av-" + Date.now().toString(36), nome: nome || "Outra entrada", valor: n(valor), conta, data, ts }] };
}
export function editAvulsa(state, iso, id, { nome, valor, conta, data }) {
  const r = state.renda[iso] || {};
  const ts = data ? fromISO(data).getTime() + 12 * 3600 * 1000 : Date.now();
  state.renda[iso] = { ...r, avulsas: (r.avulsas || []).map((x) => (x.id === id ? { ...x, nome: nome || x.nome, valor: n(valor), conta, data, ts } : x)) };
}
export function rmAvulsa(state, iso, id) {
  const r = state.renda[iso] || {};
  state.renda[iso] = { ...r, avulsas: (r.avulsas || []).filter((x) => x.id !== id) };
}

// ---- Ações da semana ----
function setReg(state, iso, id, campos) {
  const r = state.renda[iso] || {};
  state.renda[iso] = { ...r, entradas: { ...(r.entradas || {}), [id]: { ...((r.entradas || {})[id] || {}), ...campos } } };
}
export const confirmar = (state, iso, id, valor) => setReg(state, iso, id, { valor, confirmado: true, ts: Date.now() });
export const desconfirmar = (state, iso, id) => setReg(state, iso, id, { confirmado: false, ts: null });
export const mudarValor = (state, iso, id, valor) => setReg(state, iso, id, { valor });
export const voltarPadrao = (state, iso, id) => {
  const r = state.renda[iso] || {};
  const e = { ...(r.entradas || {}) };
  delete e[id];
  state.renda[iso] = { ...r, entradas: e };
};
