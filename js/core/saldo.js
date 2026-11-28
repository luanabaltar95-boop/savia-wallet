// =========================================================
// SALDO DAS CONTAS — calculado sozinho a partir do último saldo conferido.
//   saldo = conferido + entradas que caíram − pagamentos − gastos no débito
//           − pagamento a mais na dívida ± transferências + recebimentos
// Tudo conta só o que aconteceu DEPOIS da última conferência.
//   state.transferencias: [{ id, de, para, saiu, chegou, data, ts }]
//   state.ajustesSaldo:   [{ id, iso, banco, valor, ts }]  diferença na conferência
// =========================================================
import { CONTA } from "./gastos.js";
import { parte } from "./config.js";
import { contaPrincipal } from "./contasCorrentes.js";
import { usaEntradas, entradasDaSemana } from "./entradas.js";
import { toISO, fromISO, proximoPagamento, pagamentoSeguinte, pagamentoAte, semanaAberta } from "./calendar.js";

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const tsData = (iso) => (iso ? fromISO(iso).getTime() + 12 * 3600 * 1000 : 0);

// Último saldo conferido de uma conta
export function base(state, b) {
  if (b.id === CONTA && state.saldoConta) return { valor: state.saldoConta.valor, em: state.saldoConta.em || 0 };
  if (b.saldo == null || b.saldo === "") return null;
  return { valor: n(b.saldo), em: b.saldoEm || 0 };
}

// Tudo que mexeu na conta depois da conferência (mais recente primeiro)
export function movimentos(state, contaId, desde = 0, agora = Date.now()) {
  const pri = contaPrincipal(state);
  const daConta = (id) => (id || pri) === contaId;
  const out = [];
  const add = (ts, valor, desc, tipo, extra = {}) => { if (ts > desde && ts <= agora && Math.abs(valor) > 0.004) out.push({ ts, valor: r2(valor), desc, tipo, ...extra }); };

  // Entradas cadastradas que já caíram
  const seed = { fontes: parte(state, "fontes") };
  let p = pagamentoAte(new Date(Math.max(desde, 1)));
  const fim = proximoPagamento(new Date(agora));
  for (let k = 0; p <= fim && k < 120; k++, p = pagamentoSeguinte(p)) {
    const iso = toISO(p);
    if (!usaEntradas(state, iso)) continue;
    entradasDaSemana(seed, state, iso, agora).filter((e) => e.confirmado).forEach((e) =>
      e.partes.filter((x) => daConta(x.conta)).forEach((x) => add(e.ts, x.valor, e.nome, "entrada", { iso, entrada: e.id })));
  }
  // Entradas avulsas lançadas na Hoje
  Object.entries(state.renda || {}).forEach(([iso, r]) => ((r && r.avulsas) || []).forEach((a) => {
    if (daConta(a.conta)) add(a.ts || tsData(a.data), n(a.valor), a.nome || "Outra entrada", "entrada", { iso, avulsa: a.id });
  }));
  // Pagamentos marcados na Hoje
  Object.entries(state.pagos || {}).forEach(([iso, semana]) => Object.entries(semana || {}).forEach(([id, pg]) => {
    if (!pg || typeof pg !== "object") return;
    if (pg.para && pg.para === contaId && pg.para !== (pg.banco || pri)) add((pg.ts || tsData(pg.data)) + 1, n(pg.valor), pg.nome || "Guardei", "guardar", { iso, item: id });
    if (!daConta(pg.banco)) return;
    add(pg.ts || tsData(pg.data), -(n(pg.valor) + n(pg.juros)), pg.nome || id, "pagamento", { iso, item: id });
  }));
  // Gastos no débito
  (state.gastos || []).filter((g) => (g.conta || CONTA) === contaId).forEach((g) => add(g.ts || tsData(g.data), -n(g.valor), g.desc || "Gasto", "gasto"));
  // Pagamento a mais na dívida sai da conta principal
  if (contaId === pri) (state.movs || []).filter((m) => m.extra).forEach((m) => add(m.ts || tsData(m.data), -n(m.valor), "A mais na dívida", "divida"));
  // Recebimentos (A receber / Dividir) caem na principal
  if (contaId === pri) (state.recebimentos || []).forEach((r) => add(r.ts || tsData(r.data), n(r.valor), "Recebi", "recebi"));
  // Transferências
  (state.transferencias || []).forEach((t) => {
    if (t.de === contaId) add(t.ts || tsData(t.data), -n(t.saiu), `Transferi para ${t.paraNome || "outra conta"}`, "transf", { transf: t.id });
    if (t.para === contaId) add((t.ts || tsData(t.data)) + 1, n(t.chegou), `Veio de ${t.deNome || "outra conta"}`, "transf", { transf: t.id });
  });
  return out.sort((a, b) => b.ts - a.ts);
}

// Saldo agora (null se a conta nunca foi conferida)
export function saldoAtual(state, b, agora = Date.now()) {
  const bs = base(state, b);
  if (!bs) return null;
  return r2(bs.valor + movimentos(state, b.id, bs.em, agora).reduce((a, m) => a + m.valor, 0));
}

// O que ainda vai cair nesta semana (entradas previstas)
export function previstoNaConta(state, contaId, agora = Date.now()) {
  const iso = toISO(semanaAberta(state, new Date(agora)));
  if (!usaEntradas(state, iso)) return [];
  const pri = contaPrincipal(state);
  return entradasDaSemana({ fontes: parte(state, "fontes") }, state, iso, agora)
    .filter((e) => !e.confirmado)
    .flatMap((e) => e.partes.filter((x) => (x.conta || pri) === contaId && x.valor > 0.004).map((x) => ({ nome: e.nome, valor: x.valor, data: e.data, variavel: e.tipo === "variavel" })));
}

// Conferir com o banco: o saldo real vira a nova base; a diferença fica registrada
export function conferir(state, b, real, iso) {
  const calc = saldoAtual(state, b);
  const agora = Date.now();
  if (calc != null && Math.abs(calc - real) > 0.004) {
    state.ajustesSaldo = [...(state.ajustesSaldo || []), { id: "aj-" + agora.toString(36), iso: iso || toISO(semanaAberta(state)), banco: b.id, valor: r2(calc - real), ts: agora, data: toISO(new Date()) }];
  }
  if (b.id === CONTA && (state.saldoConta || !(state.bancos || []).some((x) => x.id === CONTA))) state.saldoConta = { banco: b.banco, valor: real, em: agora };
  if ((state.bancos || []).some((x) => x.id === b.id)) state.bancos = state.bancos.map((x) => (x.id === b.id ? { ...x, saldo: real, saldoEm: agora } : x));
  return calc == null ? 0 : r2(calc - real);
}

// Transferência entre contas: a diferença (saiu − chegou) é taxa
export function transferir(state, { de, para, saiu, chegou, data }, nomes = {}) {
  const t = { id: "tr-" + Date.now().toString(36), de, para, saiu: n(saiu), chegou: n(chegou || saiu), data, ts: Date.now(), deNome: nomes[de], paraNome: nomes[para] };
  state.transferencias = [...(state.transferencias || []), t];
  return t;
}
export const apagarTransferencia = (state, id) => { state.transferencias = (state.transferencias || []).filter((t) => t.id !== id); };
