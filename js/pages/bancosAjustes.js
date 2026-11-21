// =========================================================
// MEUS BANCOS (Ajustes) — as mesmas contas de Minhas contas.
// O que eu cadastro aqui aparece em entradas, pagamentos e transferências.
// Número e routing ficam só nos meus dados.
// =========================================================
import { TIPOS, mascara } from "../core/bancos.js";
import { field, select, chip, esc, toast } from "../components/ui.js";

export function bancosAjustesHtml(ctx, n) {
  const { state } = ctx;
  const bancos = state.bancos || [];
  const ed = ctx.bancoAjuste; // id em edição ou "novo"
  const form = (b = {}) => `<form class="ent-cad" id="banco-cad" data-id="${esc(b.id || "")}" novalidate>
      <div class="fields stack">
        ${field({ id: "bc-banco", name: "banco", label: "Banco", type: "text", value: b.banco || "", placeholder: "Ex.: Wise, Nubank" })}
        ${select({ id: "bc-tipo", label: "Tipo", options: TIPOS, value: b.tipo || "checking" })}
        ${field({ id: "bc-conta", name: "conta", label: "Número da conta (opcional)", type: "text", attrs: 'inputmode="numeric" autocomplete="off"', value: b.conta || "" })}
        ${field({ id: "bc-routing", name: "routing", label: "Routing / agência (opcional)", type: "text", attrs: 'inputmode="numeric" autocomplete="off"', value: b.routing || "" })}
        ${field({ id: "bc-taxa", name: "taxa", label: "Taxa mensal", prefix: "$", value: b.taxa ?? "", placeholder: "0,00" })}
      </div>
      <div class="inline-btns">
        <button class="btn primary" type="submit">Salvar</button>
        <button class="btn" type="button" id="bc-cancel">Cancelar</button>
        ${b.id && bancos.length > 1 ? `<button class="link danger" type="button" id="bc-del">remover</button>` : ""}
      </div>
    </form>`;
  const linha = (b) => ed === b.id ? form(b) : `<li class="share">
      <div><div class="name">${esc(b.banco)}</div>
        <div class="meta">${chip(TIPOS.find((t) => t.id === b.tipo)?.label || b.tipo)}${b.conta ? chip(mascara(b.conta)) : ""}</div></div>
      <button class="link" data-bc-edit="${esc(b.id)}">editar</button>
    </li>`;
  return `<details class="card sec" data-sec="bancos" ${ctx.openSec === "bancos" ? "open" : ""}>
    <summary class="sec-head"><h2>${n ? `<span class="passo">${n}</span>` : ""}Meus bancos</h2><span class="total">${bancos.length}</span></summary>
    <div class="sec-body">
      ${bancos.length ? `<ul class="shares">${bancos.map(linha).join("")}</ul>` : `<p class="hint">Cadastro as contas onde o dinheiro cai e sai.</p>`}
      ${ed === "novo" ? form() : `<button class="btn primary add-btn" id="bc-novo">+ Adicionar</button>`}
    </div>
  </details>`;
}

export function bindBancosAjustes(root, ctx) {
  const { state, persist } = ctx;
  const fim = (t) => { ctx.bancoAjuste = null; ctx.openSec = "bancos"; persist(); ctx.rerender(); if (t) toast(t); };
  const novo = root.querySelector("#bc-novo");
  if (novo) novo.onclick = () => { ctx.bancoAjuste = "novo"; ctx.openSec = "bancos"; ctx.rerender({ focus: "bc-banco" }); };
  root.querySelectorAll("[data-bc-edit]").forEach((b) => (b.onclick = () => { ctx.bancoAjuste = b.dataset.bcEdit; ctx.openSec = "bancos"; ctx.rerender(); }));
  const f = root.querySelector("#banco-cad");
  if (!f) return;
  f.querySelector("#bc-cancel").onclick = () => { ctx.bancoAjuste = null; ctx.rerender(); };
  const del = f.querySelector("#bc-del");
  if (del) del.onclick = () => {
    if (!del.dataset.confirma) { del.dataset.confirma = "1"; del.textContent = "confirmar"; return; }
    state.bancos = (state.bancos || []).filter((x) => x.id !== f.dataset.id);
    fim();
  };
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const banco = f.banco.value.trim();
    if (!banco) return toast("Escreva o nome do banco");
    const dados = { banco, tipo: f.querySelector("#bc-tipo").value, conta: f.conta.value.replace(/\s/g, ""), routing: f.routing.value.replace(/\s/g, ""), taxa: Number(String(f.taxa.value).replace(",", ".")) || 0 };
    const lista = state.bancos || [];
    state.bancos = f.dataset.id ? lista.map((x) => (x.id === f.dataset.id ? { ...x, ...dados } : x)) : [...lista, { id: "b" + Date.now().toString(36), ...dados }];
    fim("Salvo ✓");
  });
}
