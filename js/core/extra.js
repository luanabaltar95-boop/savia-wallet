// =========================================================
// EXTRA MONEY — calculadoras para dinheiro extra, criadas a partir
// de modelos. "motorista": turnos, milhas, pedágio e gasolina.
// "simples": entradas com custo opcional.
// Todo o líquido entra sozinho na renda da semana (página Hoje).
// =========================================================
import { semanaDoTurno, turnosDaSemana, liquido, gasDaSemana, custoGas } from "./lyft.js";
import { fromISO } from "./calendar.js";

export const MODELOS = [
  { id: "motorista", label: "Motorista de aplicativo", desc: "Turnos, horas, milhas, pedágio e gasolina" },
  { id: "simples", label: "Simples", desc: "Entradas e custos (vendas, freelas, bicos)" },
];

const n = (v) => Number(v) || 0;
const da = (origem) => (x) => !origem || x.origem === origem;

// Modelo simples
export const simplesLiquido = (e) => n(e.valor) - n(e.custo);
export const simplesDaSemana = (state, iso, origem) =>
  (state.entradasExtra || []).filter(da(origem)).filter((e) => semanaDoTurno(e.data) === iso).sort((a, b) => b.data.localeCompare(a.data));
export const simplesDoMes = (state, ano, mes, origem) =>
  (state.entradasExtra || []).filter(da(origem)).filter((e) => { const d = fromISO(e.data); return d.getFullYear() === ano && d.getMonth() === mes; });

// Líquido de uma calculadora na semana do pagamento
export function liquidoFonte(state, fonte, iso) {
  if (fonte.modelo === "simples") return simplesDaSemana(state, iso, fonte.id).reduce((a, e) => a + simplesLiquido(e), 0);
  const ts = turnosDaSemana(state, iso, fonte.id);
  return ts.reduce((a, t) => a + liquido(t), 0) - custoGas(gasDaSemana(state, iso, fonte.id));
}

// Total de todas as calculadoras (entra na Hoje)
export function extraDa(seed, state, iso) {
  const fontes = seed.fontes || [];
  const registros = (state.lyft || []).length + (state.gasolina || []).length + (state.entradasExtra || []).length;
  const valor = fontes.reduce((a, f) => a + liquidoFonte(state, f, iso), 0);
  const tem = fontes.some((f) => (f.modelo === "simples" ? simplesDaSemana(state, iso, f.id).length : turnosDaSemana(state, iso, f.id).length + gasDaSemana(state, iso, f.id).length));
  return { valor, tem, registros };
}
