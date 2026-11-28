// =========================================================
// NAVEGADOR DO PERÍODO — usado por Hoje, Gastos, Extra e Dividir.
// A semana fecha no dia do pagamento: pagamento 20/11 → semana 14 – 20.
// Nesse dia eu pago tudo e fecho a semana; o que faltar vai para a próxima.
// =========================================================
import { periodo, pagamentoAnterior, pagamentoSeguinte } from "../core/calendar.js";

const PREV = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>`;
const NEXT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>`;
const MES3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Sábado e sexta da semana coberta pelo pagamento
export const inicioSemana = (payday) => periodo(pagamentoAnterior(payday)).ini;
export const fimSemana = (payday) => payday;
// "21 – 27 nov" ou "28 nov – 4 dez"
export function rotuloPeriodo(payday) {
  const ini = inicioSemana(payday), fim = fimSemana(payday);
  return ini.getMonth() === fim.getMonth()
    ? `${ini.getDate()} – ${fim.getDate()} ${MES3[fim.getMonth()]}`
    : `${ini.getDate()} ${MES3[ini.getMonth()]} – ${fim.getDate()} ${MES3[fim.getMonth()]}`;
}

// Cabeçalho compacto: título + seletor de período com as setas nas pontas
export function weekNav(payday, titulo = "Pagamentos", sub, extra = "") {
  return `<header class="page-head ph-compact">
    <div class="ph-top"><h1>${titulo}</h1>${extra}</div>
    <div class="periodo">
      <button class="periodo-btn" type="button" data-week="-1" aria-label="Período anterior">${PREV}</button>
      <div class="periodo-txt"><b class="num">${rotuloPeriodo(payday)}</b>${sub ? `<small>${sub}</small>` : ""}</div>
      <button class="periodo-btn" type="button" data-week="1" aria-label="Próximo período">${NEXT}</button>
    </div>
  </header>`;
}

export function bindWeekNav(root, ctx) {
  root.querySelectorAll("[data-week]").forEach((b) => {
    b.onclick = () => { ctx.payday = Number(b.dataset.week) < 0 ? pagamentoAnterior(ctx.payday) : pagamentoSeguinte(ctx.payday); ctx.rerender(); };
  });
}
