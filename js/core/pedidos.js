// =========================================================
// PEDIDOS DE ORÇAMENTO — "quero $X para tal data".
// Monta opções de como guardar e mede o impacto no plano:
// quanto atrasa a quitação dos cartões e se fecha até a data.
// =========================================================
import { toISO, fromISO, addDays, nextPayday, pagamentoSeguinte } from "./calendar.js";
import { serieAtaque, projetar } from "./plan.js";
import { simularCartoes } from "./debts.js";

const r2 = (n) => Math.round(n * 100) / 100;

// Sextas de pagamento entre a próxima e a data do pedido
export function sextasAte(dataISO) {
  const out = [];
  for (let d = nextPayday(); toISO(d) <= dataISO && out.length < 52; d = pagamentoSeguinte(d)) out.push(toISO(d));
  return out.length ? out : [toISO(nextPayday())];
}

function dividir(valor, sextas) {
  const base = r2(valor / sextas.length);
  const p = Object.fromEntries(sextas.map((s) => [s, base]));
  p[sextas[sextas.length - 1]] = r2(valor - base * (sextas.length - 1));
  return p;
}

export function opcoes(valor, dataISO) {
  const sextas = sextasAte(dataISO);
  const ops = [{ id: "igual", label: `Dividir igual em ${sextas.length} sexta${sextas.length > 1 ? "s" : ""}`, parcelas: dividir(valor, sextas) }];
  if (sextas.length >= 3) {
    const fim = sextas.slice(-2);
    ops.push({ id: "final", label: "Guardar nas 2 últimas sextas", parcelas: dividir(valor, fim) });
  }
  if (sextas.length >= 4) {
    const inicio = sextas.slice(0, Math.ceil(sextas.length / 2));
    ops.push({ id: "metade", label: `Guardar só nas ${inicio.length} primeiras`, parcelas: dividir(valor, inicio) });
  }
  return ops;
}

// Fim da quitação dos cartões e alertas com um estado qualquer
function cenario(seed, state) {
  const from = nextPayday();
  const sim = simularCartoes(seed, serieAtaque(seed, state, from));
  const proj = projetar(seed, state, from, 20);
  return { fim: sim.fim, alertas: proj.alertas };
}

export function impacto(seed, state, pedido) {
  const antes = cenario(seed, state);
  const depois = cenario(seed, { ...state, pedidos: [...(state.pedidos || []), pedido] });
  const dias = antes.fim && depois.fim ? Math.round((depois.fim - antes.fim) / 86400000) : null;
  const naoFecha = depois.alertas.some((a) => a.nome === pedido.nome);
  return { fimAntes: antes.fim, fimDepois: depois.fim, dias, naoFecha };
}

export function novoPedido({ nome, valor, data }, op) {
  return { id: "p-" + Date.now().toString(36), nome: nome.trim(), valor: Number(valor), data, parcelas: op.parcelas, criado: toISO(new Date()) };
}

export const parcelasTexto = (p, fmt) =>
  Object.entries(p.parcelas).map(([s, v]) => `${fmt.date(fromISO(s))}: ${fmt.money(v)}`).join(" · ");
