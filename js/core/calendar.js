// =========================================================
// CALENDÁRIO E CICLO DE PAGAMENTO
// O app se organiza pelos dias em que você recebe:
//   semanal (ex.: toda sexta) · quinzenal (a cada 2 semanas)
//   mensal (um dia do mês) · manual (datas que você escolhe)
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
  { id: "mensal", label: "Mensal" },
  { id: "manual", label: "Manual" },
];
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

let ciclo = { tipo: "semanal", diaSemana: 5 };
export function setCiclo(c) { ciclo = { tipo: "semanal", diaSemana: 5, ...(c || {}) }; }
export const getCiclo = () => ciclo;

const dia0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diaNoMes = (ano, mes, dia) => new Date(ano, mes, Math.min(dia, new Date(ano, mes + 1, 0).getDate()));

// Primeiro dia de pagamento em `d` ou depois
export function proximoPagamento(d) {
  d = dia0(d);
  const c = ciclo;
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
