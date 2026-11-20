// =========================================================
// A RECEBER — dinheiro que te devem (empréstimos, depósito…).
// Só entra no plano quando você registra que recebeu: o valor
// recebido soma na renda da próxima sexta (como o Lyft).
// =========================================================
import { semanaDoTurno } from "./lyft.js";

const n = (v) => Number(v) || 0;

export function recebidoDe(state, id) {
  return (state.recebimentos || []).filter((r) => r.receberId === id).reduce((a, r) => a + n(r.valor), 0);
}

export function lista(seed, state) {
  return seed.receber.map((r) => {
    const recebido = recebidoDe(state, r.id);
    return { ...r, recebido, falta: Math.max(0, n(r.valor) - recebido) };
  });
}

// Recebimentos que entram na semana deste pagamento
export function recebidoDa(seed, state, iso) {
  const nomes = Object.fromEntries((seed.receber || []).map((r) => [r.id, r.nome]));
  const its = (state.recebimentos || []).filter((r) => semanaDoTurno(r.data) === iso);
  return { valor: its.reduce((a, r) => a + n(r.valor), 0), de: [...new Set(its.map((r) => nomes[r.receberId] || "alguém"))] };
}

export function recebidoValor(state, iso) {
  return (state.recebimentos || []).filter((r) => semanaDoTurno(r.data) === iso).reduce((a, r) => a + n(r.valor), 0);
}
