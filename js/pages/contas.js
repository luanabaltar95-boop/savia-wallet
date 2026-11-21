// =========================================================
// PÁGINA MINHAS CONTAS — meus bancos (número e routing com copiar,
// taxa e saldo calculado sozinho), transferências entre contas e
// meus gastos: + Adicionar gasto, escolhendo banco ou cartão.
// O saldo = último conferido + entradas − pagamentos − gastos ± transferências.
// =========================================================
import { syncNote } from "../core/sync.js";
import { TIPOS, mascara, saldoBanco, salvarSaldo } from "../core/bancos.js";
import { money, shortDate } from "../core/format.js";
import { base, movimentos, previstoNaConta, transferir, apagarTransferencia } from "../core/saldo.js";
import { toISO } from "../core/calendar.js";
import { card, field, select, chip, esc, toast } from "../components/ui.js";
import { gastoFormHtml, gastosListaHtml, bindGastos } from "./gastos.js";
import { importarHtml, bindImportar } from "./importar.js";
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
    const bs = base(state, b);
    const em = bs && bs.em;
    const movs = bs ? movimentos(state, b.id, bs.em) : [];
    const vai = previstoNaConta(state, b.id);
    if (editando === b.id) return formBanco(b);
    return `<article class="card acc">
      <div class="card-head"><h2>${esc(b.banco)}</h2>${chip(TIPOS.find((t) => t.id === b.tipo)?.label || b.tipo)}</div>
      <div class="big ${saldo < 0 ? "neg" : ""}">${saldo == null ? "—" : money(saldo, true)}</div>
      <p class="hint">${em ? `conferido em ${quando(em)}${movs.length ? ` · ${movs.length} movimento${movs.length > 1 ? "s" : ""} depois` : ""}` : "Confira o saldo uma vez para o app calcular sozinho."}</p>
      ${vai.length ? `<p class="hint">vai cair ${vai.map((x) => `${money(x.valor, true)} (${esc(x.nome)})`).join(" + ")}</p>` : ""}
      ${movs.length ? `<details class="sub movs"><summary>Movimentos</summary><ul class="resumo-lista">${movs.slice(0, 30).map((m) => `<li><div class="rs-nome"><span>${esc(m.desc)}</span><small class="hint">${quando(m.ts)}</small></div><b class="${m.valor < 0 ? "" : "pos"}">${m.valor > 0 ? "+" : "−"}${money(Math.abs(m.valor), true)}</b>${m.transf ? `<button class="link danger" data-rm-transf="${esc(m.transf)}">apagar</button>` : ""}</li>`).join("")}</ul></details>` : ""}
      ${linhaNum(b, "conta", "Conta")}
      ${linhaNum(b, "routing", "Routing")}
      <p class="hint">${Number(b.taxa) > 0 ? `Taxa mensal ${money(Number(b.taxa), true)}` : "Sem taxa mensal"}</p>
      <form class="inline saldo-form" data-saldo="${esc(b.id)}" novalidate>
        ${field({ id: `sd-${b.id}`, label: "Conferir com o banco (quanto mostra agora)", type: "text", attrs: 'inputmode="decimal"', prefix: "$", value: "", placeholder: "0,00" })}
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
  const opcoesBanco = bancos.map((b) => ({ id: b.id, label: b.banco }));
  const transf = bancos.length > 1 ? (ctx.transfAberta ? `<form class="card" id="form-transf" novalidate>
      <div class="card-head"><h2>Transferir entre contas</h2></div>
      <div class="fields stack">
        ${select({ id: "tf-de", label: "De", options: opcoesBanco, value: bancos[0].id })}
        ${select({ id: "tf-para", label: "Para", options: opcoesBanco, value: bancos[1].id })}
        ${field({ id: "tf-saiu", name: "saiu", label: "Saiu", prefix: "$", placeholder: "0,00" })}
        ${field({ id: "tf-chegou", name: "chegou", label: "Chegou (se for diferente: taxa ou câmbio)", placeholder: "igual" })}
        ${field({ id: "tf-data", name: "data", label: "Quando", type: "date", value: toISO(new Date()) })}
      </div>
      <div class="inline-btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" id="tf-cancel">Cancelar</button></div>
    </form>` : `<button class="btn add-btn" id="tf-abrir">Transferir entre contas</button>`) : "";

  root.innerHTML = `
    <header class="page-head"><div class="eyebrow-row"><p class="eyebrow">Contas e gastos</p></div><h1 class="mes">Minhas contas</h1></header>
    ${gastoFormHtml(ctx)}
    ${bancos.length ? card({ title: "Total nas contas", body: `<div class="big ${total < 0 ? "neg" : ""}">${money(total, true)}</div>` }) : ""}
    ${transf}
    ${importarHtml(ctx)}
    ${bancos.map(cartao).join("")}
    ${editando === "novo" ? formBanco() : `<button class="btn primary add-btn" id="add-banco">+ Adicionar</button>`}
    ${gastosListaHtml(ctx)}
    ${syncNote(ctx)}
  `;

  bindGastos(root, ctx);
  bindImportar(root, ctx);
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
    const dif = salvarSaldo(state, bancos.find((x) => x.id === f.dataset.saldo), v);
    persist(); ctx.rerender();
    toast(Math.abs(dif) > 0.004 ? `${money(Math.abs(dif), true)} de ${dif > 0 ? "taxas e câmbio" : "a mais"} ✓` : "Conferido ✓");
  }));

  // Transferências
  const ta = root.querySelector("#tf-abrir");
  if (ta) ta.onclick = () => { ctx.transfAberta = true; ctx.rerender(); };
  const tc = root.querySelector("#tf-cancel");
  if (tc) tc.onclick = () => { ctx.transfAberta = false; ctx.rerender(); };
  const tf = root.querySelector("#form-transf");
  if (tf) tf.addEventListener("submit", (e) => {
    e.preventDefault();
    const de = tf.querySelector("#tf-de").value, para = tf.querySelector("#tf-para").value;
    const saiu = Number(tf.saiu.value.replace(",", ".")), chegou = Number(tf.chegou.value.replace(",", ".")) || saiu;
    if (de === para) return toast("Escolha contas diferentes");
    if (!(saiu > 0)) return toast("Coloque o valor");
    const nomes = Object.fromEntries(bancos.map((b) => [b.id, b.banco]));
    transferir(state, { de, para, saiu, chegou, data: tf.data.value }, nomes);
    ctx.transfAberta = false; persist(); ctx.rerender();
    toast(chegou < saiu ? `Transferido ✓ · taxa ${money(saiu - chegou, true)}` : "Transferido ✓");
  });
  root.querySelectorAll("[data-rm-transf]").forEach((b) => (b.onclick = () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    apagarTransferencia(state, b.dataset.rmTransf); persist(); ctx.rerender();
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
