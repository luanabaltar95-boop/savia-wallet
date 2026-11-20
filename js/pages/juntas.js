// =========================================================
// PÁGINA COMPARTILHADO — contas divididas. Por enquanto você registra
// tudo; no futuro dá para convidar a outra pessoa.
// Semanais divididas meio a meio; marque "paguei sozinha" na semana
// em que pagou tudo — o plano da Hoje usa o valor certo.
// =========================================================
import { syncNote } from "../core/sync.js";
import { receberHtml, bindReceber } from "./receber.js";
import { divisao } from "../core/plan.js";
import { parte, salvarParte } from "../core/config.js";
import { toISO, fromISO, addDays, nextPayday } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { card, field, select, chip, esc } from "../components/ui.js";
import { weekNav, bindWeekNav } from "../components/weekNav.js";

const FREQ = [{ id: "semanal", label: "Semanal" }, { id: "mensal", label: "Mensal" }, { id: "trimestral", label: "A cada 3 meses" }];
const FREQ_TXT = { semanal: "por semana", mensal: "por mês", trimestral: "a cada 3 meses" };

export function renderJuntas(root, ctx) {
  const { seed, state, persist } = ctx;
  if (!ctx.payday) ctx.payday = nextPayday();
  const iso = toISO(ctx.payday);
  const semanais = seed.semanais.filter((s) => s.compartilhado);
  const outras = seed.compartilhadas || [];

  // ---- Esta semana ----
  let minha = 0, total = 0;
  const linhas = semanais.map((s) => {
    const sozinha = divisao(state, iso, s.id) === "sozinha";
    const parteMinha = sozinha ? s.valor : s.valor / 2;
    minha += parteMinha; total += s.valor;
    return `<li class="share">
      <div><div class="name">${esc(s.nome)}</div><div class="hint">total ${money(s.valor, true)} · minha parte <b>${money(parteMinha, true)}</b></div></div>
      <button class="toggle ${sozinha ? "on" : ""}" data-toggle="${esc(s.id)}" aria-pressed="${sozinha}">${sozinha ? "Paguei sozinha" : "Dividido"}</button>
    </li>`;
  }).join("");

  // ---- Semanas que paguei sozinha ----
  const historico = Object.entries(state.compart || {})
    .map(([sem, m]) => ({ sem, ids: Object.entries(m).filter(([, v]) => v === "sozinha").map(([id]) => id) }))
    .filter((h) => h.ids.length)
    .sort((a, b) => b.sem.localeCompare(a.sem));
  const extraDe = (ids) => ids.reduce((a, id) => a + (seed.semanais.find((s) => s.id === id)?.valor || 0) / 2, 0);
  const totalExtra = historico.reduce((a, h) => a + extraDe(h.ids), 0);
  const histHtml = historico.length
    ? `<ul class="regs">${historico.map((h) => `<li class="reg">
        <span class="reg-dia">sex ${shortDate(fromISO(h.sem))}</span>
        <span class="reg-info">${h.ids.map((id) => esc(seed.semanais.find((s) => s.id === id)?.nome.split(" — ")[0] || id)).join(", ")}</span>
        <span class="reg-val">+${money(extraDe(h.ids), true)}</span><span></span></li>`).join("")}</ul>
       <p class="hint">Cobri sozinha <b>${money(totalExtra, true)}</b> além da minha metade.</p>`
    : `<p class="hint">Nenhuma semana paga sozinha ainda.</p>`;

  // ---- Todas as contas ----
  const todas = [
    ...semanais.map((s) => ({ nome: s.nome, valor: s.valor, freq: "semanal", obs: "" })),
    ...outras,
  ].map((c, i) => `<li class="share">
      <div><div class="name">${esc(c.nome)}</div>
        <div class="meta">${chip(`${money(Number(c.valor), true)} ${FREQ_TXT[c.freq] || ""}`)}${chip(`minha parte ${money(Number(c.valor) / 2, true)}`, "plan")}</div>
        ${c.obs ? `<div class="hint">${esc(c.obs)}</div>` : ""}</div>
      ${i >= semanais.length ? `<button class="link" data-rmc="${i - semanais.length}">remover</button>` : ""}
    </li>`).join("");

  root.innerHTML = `
    ${weekNav(ctx.payday, "Dividir")}

    ${card({
      title: "Esta semana",
      total: `minha parte ${money(minha, true)}`,
      body: `<ul class="shares">${linhas}</ul>`,
    })}

    ${card({ title: "Semanas que paguei sozinha", body: histHtml })}

    <section class="card">
      <div class="card-head"><h2>Contas compartilhadas</h2></div>
      <ul class="shares">${todas}</ul>
      ${ctx.novaConta ? `<form id="nova-conta" novalidate>
          <div class="fields">
            ${field({ id: "nc-nome", name: "nome", label: "Conta", type: "text" })}
            ${field({ id: "nc-valor", name: "valor", label: "Valor total", prefix: "$", placeholder: "0,00" })}
            ${select({ id: "nc-freq", label: "Frequência", options: FREQ, value: "mensal" })}
          </div>
          <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button><button class="btn" type="button" id="nc-cancel">Cancelar</button></div>
        </form>` : `<button class="btn primary add-btn" id="nc-open">+ Adicionar</button>`}
    </section>

    ${receberHtml(ctx)}

    ${syncNote(ctx)}
  `;

  bindReceber(root, ctx);
  bindWeekNav(root, ctx);

  root.querySelectorAll("[data-toggle]").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.toggle;
      const sem = { ...((state.compart || {})[iso] || {}) };
      if (sem[id] === "sozinha") delete sem[id]; else sem[id] = "sozinha";
      state.compart = { ...(state.compart || {}), [iso]: sem };
      persist(); ctx.rerender();
    };
  });

  const open = root.querySelector("#nc-open");
  if (open) open.onclick = () => { ctx.novaConta = true; ctx.rerender(); };
  const cancel = root.querySelector("#nc-cancel");
  if (cancel) cancel.onclick = () => { ctx.novaConta = false; ctx.rerender(); };
  const form = root.querySelector("#nova-conta");
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.nome.trim() || !(Number(d.valor) > 0)) return;
    if (d["nc-freq"] === "semanal") {
      // Semanal entra também no plano da Hoje (dividida)
      salvarParte(state, "semanais", [...parte(state, "semanais"), { id: "u-" + Date.now().toString(36), nome: d.nome.trim(), valor: Number(d.valor), grupo: "vida", compartilhado: true }]);
    } else {
      salvarParte(state, "compartilhadas", [...parte(state, "compartilhadas"), { id: "c-" + Date.now().toString(36), nome: d.nome.trim(), valor: Number(d.valor), freq: d["nc-freq"], obs: "" }]);
    }
    ctx.novaConta = false;
    persist(); ctx.rerender();
  });
  root.querySelectorAll("[data-rmc]").forEach((b) => {
    b.onclick = () => {
      salvarParte(state, "compartilhadas", parte(state, "compartilhadas").filter((_, i) => i !== Number(b.dataset.rmc)));
      persist(); ctx.rerender();
    };
  });
}
