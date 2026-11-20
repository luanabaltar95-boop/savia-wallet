// =========================================================
// CAIXA DA SEMANA — quanto tenho disponível em cada conta corrente.
//   entra      salário (dividido entre as contas) + extras na conta principal
//   já paguei  o que marquei como pago, saindo de cada conta (com juros)
//   ajuste     diferença para o saldo real do banco (taxas, câmbio, tarifas)
//   state.renda[iso].porBanco  { [bancoId]: valor } parte do salário em outra conta
//   state.pagos[iso][id].banco  de onde saiu o pagamento
//   state.ajustesSaldo  [{ id, iso, banco, valor, data }]  valor > 0 = perdi
// =========================================================
import { bancosDe, CONTA } from "./gastos.js";
import { jurosDa } from "./plan.js";

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;

export const contasCorrentes = (state) => {
  const l = bancosDe(state).filter((b) => b.tipo !== "savings");
  return l.length ? l : [{ id: CONTA, banco: "Minha conta", tipo: "checking" }];
};
export const contaPrincipal = (state) => contasCorrentes(state)[0].id;

// De qual conta costumo pagar esse item (o último pagamento dele)
export function bancoDoItem(state, itemId) {
  const id = String(itemId).split("@")[0];
  const semanas = Object.keys(state.pagos || {}).sort().reverse();
  for (const s of semanas) {
    const p = (state.pagos[s] || {})[itemId] || Object.entries(state.pagos[s] || {}).find(([k]) => k.split("@")[0] === id)?.[1];
    if (p && p.banco) return p.banco;
  }
  return contaPrincipal(state);
}

export function caixaDaSemana(state, iso, efetivaValor, extraFeito = 0) {
  const contas = contasCorrentes(state);
  const pri = contaPrincipal(state);
  const linha = {};
  contas.forEach((b) => { linha[b.id] = { ...b, entra: 0, paguei: 0, ajuste: 0 }; });
  const split = (state.renda[iso] || {}).porBanco || {};
  let fora = 0;
  Object.entries(split).forEach(([id, v]) => { if (linha[id] && id !== pri) { linha[id].entra += n(v); fora += n(v); } });
  // Tudo que entra (antes dos juros) menos o que caiu nas outras contas fica na principal
  linha[pri].entra += efetivaValor + jurosDa(state, iso) - fora;
  Object.values(state.pagos[iso] || {}).forEach((p) => {
    if (!p || typeof p !== "object") return;
    const b = linha[p.banco] ? p.banco : pri;
    linha[b].paguei += n(p.valor) + n(p.juros);
  });
  linha[pri].paguei += extraFeito;
  (state.ajustesSaldo || []).filter((a) => a.iso === iso).forEach((a) => { const b = linha[a.banco] ? a.banco : pri; linha[b].ajuste += n(a.valor); });
  const lista = Object.values(linha).map((l) => ({ ...l, entra: r2(l.entra), paguei: r2(l.paguei), ajuste: r2(l.ajuste), disponivel: r2(l.entra - l.paguei - l.ajuste) }));
  const total = lista.reduce((a, l) => ({ entra: a.entra + l.entra, paguei: a.paguei + l.paguei, ajuste: a.ajuste + l.ajuste, disponivel: a.disponivel + l.disponivel }), { entra: 0, paguei: 0, ajuste: 0, disponivel: 0 });
  // Só mostra contas com movimento (a principal sempre)
  return { contas: lista.filter((l) => l.id === pri || l.entra || l.paguei || l.ajuste), total };
}

// Saldo real do banco: a diferença vira ajuste (taxas e câmbio) da semana
export function ajustarSaldo(state, iso, banco, disponivelCalculado, real) {
  const valor = r2(disponivelCalculado - real);
  if (Math.abs(valor) < 0.005) return 0;
  state.ajustesSaldo = [...(state.ajustesSaldo || []), { id: "aj-" + Date.now().toString(36), iso, banco, valor, data: new Date().toISOString().slice(0, 10) }];
  return valor;
}
export function desfazerAjustes(state, iso, banco) {
  state.ajustesSaldo = (state.ajustesSaldo || []).filter((a) => !(a.iso === iso && a.banco === banco));
}
