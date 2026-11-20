// =========================================================
// PÁGINA MINHAS CONTAS — meus bancos (número e routing com copiar,
// taxa e saldo) e meus gastos: + Adicionar gasto, escolhendo banco ou cartão.
// =========================================================
import { syncNote } from "../core/sync.js";
import { TIPOS, mascara, saldoBanco, salvarSaldo } from "../core/bancos.js";
import { money, shortDate } from "../core/format.js";
import { card, field, select, chip, esc } from "../components/ui.js";
import { gastoFormHtml, gastosListaHtml, bindGastos } from "./gastos.js";
import { bindWeekNav } from "../components/weekNav.js";

const COPY = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>`;
const quando = (ts) => (ts ? shortDate(new Date(ts)) : "");

export function renderContas(root, ctx) {
  const { state, persist } = ctx;
  const bancos = state.bancos || [];
  const ver = ctx.verConta || {};
  const editando = ctx.editBanco;

  const linhaNum = (b, campo, label) => {
    const v = b[campo];
    const aberto = ver[`${b.id}:${campo}`];
    return `<div class="acc-row">
      <span class="acc-lbl">${label}</span>
      <span class="acc-num">${v ? (aberto || campo === "routing" ? esc(v) : mascara(v)) : "—"}</span>
      ${v && campo === "conta" ? `<button class="link" data-ver="${esc(b.id)}:${campo}">${aberto ? "ocultar" : "mostrar"}</button>` : ""}
      ${v ? `<button class="btn icon" data-copy="${esc(v)}" aria-label="Copiar ${label}">${COPY}</button>` : ""}
    </div>`;
  };

  const cartao = (b) => {
    const saldo = saldoBanco(state, b);
    const em = b.id === "citibank" ? (state.saldoConta || {}).em : b.saldoEm;
    if (editando === b.id) return formBanco(b);
    return `<article class="card acc">
      <div class="card-head"><h2>${esc(b.banco)}</h2>${chip(TIPOS.find((t) => t.id === b.tipo)?.label || b.tipo)}</div>
      <div class="big ${saldo < 0 ? "neg" : ""}">${saldo == null ? "—" : money(saldo, true)}</div>
      ${em ? `<p class="hint">Saldo de ${quando(em)}</p>` : ""}
      ${linhaNum(b, "conta", "Conta")}
      ${linhaNum(b, "routing", "Routing")}
      <p class="hint">${Number(b.taxa) > 0 ? `Taxa mensal ${money(Number(b.taxa), true)}` : "Sem taxa mensal"}</p>
      <form class="inline saldo-form" data-saldo="${esc(b.id)}" novalidate>
        ${field({ id: `sd-${b.id}`, label: "Atualizar saldo", type: "text", attrs: 'inputmode="decimal"', prefix: "$", value: "", placeholder: "0,00" })}
        <button class="btn" type="submit">Salvar</button>
      </form>
      <button class="link" data-edit="${esc(b.id)}">editar dados</button>
    </article>`;
  };

  function formBanco(b = {}) {
    return `<form class="card" id="form-banco" data-id="${esc(b.id || "")}" novalidate>
      <div class="card-head"><h2>${b.id ? "Editar conta" : "Nova conta"}</h2></div>
      <div class="fields stack">
        ${field({ id: "fb-banco", name: "banco", label: "Banco", type: "text", value: b.banco })}
        ${select({ id: "fb-tipo", label: "Tipo", options: TIPOS, value: b.tipo || "checking" })}
        ${field({ id: "fb-conta", name: "conta", label: "Número da conta", type: "text", attrs: 'inputmode="numeric" autocomplete="off"', value: b.conta })}
        ${field({ id: "fb-routing", name: "routing", label: "Routing number", type: "text", attrs: 'inputmode="numeric" autocomplete="off"', value: b.routing })}
        ${field({ id: "fb-taxa", name: "taxa", label: "Taxa mensal", prefix: "$", value: b.taxa, placeholder: "0,00" })}
      </div>
      <div class="inline-btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" id="fb-cancel">Cancelar</button>
      ${b.id && b.id !== "citibank" ? `<button class="link danger-link" type="button" id="fb-del">remover</button>` : ""}</div>
    </form>`;
  }

  const total = bancos.reduce((a, b) => a + (saldoBanco(state, b) || 0), 0);

  root.innerHTML = `
    <header class="page-head"><div class="eyebrow-row"><p class="eyebrow">Contas e gastos</p></div><h1 class="mes">Minhas contas</h1></header>
    ${gastoFormHtml(ctx)}
    ${bancos.length ? card({ title: "Total nas contas", body: `<div class="big ${total < 0 ? "neg" : ""}">${money(total, true)}</div>` }) : ""}
    ${bancos.map(cartao).join("")}
    ${editando === "novo" ? formBanco() : `<button class="btn primary add-btn" id="add-banco">+ Adicionar</button>`}
    ${gastosListaHtml(ctx)}
    ${syncNote(ctx)}
  `;

  bindGastos(root, ctx);
  bindWeekNav(root, ctx);
  root.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = () => { ctx.verConta = { ...ver, [b.dataset.ver]: !ver[b.dataset.ver] }; ctx.rerender(); }));
  root.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.classList.add("copiado"); setTimeout(() => b.classList.remove("copiado"), 1200); } catch { /* sem permissão de copiar */ }
  }));
  root.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => { ctx.editBanco = b.dataset.edit; ctx.rerender(); }));
  const add = root.querySelector("#add-banco");
  if (add) add.onclick = () => { ctx.editBanco = "novo"; ctx.rerender(); };

  root.querySelectorAll("[data-saldo]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = f.querySelector("input").value.replace(",", ".").trim();
    const v = Number(raw);
    if (raw === "" || !Number.isFinite(v)) return;
    salvarSaldo(state, bancos.find((x) => x.id === f.dataset.saldo), v);
    persist(); ctx.rerender();
  }));

  const form = root.querySelector("#form-banco");
  if (form) {
    form.querySelector("#fb-cancel").onclick = () => { ctx.editBanco = null; ctx.rerender(); };
    const del = form.querySelector("#fb-del");
    if (del) del.onclick = () => { state.bancos = bancos.filter((x) => x.id !== form.dataset.id); ctx.editBanco = null; persist(); ctx.rerender(); };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      if (!d.banco.trim()) return;
      const dados = { banco: d.banco.trim(), tipo: form.querySelector("#fb-tipo").value, conta: d.conta.replace(/\s/g, ""), routing: d.routing.replace(/\s/g, ""), taxa: Number(d.taxa) || 0 };
      state.bancos = form.dataset.id
        ? bancos.map((x) => (x.id === form.dataset.id ? { ...x, ...dados } : x))
        : [...bancos, { id: "b" + Date.now().toString(36), ...dados }];
      ctx.editBanco = null;
      persist(); ctx.rerender();
    });
  }
}
