// =========================================================
// CONTAS BANCÁRIAS — dados de acesso rápido e saldos.
// state.bancos: [{ id, banco, tipo, conta, routing, taxa, saldo, saldoEm }]
// O saldo da conta principal (id "citibank", nome histórico) vem de state.saldoConta.
// Os números ficam só nos seus dados (privados), nunca no código.
// =========================================================
import { saldoContaAtual, saldoDoBanco, CONTA } from "./gastos.js";

export const TIPOS = [{ id: "checking", label: "Checking" }, { id: "savings", label: "Savings" }];
export const final4 = (n) => String(n || "").slice(-4);
export const mascara = (n) => (n ? `•••• ${final4(n)}` : "—");

export function saldoBanco(state, b) {
  if (b.id === CONTA) return saldoContaAtual(state);
  return saldoDoBanco(state, b.id, b.saldo, b.saldoEm);
}

export function salvarSaldo(state, b, valor) {
  if (b.id === CONTA) state.saldoConta = { banco: b.banco, valor, em: Date.now() };
  else state.bancos = state.bancos.map((x) => (x.id === b.id ? { ...x, saldo: valor, saldoEm: Date.now() } : x));
}
