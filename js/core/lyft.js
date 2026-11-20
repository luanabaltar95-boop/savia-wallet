// =========================================================
// LYFT — turnos, valor líquido e resumo.
// Turno conta na PRÓXIMA sexta: o dinheiro de sex→qui ajuda a lista de pagamento seguinte.
// =========================================================
import { toISO, fromISO, addDays, pagamentoDe } from "./calendar.js";

// De onde saiu o dinheiro da gasolina
export const FONTES = [
  { id: "lyft", label: "Cashout do Lyft" },
  { id: "empresa", label: "Cartão da empresa" },
];
export const QUEM = FONTES; // compatibilidade
const custa = (fonte) => fonte === "lyft" || fonte === "eu"; // empresa/outros = presente, sem custo

const n = (v) => Number(v) || 0;

// Sobra real do turno: ganho + pedágio devolvido − pedágio pago − gasolina (se foi você) − outros
export function liquido(t) {
  return n(t.ganho) + n(t.pedagioReemb) - n(t.pedagioPago) - (custa(t.gasQuem) ? n(t.gasolina) : 0) - n(t.outros);
}

// Abastecimentos (separados dos turnos): só o pago com cashout do Lyft é custo
// origem: id da calculadora do Extra Money (registros antigos = "lyft"). Sem origem = todas.
const da = (origem) => (x) => !origem || (x.origem || "lyft") === origem;

export function gasDaSemana(state, iso, origem) {
  return (state.gasolina || []).filter(da(origem)).filter((g) => semanaDoTurno(g.data) === iso);
}
export const custoGas = (lista) => lista.filter((g) => custa(g.fonte)).reduce((a, g) => a + n(g.valor), 0);
export const totalGas = (lista) => lista.reduce((a, g) => a + n(g.valor), 0);
export function gasDoMes(state, ano, mes, origem) {
  return (state.gasolina || []).filter(da(origem)).filter((g) => { const d = fromISO(g.data); return d.getFullYear() === ano && d.getMonth() === mes; });
}

export function porHora(total, horas) {
  return horas > 0 ? total / horas : 0;
}

// Sexta do pagamento a que o turno pertence (a próxima sexta depois do turno)
export function semanaDoTurno(dataISO) {
  return pagamentoDe(dataISO);
}

export function turnosDaSemana(state, iso, origem) {
  return (state.lyft || []).filter(da(origem)).filter((t) => semanaDoTurno(t.data) === iso).sort((a, b) => b.data.localeCompare(a.data));
}

export function turnosDoMes(state, ano, mes, origem) {
  return (state.lyft || []).filter(da(origem)).filter((t) => {
    const d = fromISO(t.data);
    return d.getFullYear() === ano && d.getMonth() === mes;
  });
}

export function resumo(turnos) {
  const liq = turnos.reduce((a, t) => a + liquido(t), 0);
  const horas = turnos.reduce((a, t) => a + n(t.horas), 0);
  return {
    turnos: turnos.length,
    liquido: liq,
    horas,
    porHora: porHora(liq, horas),
    ganho: turnos.reduce((a, t) => a + n(t.ganho), 0),
    milhas: turnos.reduce((a, t) => a + n(t.milhas), 0),
  };
}
