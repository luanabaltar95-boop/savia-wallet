// =========================================================
// NAVEGADOR DO PERÍODO — usado por Hoje, Gastos, Extra e Dividir.
// A semana fecha no dia do pagamento: pagamento 20/11 → semana 14 – 20.
// Nesse dia eu pago tudo e fecho a semana; o que faltar vai para a próxima.
// =========================================================
import { periodo, pagamentoAnterior, pagamentoSeguinte, getCiclo } from "../core/calendar.js";

const PREV = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>`;
const NEXT = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>`;
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Sábado e sexta da semana coberta pelo pagamento
export const inicioSemana = (payday) => periodo(pagamentoAnterior(payday)).ini;
export const fimSemana = (payday) => payday;
const dm = (d) => `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function weekNav(payday, titulo = "Pagamentos", sub, extra = "") {
  const ini = inicioSemana(payday), fim = fimSemana(payday);
  const mes = ini.getMonth() === fim.getMonth() ? MESES[ini.getMonth()] : `${MESES[ini.getMonth()]} – ${MESES[fim.getMonth()]}`;
  return `<header class="page-head">
    <div class="eyebrow-row"><p class="eyebrow">${titulo}</p>${extra}</div>
    <h1 class="mes">${mes}</h1>
    <div class="week-nav">
      <button class="btn icon" data-week="-1" aria-label="Período anterior">${PREV}</button>
      <div class="label">
        <p class="semana">${getCiclo().tipo === "semanal" ? `semana ${ini.getDate()} – ${fim.getDate()}` : `${dm(ini)} – ${dm(fim)}`}</p>
        ${sub ? `<p class="hint">${sub}</p>` : ""}
      </div>
      <button class="btn icon" data-week="1" aria-label="Próximo período">${NEXT}</button>
    </div>
  </header>`;
}

export function bindWeekNav(root, ctx) {
  root.querySelectorAll("[data-week]").forEach((b) => {
    b.onclick = () => { ctx.payday = Number(b.dataset.week) < 0 ? pagamentoAnterior(ctx.payday) : pagamentoSeguinte(ctx.payday); ctx.rerender(); };
  });
}
