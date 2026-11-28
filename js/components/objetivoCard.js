// =========================================================
// CARTÃO DO OBJETIVO (Home) — quanto falta, ritmo atual e o que
// fazer para chegar na data. Sem objetivo: convida a definir um.
// =========================================================
import { progresso } from "../core/objetivo.js";
import { fromISO } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
// Data com o ano quando não é este ano (ex.: 14/01/28)
const dataAno = (iso) => { const d = fromISO(iso); return d.getFullYear() === new Date().getFullYear() ? shortDate(d) : `${shortDate(d)}/${String(d.getFullYear()).slice(2)}`; };
import { card, esc } from "./ui.js";

export function objetivoCard(ctx) {
  const p = progresso(ctx.seed, ctx.state);
  if (!p.alvo && !p.semanal) {
    return card({ title: "Meu objetivo", body: `<p class="hint">Para onde eu quero levar meu dinheiro? Uma reserva, uma viagem, sair das dívidas…</p><a class="btn primary" href="#ajustes" data-obj-abrir>Definir meu objetivo</a>` });
  }
  const div = p.tipo === "dividas";
  const linhas = [];
  if (p.falta <= 0 && p.alvo) linhas.push(`<span class="status ok">Objetivo alcançado! 🎉</span>`);
  else {
    if (p.chegaEm) linhas.push(`No ritmo de ${money(p.semanal)}/semana, ${div ? "quito" : "chego"} em <b>${dataAno(p.chegaEm)}</b>.`);
    if (p.precisaSemana && !p.noPrazo) linhas.push(`<span class="status warn">Para chegar até ${dataAno(p.ate)}, preciso de ${money(p.precisaSemana)} por semana.</span>`);
    else if (p.precisaSemana) linhas.push(`<span class="status ok">No prazo para ${dataAno(p.ate)}.</span>`);
    if (!p.semanal) linhas.push(`Defina quanto guardar por semana para ver quando chego.`);
  }
  return card({
    title: p.nome ? esc(p.nome) : div ? "Sair das dívidas" : "Meu objetivo",
    total: p.alvo ? `${Math.round(p.pct)}%` : "",
    body: `${p.alvo ? `<div class="track"><div class="fill" style="width:${p.pct}%"></div></div>
      <p class="hint">${div ? `Quitei ${money(p.atual)} de ${money(p.alvo)}` : `Tenho ${money(p.atual)} de ${money(p.alvo)}`} · faltam ${money(p.falta)}</p>` : ""}
      ${linhas.map((l) => `<p class="obj-l">${l}</p>`).join("")}`,
  });
}
export const bindObjetivoCard = (root, ctx) => root.querySelectorAll("[data-obj-abrir]").forEach((a) => (a.onclick = () => { ctx.openSec = "objetivo"; }));
