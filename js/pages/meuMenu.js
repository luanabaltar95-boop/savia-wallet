// =========================================================
// MEU MENU (Ajustes) — ligar e desligar módulos, escolher até
// 2 atalhos na barra de baixo, ordem do menu e nomes das metas.
// =========================================================
import { MODULOS, ativo, ligar, atalhosDe, alternarAtalho, ordemMenu, moverMenu, nomesMetas } from "../core/modulos.js";
import { field, esc, toast } from "../components/ui.js";

const CIMA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>`;
const BAIXO = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`;

export function meuMenuHtml(ctx) {
  const { state } = ctx;
  const atalhos = atalhosDe(state);
  const ordem = ordemMenu(state).filter((m) => ativo(state, m.id));
  const nomes = nomesMetas(state);
  const linha = (m) => `<li class="mod ${m.emBreve ? "off" : ""}">
      <label class="mod-sw">
        <input type="checkbox" data-mod="${m.id}" ${ativo(state, m.id) ? "checked" : ""} ${m.emBreve ? "disabled" : ""}>
        <span class="sw" aria-hidden="true"></span>
        <span class="mod-txt"><b>${esc(m.label)}</b><small>${m.emBreve ? "em breve" : esc(m.desc)}</small></span>
      </label>
      ${m.pagina && ativo(state, m.id) ? `<button class="link ${atalhos.includes(m.id) ? "on" : ""}" data-atalho="${m.id}">${atalhos.includes(m.id) ? "na barra ✓" : "pôr na barra"}</button>` : ""}
    </li>`;
  return `<details class="card sec" data-sec="menu" ${ctx.openSec === "menu" ? "open" : ""}>
    <summary class="sec-head"><h2>Meu menu</h2><span class="total">${MODULOS.filter((m) => ativo(state, m.id)).length}</span></summary>
    <div class="sec-body">
      <p class="hint">Ligo só o que eu uso. Desligar esconde, não apaga.</p>
      <ul class="mods">${MODULOS.map(linha).join("")}</ul>
      ${ordem.length > 1 ? `<h4 class="sub-h">Ordem no menu +</h4>
        <div class="rows">${ordem.map((m, i) => `<div class="ordem-row"><div class="ordem-info"><span class="name">${esc(m.label)}</span></div>
          <button class="btn icon" data-ordem="${m.id}|-1" aria-label="Subir" ${i === 0 ? "disabled" : ""}>${CIMA}</button>
          <button class="btn icon" data-ordem="${m.id}|1" aria-label="Descer" ${i === ordem.length - 1 ? "disabled" : ""}>${BAIXO}</button></div>`).join("")}</div>` : ""}
      ${ativo(state, "metas") ? `<h4 class="sub-h">Nomes das metas</h4>
        <form id="nomes-metas" class="fields" novalidate>
          ${field({ id: "nm-piso", label: "1º nível", type: "text", value: nomes.piso })}
          ${field({ id: "nm-meta", label: "2º nível", type: "text", value: nomes.meta })}
          ${field({ id: "nm-turbo", label: "3º nível", type: "text", value: nomes.turbo })}
          <button class="btn primary" type="submit">Salvar</button>
        </form>` : ""}
    </div>
  </details>`;
}

export function bindMeuMenu(root, ctx) {
  const { state, persist } = ctx;
  const salvar = (t) => { ctx.openSec = "menu"; persist(); ctx.rerender(); if (t) toast(t); };
  root.querySelectorAll("[data-mod]").forEach((c) => c.addEventListener("change", () => { ligar(state, c.dataset.mod, c.checked); salvar(); }));
  root.querySelectorAll("[data-atalho]").forEach((b) => (b.onclick = () => { alternarAtalho(state, b.dataset.atalho); salvar(); }));
  root.querySelectorAll("[data-ordem]").forEach((b) => (b.onclick = () => { const [id, d] = b.dataset.ordem.split("|"); moverMenu(state, id, Number(d)); salvar(); }));
  const f = root.querySelector("#nomes-metas");
  if (f) f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (id) => f.querySelector(id).value.trim();
    state.config = { ...state.config, nomesMetas: { piso: v("#nm-piso") || "Piso", meta: v("#nm-meta") || "Meta", turbo: v("#nm-turbo") || "Turbo" } };
    salvar("Salvo ✓");
  });
}
