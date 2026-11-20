// =========================================================
// GASTOS — o que saiu da conta no dia a dia + saldo do banco.
// state.gastos: [{ id, data, valor, desc, cat, conta, ts }]
//   conta: "citibank" (débito na conta) ou o id de um cartão.
//   No cartão, o gasto vira uma compra (state.movs) e o saldo/limite usado sobe.
// state.saldoConta: { banco, valor, em (timestamp) }
// =========================================================
import { semanaDoTurno } from "./lyft.js";

export const CATEGORIAS = [
  { id: "alimentacao", label: "Alimentação" },
  { id: "casa", label: "Casa" },
  { id: "cachorros", label: "Cachorros" },
  { id: "transporte", label: "Transporte" },
  { id: "pessoal", label: "Pessoal" },
  { id: "pessoas", label: "Paguei alguém" },
  { id: "outros", label: "Outros" },
];
export const nomeCat = (id) => CATEGORIAS.find((c) => c.id === id)?.label || "Outros";

const n = (v) => Number(v) || 0;
export const somaGastos = (l) => l.reduce((a, g) => a + n(g.valor), 0);

// Semana do pagamento a que o gasto pertence (mesma regra dos turnos)
export function gastosDaSemana(state, iso) {
  return (state.gastos || []).filter((g) => semanaDoTurno(g.data) === iso).sort((a, b) => b.data.localeCompare(a.data));
}
export function gastosDoMes(state, ano, mes) {
  const p = `${ano}-${String(mes + 1).padStart(2, "0")}`;
  return (state.gastos || []).filter((g) => g.data.startsWith(p));
}
export function porCategoria(lista) {
  const m = {};
  lista.forEach((g) => { m[g.cat] = (m[g.cat] || 0) + n(g.valor); });
  return CATEGORIAS.filter((c) => m[c.id]).map((c) => ({ ...c, valor: m[c.id] }));
}

export const CONTA = "citibank";

// Bancos cadastrados (Minhas contas). Sem nenhum ainda, uma conta padrão.
export function bancosDe(state) {
  const l = state.bancos || [];
  return l.length ? l : [{ id: CONTA, banco: (state.saldoConta || {}).banco || "Minha conta", tipo: "checking" }];
}

// Onde o dinheiro saiu: os bancos (débito) + os cartões
export function meiosDePagamento(seed, state) {
  return [
    ...bancosDe(state).map((b) => ({ id: b.id, label: `${b.banco} (débito)` })),
    ...seed.cartoes.map((c) => ({ id: c.id, label: c.nome })),
  ];
}
export const ehCartao = (seed, id) => seed.cartoes.some((c) => c.id === id);

// Saldo de um banco = último saldo informado − gastos no débito registrados depois dele
export function saldoDoBanco(state, id, valor, em) {
  if (valor == null || valor === "") return null;
  const saiu = (state.gastos || []).filter((g) => (g.conta || CONTA) === id && (g.ts || 0) > (em || 0));
  return Math.round((Number(valor) - somaGastos(saiu)) * 100) / 100;
}
export function saldoContaAtual(state) {
  const c = state.saldoConta;
  return c ? saldoDoBanco(state, CONTA, c.valor, c.em) : null;
}

// Quanto ainda dá para usar no cartão
export const disponivel = (c) => Math.max(0, Math.round((c.limite - c.saldo) * 100) / 100);
