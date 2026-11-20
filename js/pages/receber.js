// =========================================================
// A RECEBER — dinheiro que me devem (fica na página Dividir).
// Entra no plano só quando eu registro que recebi.
// =========================================================
import { lista as listaReceber } from "../core/receber.js";
import { parte, salvarParte } from "../core/config.js";
import { toISO, fromISO } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, chip, esc } from "../components/ui.js";

export function receberHtml(ctx) {
  const { seed, state } = ctx;
  const rec = listaReceber(seed, state);
  const totalReceber = rec.reduce((a, r) => a + r.falta, 0);
  const hojeISO = toISO(new Date());
  const recHtml = rec.map((r) => {
    const tags = [];
    if (r.nota) tags.push(chip(r.nota));
    if (r.previsto) tags.push(chip(`previsto ${shortDate(fromISO(r.previsto))}`, "plan"));
    if (r.falta <= 0) tags.push(chip("recebido ✓", "ok"));
    const pagamentos = (state.recebimentos || []).filter((x) => x.receberId === r.id)
      .map((x) => `<li>${money(Number(x.valor), true)} em ${shortDate(fromISO(x.data))} <button class="link" data-delrec="${esc(x.id)}">apagar</button></li>`).join("");
    const aberto = ctx.receberAberto === r.id;
    return `<li class="debt receber">
      <div class="debt-main">
        <div class="debt-top"><span class="name">${esc(r.nome)}</span><span class="value">${money(r.falta)}</span></div>
        <div class="meta">${tags.join("")}</div>
        <div class="track thin"><div class="fill" style="width:${r.valor ? (r.recebido / r.valor) * 100 : 0}%"></div></div>
        <div class="hint">recebido ${money(r.recebido)} de ${money(r.valor)}</div>
        ${pagamentos ? `<ul class="mini">${pagamentos}</ul>` : ""}
        ${aberto ? `<form class="inline rec-form" data-recform="${esc(r.id)}" novalidate>
            ${field({ id: `rv-${r.id}`, name: "valor", label: "Quanto recebeu", value: r.falta, prefix: "$" })}
            ${field({ id: `rd-${r.id}`, name: "data", label: "Quando", type: "date", value: hojeISO })}
            <button class="btn primary" type="submit">Salvar</button>
          </form>` : ""}
        <div class="row-actions">
          ${r.falta > 0 ? `<button class="link" data-recebi="${esc(r.id)}">${aberto ? "cancelar" : "Recebi"}</button>` : ""}
          <button class="link" data-rmrec="${esc(r.id)}">remover</button>
        </div>
      </div>
    </li>`;
  }).join("");

  return `
    <section class="card">
      <div class="card-head"><h2>A receber</h2><span class="total">${money(totalReceber)}</span></div>
      
      ${rec.length ? `<ul class="debts">${recHtml}</ul>` : `<p class="hint">Ninguém me deve nada por aqui.</p>`}
      ${ctx.receberNovo ? `<form id="rec-novo" novalidate>
          <div class="fields">
            ${field({ id: "rn-nome", name: "nome", label: "Quem me deve / de onde", type: "text" })}
            ${field({ id: "rn-valor", name: "valor", label: "Valor", prefix: "$", placeholder: "0,00" })}
            ${field({ id: "rn-prev", name: "previsto", label: "Previsão (opcional)", type: "date" })}
            ${field({ id: "rn-nota", name: "nota", label: "Observação (opcional)", type: "text" })}
          </div>
          <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button><button class="btn" type="button" id="rn-cancel">Cancelar</button></div>
        </form>` : `<button class="btn primary add-btn" id="rn-open">+ Adicionar</button>`}
    </section>
  `;
}

export function bindReceber(root, ctx) {
  const { state } = ctx;
  const salvar = () => { ctx.persist(); ctx.rerender(); };
  root.querySelectorAll("[data-recebi]").forEach((b) => {
    b.onclick = () => { ctx.receberAberto = ctx.receberAberto === b.dataset.recebi ? null : b.dataset.recebi; ctx.rerender(); };
  });
  root.querySelectorAll("[data-recform]").forEach((f) => {
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!(Number(d.valor) > 0) || !d.data) return;
      state.recebimentos = [...(state.recebimentos || []), { id: "rc-" + Date.now().toString(36), receberId: f.dataset.recform, valor: Number(d.valor), data: d.data }];
      ctx.receberAberto = null;
      salvar();
    });
  });
  root.querySelectorAll("[data-delrec]").forEach((b) => {
    b.onclick = () => { state.recebimentos = state.recebimentos.filter((x) => x.id !== b.dataset.delrec); salvar(); };
  });
  root.querySelectorAll("[data-rmrec]").forEach((b) => {
    b.onclick = () => {
      salvarParte(state, "receber", parte(state, "receber").filter((r) => r.id !== b.dataset.rmrec));
      state.recebimentos = (state.recebimentos || []).filter((x) => x.receberId !== b.dataset.rmrec);
      salvar();
    };
  });
  const rnOpen = root.querySelector("#rn-open");
  if (rnOpen) rnOpen.onclick = () => { ctx.receberNovo = true; ctx.rerender(); };
  const rnCancel = root.querySelector("#rn-cancel");
  if (rnCancel) rnCancel.onclick = () => { ctx.receberNovo = false; ctx.rerender(); };
  const rnForm = root.querySelector("#rec-novo");
  if (rnForm) rnForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(rnForm));
    if (!d.nome.trim() || !(Number(d.valor) > 0)) return;
    salvarParte(state, "receber", [...parte(state, "receber"), { id: "r-" + Date.now().toString(36), nome: d.nome.trim(), valor: Number(d.valor), previsto: d.previsto || "", nota: (d.nota || "").trim() }]);
    ctx.receberNovo = false;
    salvar();
  });

}
