// =========================================================
// CALENDÁRIO E CICLO DE PAGAMENTO
// O app se organiza pelos dias em que você recebe:
//   semanal (ex.: toda sexta) · quinzenal (a cada 2 semanas)
//   duasVezes (2 dias do mês, ex.: 15 e último) · mensal · manual
//   Mensal/duas vezes: dia fixo, Nº dia útil ou último dia útil;
//   dia fixo no fim de semana pode adiantar para a sexta antes.
// Cada pagamento cobre o período do dia seguinte até o próximo pagamento.
// =========================================================
export function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ---------- Ciclo (definido em Ajustes; app.js chama setCiclo a cada render) ----------
export const TIPOS_CICLO = [
  { id: "semanal", label: "Semanal" },
  { id: "quinzenal", label: "Quinzenal" },
  { id: "duasVezes", label: "Duas vezes por mês" },
  { id: "mensal", label: "Mensal" },
  { id: "manual", label: "Manual" },
];
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

let ciclo = { tipo: "semanal", diaSemana: 5 };
export function setCiclo(c) { ciclo = { tipo: "semanal", diaSemana: 5, ...(c || {}) }; }
export const getCiclo = () => ciclo;

const dia0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diaNoMes = (ano, mes, dia) => new Date(ano, mes, Math.min(dia, new Date(ano, mes + 1, 0).getDate()));

// ---------- Dias úteis (segunda a sexta) ----------
const util = (d) => d.getDay() !== 0 && d.getDay() !== 6;
const antesDoFds = (d) => { let x = new Date(d); while (!util(x)) x = addDays(x, -1); return x; };
function nUtil(ano, mes, n) {
  let k = 0;
  for (let dia = 1; dia <= 31; dia++) {
    const d = new Date(ano, mes, dia);
    if (d.getMonth() !== mes) break;
    if (util(d) && ++k === n) return d;
  }
  return ultimoUtil(ano, mes);
}
const ultimoUtil = (ano, mes) => antesDoFds(new Date(ano, mes + 1, 0));

// Um pagamento do mês pela regra: { regra: "dia" | "util" | "ultimoUtil", dia, n, antes }
//   dia 0 = último dia do mês
export function diaPelaRegra(ano, mes, r) {
  const b = new Date(ano, mes, 1); ano = b.getFullYear(); mes = b.getMonth(); // mês 12 → janeiro do ano seguinte
  if (r.regra === "util") return nUtil(ano, mes, Number(r.n) || 1);
  if (r.regra === "ultimoUtil") return ultimoUtil(ano, mes);
  const dia = Number(r.dia) || 0;
  const d = dia === 0 ? new Date(ano, mes + 1, 0) : diaNoMes(ano, mes, dia);
  return r.antes ? antesDoFds(d) : d;
}
// Regras do ciclo mensal ou de duas vezes por mês
function regrasDoMes(c) {
  if (c.tipo === "duasVezes") return (c.pagamentos && c.pagamentos.length ? c.pagamentos : [{ regra: "dia", dia: 15 }, { regra: "dia", dia: 0 }]);
  return [{ regra: c.regra || "dia", dia: c.diaMes || 1, n: c.nUtil || 5, antes: c.antes }];
}

// Primeiro dia de pagamento em `d` ou depois
export function proximoPagamento(d) {
  d = dia0(d);
  const c = ciclo;
  if (c.tipo === "mensal" || c.tipo === "duasVezes") {
    const regras = regrasDoMes(c);
    for (let k = 0; k < 3; k++) {
      const ano = d.getFullYear(), mes = d.getMonth() + k;
      const datas = regras.map((r) => diaPelaRegra(ano, mes, r)).sort((a, b) => a - b);
      const achou = datas.find((x) => x >= d);
      if (achou) return achou;
    }
  }
  if (c.tipo === "quinzenal") {
    const ancora = c.ancora ? fromISO(c.ancora) : addDays(d, (Number(c.diaSemana) - d.getDay() + 7) % 7);
    const dif = Math.round((d - ancora) / 86400000);
    return addDays(ancora, Math.ceil(dif / 14) * 14);
  }
  if (c.tipo === "mensal") {
    const dia = Number(c.diaMes) || 1;
    const neste = diaNoMes(d.getFullYear(), d.getMonth(), dia);
    return neste >= d ? neste : diaNoMes(d.getFullYear(), d.getMonth() + 1, dia);
  }
  if (c.tipo === "manual") {
    const datas = [...(c.datas || [])].sort();
    const iso = toISO(d);
    const achou = datas.find((x) => x >= iso);
    if (achou) return fromISO(achou);
    // depois da última data: repete o último intervalo (ou mensal)
    if (datas.length) {
      const ult = fromISO(datas[datas.length - 1]);
      const passo = datas.length > 1 ? Math.max(1, Math.round((ult - fromISO(datas[datas.length - 2])) / 86400000)) : 30;
      const n = Math.ceil((d - ult) / 86400000 / passo);
      return addDays(ult, n * passo);
    }
  }
  // semanal
  return addDays(d, (Number(c.diaSemana ?? 5) - d.getDay() + 7) % 7);
}
export const pagamentoSeguinte = (p) => proximoPagamento(addDays(p, 1));
export function pagamentoAnterior(p) {
  for (let k = 1; k <= 62; k++) {
    const d = addDays(p, -k);
    if (toISO(proximoPagamento(d)) === toISO(d)) return d;
  }
  return addDays(p, -7);
}
// Pagamento em que um registro (turno, gasto, recebimento) entra: o primeiro DEPOIS da data
export const pagamentoDe = (dataISO) => toISO(pagamentoSeguinte(fromISO(dataISO)));
// Pagamento cuja lista inclui a data (o último no dia ou antes)
export function pagamentoAte(d) {
  const p = proximoPagamento(d);
  return toISO(p) === toISO(dia0(d)) ? p : pagamentoAnterior(p);
}
// Período coberto pelo pagamento: do dia seguinte até o próximo pagamento
export function periodo(payday) {
  const ini = addDays(payday, 1), fim = pagamentoSeguinte(payday);
  return { ini, fim, dias: Math.round((fim - payday) / 86400000) };
}
// Quantas semanas o período tem (custos semanais × isso)
export const fator = (payday) => periodo(payday).dias / 7;

// Semana em aberto: o próximo pagamento, pulando as semanas que já fechei
export function semanaAberta(state, today = new Date()) {
  let p = proximoPagamento(today);
  const fechadas = (state && state.fechadas) || {};
  for (let i = 0; fechadas[toISO(p)] && i < 52; i++) p = pagamentoSeguinte(p);
  return p;
}

// Próximo pagamento (hoje, se hoje for dia de pagamento)
export function nextPayday(today = new Date()) {
  return proximoPagamento(today);
}

// Dias cobertos pelo pagamento: do dia seguinte até o próximo pagamento
export function weekDays(payday) {
  return Array.from({ length: periodo(payday).dias }, (_, i) => addDays(payday, i + 1));
}

// Data em que uma conta mensal de "dia" cai dentro da semana (ou null)
export function dueInWeek(dia, payday) {
  return weekDays(payday).find((d) => {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(dia, last);
  }) || null;
}
