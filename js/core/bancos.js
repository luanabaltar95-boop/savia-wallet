// =========================================================
// CONTAS BANCÁRIAS — dados de acesso rápido e saldos.
// state.bancos: [{ id, banco, tipo, conta, routing, taxa, saldo, saldoEm }]
// O saldo da conta principal (id "citibank", nome histórico) vem de state.saldoConta.
// Os números ficam só nos seus dados (privados), nunca no código.
// =========================================================
import { saldoAtual, conferir } from "./saldo.js";

export const TIPOS = [{ id: "checking", label: "Checking" }, { id: "savings", label: "Savings" }];
export const final4 = (n) => String(n || "").slice(-4);
export const mascara = (n) => (n ? `•••• ${final4(n)}` : "—");

// Saldo calculado sozinho (último conferido + o que entrou e saiu depois)
export const saldoBanco = (state, b) => saldoAtual(state, b);
// Atualizar saldo = conferir com o banco (a diferença vira taxas e câmbio)
export const salvarSaldo = (state, b, valor) => conferir(state, b, valor);
