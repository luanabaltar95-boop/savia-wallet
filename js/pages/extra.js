// =========================================================
// PÁGINA EXTRA MONEY — central das calculadoras de dinheiro extra.
// Cada calculadora nasce de um modelo (motorista de app, simples).
// #extra = central · #extra-<id> = calculadora
// =========================================================
import { syncNote } from "../core/sync.js";
import { MODELOS, liquidoFonte, simplesLiquido, simplesDaSemana, simplesDoMes } from "../core/extra.js";
import { parte, salvarParte } from "../core/config.js";
import { toISO, fromISO, addDays, nextPayday, pagamentoAnterior } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { card, field, segmented, stats, esc, chip } from "../components/ui.js";
import { weekNav, bindWeekNav } from "../components/weekNav.js";
import { renderLyft } from "./lyft.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (iso) => { const d = fromISO(iso); return `${DIAS[d.getDay()]} ${shortDate(d)}`; };
const n = (v) => Number(v) || 0;

// ---------- Central ----------
function renderCentral(root, ctx) {
  const { seed, state, persist } = ctx;
  if (!ctx.payday) ctx.payday = nextPayday();
  const iso = toISO(ctx.payday);
  const fontes = seed.fontes || [];
  const total = fontes.reduce((a, f) => a + liquidoFonte(state, f, iso), 0);
  const nomeModelo = (id) => MODELOS.find((m) => m.id === id)?.label || id;

  const lista = fontes.map((f) => `
    <a class="fonte" href="#extra-${esc(f.id)}">
      <span><b>${esc(f.nome)}</b><small>${esc(nomeModelo(f.modelo))}</small></span>
      <span class="fonte-val">${money(liquidoFonte(state, f, iso))}<small>esta semana</small></span>
    </a>`).join("");

  root.innerHTML = `
    ${weekNav(ctx.payday, "Extra Money")}

    ${card({ title: "Dinheiro extra da semana", body: `<div class="big">${money(total)}</div>` })}

    ${card({ title: "Minhas calculadoras", body: fontes.length ? `<div class="fontes">${lista}</div>` : `<p class="hint">Nenhuma calculadora ainda.</p>` })}

    ${ctx.novaFonte ? `<form class="card" id="nova-fonte" novalidate>
        <div class="card-head"><h2>Nova calculadora</h2></div>
        <div class="fields">${field({ id: "nf-nome", name: "nome", label: "Nome", type: "text", value: "" })}</div>
        <fieldset class="modelos"><legend>Modelo</legend>
          ${MODELOS.map((m, i) => `<label class="modelo"><input type="radio" name="modelo" value="${m.id}" ${i === 0 ? "checked" : ""}><span><b>${m.label}</b><small>${m.desc}</small></span></label>`).join("")}
        </fieldset>
        <div class="inline-btns"><button class="btn primary" type="submit">Criar</button><button class="btn" type="button" id="nf-cancel">Cancelar</button></div>
      </form>` : `<button class="btn primary add-btn" id="nf-open">+ Adicionar</button>`}

    ${syncNote(ctx)}
  `;

  bindWeekNav(root, ctx);
  const open = root.querySelector("#nf-open");
  if (open) open.onclick = () => { ctx.novaFonte = true; ctx.rerender(); };
  const cancel = root.querySelector("#nf-cancel");
  if (cancel) cancel.onclick = () => { ctx.novaFonte = false; ctx.rerender(); };
  const form = root.querySelector("#nova-fonte");
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.nome.trim()) return;
    const id = d.nome.trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "fonte";
    const existe = parte(state, "fontes").some((f) => f.id === id);
    const novo = { id: existe ? `${id}-${Date.now().toString(36).slice(-4)}` : id, nome: d.nome.trim(), modelo: d.modelo };
    salvarParte(state, "fontes", [...parte(state, "fontes"), novo]);
    ctx.novaFonte = false;
    persist();
    location.hash = `extra-${novo.id}`;
  });
}

// ---------- Modelo simples ----------
function renderSimples(root, ctx, fonte) {
  const { state, persist } = ctx;
  if (!ctx.payday) ctx.payday = nextPayday();
  const iso = toISO(ctx.payday);
  const sem = simplesDaSemana(state, iso, fonte.id);
  const hoje = new Date();
  const mes = simplesDoMes(state, hoje.getFullYear(), hoje.getMonth(), fonte.id);
  const somaV = (l) => l.reduce((a, e) => a + n(e.valor), 0);
  const somaC = (l) => l.reduce((a, e) => a + n(e.custo), 0);
  const draft = ctx.simplesDraft || { data: toISO(hoje < ctx.payday ? hoje : addDays(ctx.payday, -1)) };

  const linhas = sem.map((e) => `<li class="reg">
    <span class="reg-dia">${diaCurto(e.data)}</span>
    <span class="reg-info">${esc(e.desc || "entrada")}${n(e.custo) ? ` · custo ${money(n(e.custo), true)}` : ""}</span>
    <span class="reg-val ok">+${money(simplesLiquido(e), true)}</span>
    <button class="link" data-dels="${esc(e.id)}">apagar</button></li>`).join("");

  root.innerHTML = `
    <a class="back" href="#extra">‹ Extra Money</a>
    ${weekNav(ctx.payday, esc(fonte.nome), `entradas ${shortDate(pagamentoAnterior(ctx.payday))} – ${shortDate(addDays(ctx.payday, -1))}`)}

    ${card({
      title: "Esta semana",
      body: `<div class="big">${money(somaV(sem) - somaC(sem))}</div>
        ${stats([{ label: "Entrou", valor: money(somaV(sem)) }, { label: "Custos", valor: money(somaC(sem)) }, { label: "Registros", valor: String(sem.length) }])}`,
    })}

    <form class="card" id="entrada" novalidate>
      <div class="card-head"><h2>Nova entrada</h2></div>
      <div class="fields stack">
        ${field({ id: "s-data", name: "data", label: "Data", type: "date", value: draft.data })}
        ${field({ id: "s-valor", name: "valor", label: "Valor recebido", value: draft.valor, prefix: "$", placeholder: "0,00" })}
        ${field({ id: "s-custo", name: "custo", label: "Custo", value: draft.custo, prefix: "$", placeholder: "0,00" })}
        ${field({ id: "s-desc", name: "desc", label: "Descrição", type: "text", value: draft.desc })}
      </div>
      <p class="preview" id="s-msg"></p>
      <button class="btn primary" type="submit">Salvar entrada</button>
    </form>

    ${card({ title: "Registros da semana", body: linhas ? `<ul class="regs">${linhas}</ul>` : `<p class="hint">Nada registrado nesta semana.</p>` })}

    ${card({ title: `Resumo de ${MESES[hoje.getMonth()]}`, body: stats([{ label: "Sobrou", valor: money(somaV(mes) - somaC(mes)) }, { label: "Entrou", valor: money(somaV(mes)) }, { label: "Custos", valor: money(somaC(mes)) }]) })}

    <button class="link danger-link" id="rm-fonte">Remover esta calculadora</button>
    ${syncNote(ctx)}
  `;

  bindWeekNav(root, ctx);
  const form = root.querySelector("#entrada");
  form.addEventListener("input", () => { ctx.simplesDraft = Object.fromEntries(new FormData(form)); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.data || !(n(d.valor) > 0)) { root.querySelector("#s-msg").innerHTML = `<span class="status warn">Preencha a data e o valor.</span>`; return; }
    state.entradasExtra = [...(state.entradasExtra || []), { id: "x" + Date.now().toString(36), origem: fonte.id, ...d }];
    ctx.simplesDraft = { data: d.data };
    persist(); ctx.rerender();
  });
  root.querySelectorAll("[data-dels]").forEach((b) => {
    b.onclick = () => { state.entradasExtra = state.entradasExtra.filter((x) => x.id !== b.dataset.dels); persist(); ctx.rerender(); };
  });
  bindRemover(root, ctx, fonte);
}

// Remover calculadora (pede confirmação na própria página)
function bindRemover(root, ctx, fonte) {
  const b = root.querySelector("#rm-fonte");
  if (!b) return;
  b.onclick = () => {
    if (b.dataset.confirm) {
      const { state } = ctx;
      salvarParte(state, "fontes", parte(state, "fontes").filter((f) => f.id !== fonte.id));
      state.entradasExtra = (state.entradasExtra || []).filter((x) => x.origem !== fonte.id);
      state.lyft = (state.lyft || []).filter((x) => (x.origem || "lyft") !== fonte.id);
      state.gasolina = (state.gasolina || []).filter((x) => (x.origem || "lyft") !== fonte.id);
      ctx.persist();
      location.hash = "extra";
    } else {
      b.dataset.confirm = "1";
      b.textContent = "Toque de novo para remover (apaga os registros dela)";
    }
  };
}

export function renderExtra(root, ctx, page) {
  if (page === "extra") return renderCentral(root, ctx);
  const id = page.replace(/^extra-/, "");
  const fonte = (ctx.seed.fontes || []).find((f) => f.id === id);
  if (!fonte) { location.hash = "extra"; return; }
  if (fonte.modelo === "simples") return renderSimples(root, ctx, fonte);
  renderLyft(root, ctx, fonte);
  // Lyft (motorista) também pode ser removida
  root.insertAdjacentHTML("beforeend", `<button class="link danger-link" id="rm-fonte">Remover esta calculadora</button>`);
  bindRemover(root, ctx, fonte);
}
