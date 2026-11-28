// =========================================================
// CONFIGURAÇÃO — os dados iniciais (seed) com as suas edições por cima,
// e os saldos dos cartões atualizados com pagamentos e compras.
// state.config: partes editadas · state.movs: pagamentos/compras nos cartões
// =========================================================
import { SEED } from "../config/seed.js";
import { toISO, nextPayday } from "./calendar.js";
import { converterItens } from "./cambio.js";

export const EDITAVEIS = ["semanais", "mensais", "reservaItens", "pontuais", "parcelas", "receber", "compartilhadas", "fontes", "cartoes", "outras", "metas", "colchaoSemanal", "ciclo", "pedidos", "reservasPrazo", "alvos", "categorias", "inicio", "cartoesInicio", "objetivo", "objetivos"];

const clone = (v) => JSON.parse(JSON.stringify(v));

// Valor inicial de cada parte editável
export function base(chave) {
  if (chave === "reservaItens") return clone(SEED.reservasMensais.itens);
  return clone(SEED[chave]);
}

// Parte editável atual (editada ou inicial)
export function parte(state, chave) {
  const c = state.config || {};
  return c[chave] !== undefined ? c[chave] : base(chave);
}

// Movimentos de um cartão que contam sobre o saldo informado
export function movsDoCartao(state, cartao) {
  return (state.movs || []).filter((m) => m.cartao === cartao.id && m.ts > (cartao.saldoEm || 0));
}

export function saldoAtual(state, cartao) {
  const v = movsDoCartao(state, cartao).reduce((a, m) => a + (m.tipo === "compra" ? 1 : -1) * Number(m.valor || 0), 0);
  return Math.max(0, Math.round((cartao.saldo + v) * 100) / 100);
}

// Pagamentos que baixam as outras dívidas: cada conta/parcela/atrasado pode
// ter "divida" (id em outras). Pagar o item na lista baixa o saldo dela.
function mapaDividas(state) {
  const m = {};
  ["mensais", "parcelas", "pontuais"].forEach((k) => parte(state, k).forEach((it) => { if (it.divida) m[it.id] = it.divida; }));
  return m;
}
export function dividaDoItem(itemId, mapa) {
  const id = String(itemId).split("@")[0];
  return mapa[id] || null;
}

// Quanto já foi pago de uma dívida depois do saldo informado
export function pagoDaDivida(state, outra, mapa = mapaDividas(state)) {
  const desde = outra.saldoEm ? new Date(outra.saldoEm).toISOString().slice(0, 10) : "";
  let total = 0;
  Object.values(state.pagos || {}).forEach((semana) => {
    Object.entries(semana || {}).forEach(([id, p]) => {
      if (!p || typeof p !== "object" || p.valor == null) return;
      if (dividaDoItem(id, mapa) !== outra.id) return;
      if (desde && (p.data || "") < desde) return;
      total += Number(p.valor) || 0;
    });
  });
  return Math.round(total * 100) / 100;
}

// Seed efetivo usado por todo o app
// Mudanças de estrutura em dados já editados (para não duplicar contas)
function migrar(state) {
  const c = state.config || {};
  // A conta da mãe saiu de "Contas do mês" e virou conta com dia 11
  if (c.reservaItens && c.reservaItens.some((i) => /^m[ãa]e$/i.test(i.nome))) {
    const antiga = c.reservaItens.find((i) => /^m[ãa]e$/i.test(i.nome));
    c.reservaItens = c.reservaItens.filter((i) => i !== antiga);
    const mensais = parte(state, "mensais").map((m) => (m.id === "mae" ? { ...m, valor: antiga.valor } : m));
    c.mensais = mensais;
    state.config = c;
  }
}

// Une "contas do mês" e "contas com vencimento" numa lista só; seguros viram investimento
function migrarMensais(state) {
  const c = state.config || {};
  if (c.mensaisV2) return;
  if (c.mensais) {
    const ids = new Set(c.mensais.map((m) => m.id));
    const novos = SEED.mensais.filter((m) => !ids.has(m.id));
    c.mensais = [...c.mensais, ...novos].map((m) => (/^seguro/.test(m.id) ? { ...m, grupo: "investimento" } : m));
  }
  if (c.reservaItens) delete c.reservaItens;
  c.mensaisV2 = true;
  state.config = c;
}

// Custos semanais já editados: "Mercado, gasolina e pessoal" vira "Alimentação";
// passeador, comida dos cachorros e limpeza passam a ser divididos
function migrarSemanais(state) {
  const c = state.config || {};
  if (!c.semanais || c.semanaisV2) return;
  c.semanais = c.semanais.map((s) => {
    if (s.id === "vida") return { ...s, nome: "Alimentação" };
    if (["passeador", "racao", "limpeza"].includes(s.id) || s.cachorro) {
      const { cachorro, curto, ...resto } = s;
      return { ...resto, compartilhado: true };
    }
    return s;
  });
  c.semanaisV2 = true;
  state.config = c;
}

export function getSeed(state) {
  migrar(state);
  migrarMensais(state);
  migrarSemanais(state);
  const cartoesBase = parte(state, "cartoes");
  const mapa = mapaDividas(state);
  const cartoes = cartoesBase.map((c) => ({ ...c, saldoInformado: c.saldo, saldo: saldoAtual(state, c) }));
  // Ordem de ataque: a escolhida em Ajustes; cartões novos entram pelos juros mais altos
  const escolhidos = parte(state, "alvos").filter((id) => cartoes.some((c) => c.id === id));
  const resto = cartoes.filter((c) => !escolhidos.includes(c.id)).sort((a, b) => b.apr - a.apr).map((c) => c.id);
  return {
    ...SEED,
    // Contas em outra moeda já vêm convertidas para a moeda principal
    semanais: converterItens(state, parte(state, "semanais")),
    mensais: converterItens(state, parte(state, "mensais")),
    pontuais: converterItens(state, parte(state, "pontuais")),
    parcelas: converterItens(state, parte(state, "parcelas")),
    receber: parte(state, "receber"),
    compartilhadas: converterItens(state, parte(state, "compartilhadas")),
    fontes: parte(state, "fontes"),
    reservasMensais: { ...SEED.reservasMensais, itens: parte(state, "reservaItens") },
    outras: parte(state, "outras").map((o) => {
      const pago = pagoDaDivida(state, o, mapa);
      return { ...o, saldoInformado: o.saldo, pago, saldo: Math.max(0, Math.round((o.saldo - pago) * 100) / 100) };
    }),
    metas: parte(state, "metas"),
    ciclo: parte(state, "ciclo"),
    colchaoSemanal: parte(state, "colchaoSemanal"),
    pedidos: parte(state, "pedidos"),
    reservasPrazo: parte(state, "reservasPrazo"),
    categorias: parte(state, "categorias"),
    alvos: [...escolhidos, ...resto],
    // Primeiro pagamento do plano (até onde o "veio do pagamento anterior" volta)
    inicio: parte(state, "inicio") || toISO(nextPayday()),
    cartoesInicio: parte(state, "cartoesInicio") ?? cartoesBase.reduce((a, c) => a + Number(c.saldo || 0), 0),
    cartoesBase,
    cartoes,
  };
}

// Guarda uma parte editada
export function salvarParte(state, chave, valor) {
  const c = { ...(state.config || {}), [chave]: valor };
  // A carteira começa no primeiro ajuste salvo
  if (!c.inicio) c.inicio = toISO(nextPayday());
  // Ponto de partida das dívidas dos cartões (para medir o progresso)
  if (chave === "cartoes" && !c.cartoesInicio) {
    const total = valor.reduce((a, x) => a + Number(x.saldo || 0), 0);
    if (total > 0) c.cartoesInicio = total;
  }
  state.config = c;
}

export function restaurar(state) {
  state.config = {};
}

// Pagamento / compra no cartão
export function addMov(state, mov) {
  state.movs = [...(state.movs || []).filter((m) => m.id !== mov.id), { ts: Date.now(), ...mov }];
}
export function removeMov(state, id) {
  state.movs = (state.movs || []).filter((m) => m.id !== id);
}
