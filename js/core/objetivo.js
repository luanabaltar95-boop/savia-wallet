// =========================================================
// MEU OBJETIVO — para onde a carteira está me levando.
//   config.objetivo: { tipo: "reserva" | "compra" | "dividas", nome, alvo, ate, conta }
//   config.colchaoSemanal: quanto guardo por semana (entra no plano da Hoje)
// O app mostra quanto falta, o ritmo atual e quanto preciso guardar
// por semana para chegar na data.
// =========================================================
import { parte } from "./config.js";
import { poupanca } from "./destino.js";
import { saldoAtual } from "./saldo.js";
import { toISO, fromISO, addDays } from "./calendar.js";

export const TIPOS_OBJETIVO = [
  { id: "reserva", label: "Montar uma reserva" },
  { id: "compra", label: "Juntar para algo" },
  { id: "dividas", label: "Sair das dívidas" },
];
const r2 = (v) => Math.round(v * 100) / 100;

export function objetivo(state) {
  const o = (state.config || {}).objetivo || {};
  return { tipo: "reserva", nome: "", alvo: 0, ate: "", conta: "", ...(typeof o === "object" ? o : {}), semanal: Number(parte(state, "colchaoSemanal")) || 0 };
}
// Conta onde guardo (a do objetivo, ou a poupança cadastrada)
export function contaDestino(state) {
  const o = objetivo(state);
  const b = (state.bancos || []).find((x) => x.id === o.conta);
  return b || poupanca(state);
}
export const nomeGuardar = (state) => { const o = objetivo(state); return o.nome ? `Guardar · ${o.nome}` : "Guardar (poupança)"; };

// Quanto já tenho, quanto falta, e o ritmo
export function progresso(seed, state, hoje = new Date()) {
  const o = objetivo(state);
  let atual, alvo;
  if (o.tipo === "dividas") {
    const total = seed.cartoes.reduce((a, c) => a + (Number(c.saldo) || 0), 0) + seed.outras.reduce((a, x) => a + (Number(x.saldo) || 0), 0);
    alvo = Number(o.alvo) || total; // quanto devia quando comecei
    atual = Math.max(0, alvo - total); // já quitei
  } else {
    alvo = Number(o.alvo) || 0;
    const s = saldoAtual(state, contaDestino(state));
    atual = Math.max(0, s || 0);
  }
  const falta = r2(Math.max(0, alvo - atual));
  const semanasAte = o.ate ? Math.max(1, Math.ceil((fromISO(o.ate) - hoje) / (7 * 86400000))) : null;
  const precisaSemana = semanasAte ? r2(falta / semanasAte) : null;
  const semanasNoRitmo = o.semanal > 0 ? Math.ceil(falta / o.semanal) : null;
  const chegaEm = semanasNoRitmo != null ? toISO(addDays(hoje, semanasNoRitmo * 7)) : null;
  return { ...o, atual: r2(atual), alvo: r2(alvo), falta, pct: alvo ? Math.min(100, (atual / alvo) * 100) : 0, semanasAte, precisaSemana, chegaEm, noPrazo: !o.ate || !chegaEm || chegaEm <= o.ate };
}
