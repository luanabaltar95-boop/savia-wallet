// =========================================================
// DESTINO DO DINHEIRO — onde cada valor da sexta fica.
// Reserva de longo prazo (guardar para daqui a mais de 2 semanas,
// ou sem data, como o colchão) → a conta poupança (savings) cadastrada.
// O resto (contas, mínimos, vida, o que vence logo) → conta corrente.
// =========================================================
import { addDays } from "./calendar.js";

export const LONGO_PRAZO_DIAS = 14;

export function poupanca(state) {
  return (state.bancos || []).find((b) => b.tipo === "savings") || { id: "poupanca", banco: "Poupança" };
}

export function vaiParaPoupanca(item, payday) {
  if (item.acao !== "guardar" || item.grupo === "vida") return false;
  if (!item.vence) return true;
  return item.vence > addDays(payday, LONGO_PRAZO_DIAS);
}
