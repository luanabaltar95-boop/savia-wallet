// =========================================================
// MOEDA E CÂMBIO (Ajustes) — moeda principal e cotação de cada
// moeda que uso. A cotação se atualiza sozinha com meus pagamentos.
// =========================================================
import { MOEDAS, moedaBase, moedasUsadas, cotacao, definirCotacao } from "../core/cambio.js";
import { invalidate } from "../core/plan.js";
import { shortDate } from "../core/format.js";
import { field, select, esc, toast } from "../components/ui.js";

const FONTE = { pagamento: "do meu último pagamento", manual: "que eu digitei", mercado: "do mercado" };
const num = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 });

export function cambioHtml(ctx) {
  const { state } = ctx;
  const base = moedaBase(state);
  const usadas = moedasUsadas(state);
  const linha = (m) => {
    const c = cotacao(state, m);
    return `<li class="cx">
      <div><div class="name">1 ${base} = ${c ? num(c.taxa) : "?"} ${m}</div>
        <div class="hint">${c ? `${FONTE[c.fonte] || ""}${c.em ? ` · ${shortDate(new Date(c.em))}` : ""}` : "sem cotação ainda"}</div></div>
      <form class="inline cb-form" data-cb="${m}" novalidate>
        ${field({ id: `cb-${m}`, label: `Quantos ${m} por 1 ${base}`, value: "", placeholder: c ? num(c.taxa) : "0" })}
        <button class="btn" type="submit">Salvar</button>
      </form>
      ${c && c.fonte !== "mercado" ? `<button class="link" data-cb-mercado="${m}">usar a do mercado</button>` : ""}
    </li>`;
  };
  return `<details class="card sec" data-sec="cambio" ${ctx.openSec === "cambio" ? "open" : ""}>
    <summary class="sec-head"><h2>Moeda e câmbio</h2><span class="total">${base}</span></summary>
    <div class="sec-body">
      <form id="cb-base" class="nova-cat" novalidate>
        ${select({ id: "cb-moeda", label: "Minha moeda principal", options: MOEDAS, value: base })}
        <button class="btn primary" type="submit">Salvar</button>
      </form>
      ${usadas.length ? `<ul class="cx-lista">${usadas.map(linha).join("")}</ul>` : `<p class="hint">Para uma conta em outra moeda, escolha a moeda na conta (Minhas contas).</p>`}
    </div>
  </details>`;
}

export function bindCambio(root, ctx) {
  const { state } = ctx;
  const salvar = (t) => { ctx.openSec = "cambio"; invalidate(state); ctx.persist(); ctx.rerender(); if (t) toast(t); };
  const fb = root.querySelector("#cb-base");
  if (fb) fb.addEventListener("submit", (e) => {
    e.preventDefault();
    state.config = { ...(state.config || {}), moeda: fb.querySelector("#cb-moeda").value };
    delete state.mercado; // busca de novo na moeda nova
    salvar("Salvo ✓");
  });
  root.querySelectorAll("[data-cb]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Number(f.querySelector("input").value.replace(",", "."));
    if (!(v > 0)) return;
    definirCotacao(state, f.dataset.cb, v);
    salvar("Salvo ✓");
  }));
  root.querySelectorAll("[data-cb-mercado]").forEach((b) => (b.onclick = () => { definirCotacao(state, b.dataset.cbMercado, 0); salvar(); }));
}
