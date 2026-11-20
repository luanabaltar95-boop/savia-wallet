// =========================================================
// JUNTAS — custos dos cachorros e quanto cada uma pagou.
// "ajuda": ela passou dinheiro / pagou parte do semanal → entra na
//          renda da próxima sexta (como o Lyft).
// "extra": gasto fora do semanal (veterinário, ração…) com quem pagou.
// =========================================================
import { fromISO, addDays, nextPayday, toISO, getCiclo } from "./calendar.js";
import { semanaDoTurno } from "./lyft.js";

const n = (v) => Number(v) || 0;

// Custos semanais marcados como dos cachorros (passeador, comida…)
export const semanalCachorros = (seed) => seed.semanais.filter((s) => s.cachorro).reduce((a, s) => a + s.valor, 0);

export function ajudaDa(state, iso) {
  return (state.juntas || []).filter((j) => j.tipo === "ajuda" && semanaDoTurno(j.data) === iso).reduce((a, j) => a + n(j.valor), 0);
}

// Quantas "semanas" de custo o mês tem
function sextasNoMes(ano, mes) {
  const c0 = getCiclo();
  if (c0.tipo !== "semanal") return new Date(ano, mes + 1, 0).getDate() / 7;
  let c = 0;
  for (let d = new Date(ano, mes, 1); d.getMonth() === mes; d = addDays(d, 1)) if (d.getDay() === Number(c0.diaSemana ?? 5)) c++;
  return c;
}

export function resumoMes(seed, state, ano, mes) {
  const doMes = (state.juntas || []).filter((j) => {
    const d = fromISO(j.data);
    return d.getFullYear() === ano && d.getMonth() === mes;
  });
  const semanal = semanalCachorros(seed) * sextasNoMes(ano, mes);
  const extrasEu = doMes.filter((j) => j.tipo === "extra" && j.quem === "eu").reduce((a, j) => a + n(j.valor), 0);
  const extrasEla = doMes.filter((j) => j.tipo === "extra" && j.quem === "ela").reduce((a, j) => a + n(j.valor), 0);
  const ajudas = doMes.filter((j) => j.tipo === "ajuda").reduce((a, j) => a + n(j.valor), 0);
  const total = semanal + extrasEu + extrasEla;
  const ela = ajudas + extrasEla;
  const eu = total - ela;
  return { total, semanal, eu, ela, pctEla: total ? ela / total : 0, itens: doMes.sort((a, b) => b.data.localeCompare(a.data)) };
}

export const hojeISO = () => toISO(new Date());
export { nextPayday };
