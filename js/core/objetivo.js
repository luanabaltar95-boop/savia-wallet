// =========================================================
// OBJETIVO (compatibilidade) — telas antigas pediam "o objetivo".
// Agora são vários (js/goals/). Aqui fica só o atalho para o
// primeiro objetivo em dinheiro e a conta onde ele guarda.
// =========================================================
import { objetivos } from "../goals/modelo.js";
import { ehDinheiro } from "../goals/tipos.js";
import { poupanca } from "./destino.js";

export function objetivo(state) {
  return objetivos(state).find(ehDinheiro) || { tipo: "reserva", nome: "", alvo: 0, ate: "", conta: "", semanal: 0 };
}
// Conta onde guardo (a do objetivo, ou a poupança cadastrada)
export function contaDestino(state) {
  const o = objetivo(state);
  return (state.bancos || []).find((x) => x.id === o.conta) || poupanca(state);
}
export const nomeGuardar = (state) => { const o = objetivo(state); return o.nome ? `Guardar · ${o.nome}` : "Guardar (poupança)"; };
