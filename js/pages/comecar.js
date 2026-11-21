// =========================================================
// COMEÇAR — primeira vez no app: escolho um modelo, respondo
// poucas perguntas e o app já monta o meu menu, o ciclo,
// o salário e a conta principal. Tudo dá para mudar em Ajustes.
// =========================================================
import { MARCA } from "../config/marca.js";
import { MODULOS } from "../core/modulos.js";
import { MOEDAS } from "../core/cambio.js";
import { salvarParte } from "../core/config.js";
import { DIAS_SEMANA, toISO, addDays } from "../core/calendar.js";
import { field, select, esc } from "../components/ui.js";

// Modelos prontos: cada um já liga os módulos certos
export const MODELOS_APP = [
  { id: "semanal", label: "Recebo por semana", desc: "Salário toda semana, pago as contas na ordem", mods: ["metas"] },
  { id: "variavel", label: "Renda que muda", desc: "App de corrida, gorjeta, freela", mods: ["extra", "metas"] },
  { id: "casal", label: "Casal dividindo a casa", desc: "Contas divididas e quem deve quem", mods: ["dividir"] },
  { id: "dividas", label: "Saindo das dívidas", desc: "Cartões, empréstimos e o que quitar primeiro", mods: ["dividas", "financiamentos", "metas"] },
  { id: "zero", label: "Montar do zero", desc: "Escolho tudo eu mesma", mods: [] },
];
const FREQ = [{ id: "semanal", label: "Toda semana" }, { id: "quinzenal", label: "A cada 15 dias" }, { id: "mensal", label: "Todo mês" }];
const DIAS = DIAS_SEMANA.map((d, i) => ({ id: String(i), label: d }));

export const precisaComecar = (ctx) => {
  const c = ctx.state.config || {};
  return !c.onboarding && !(c.entradas || []).length && !(ctx.state.bancos || []).length
    && !Object.keys(ctx.state.renda || {}).length && !ctx.seed.mensais.length && !ctx.seed.cartoes.length;
};

export function renderComecar(root, ctx) {
  const d = ctx.comecar || (ctx.comecar = { modelo: "semanal", freq: "semanal", dia: "5", diaMes: 1, moeda: "USD", banco: "", salario: "", mods: ["metas"] });
  const mods = MODULOS.filter((m) => !m.emBreve && m.pergunta);
  root.innerHTML = `
    <header class="page-head home-head">
      <div class="brand"><img class="brand-logo" src="icons/icon-192.png" alt="" width="44" height="44">
        <div><p class="eyebrow">${MARCA}</p><h1>Vamos montar</h1></div></div>
    </header>

    <section class="card">
      <div class="card-head"><h2>Qual parece mais comigo?</h2></div>
      <div class="modelos">${MODELOS_APP.map((m) => `<button type="button" class="modelo ${d.modelo === m.id ? "on" : ""}" data-modelo="${m.id}"><b>${esc(m.label)}</b><small>${esc(m.desc)}</small></button>`).join("")}</div>
    </section>

    <form id="comecar" novalidate>
      <section class="card">
        <div class="card-head"><h2>Quando eu recebo</h2></div>
        <div class="fields stack">
          ${select({ id: "cm-freq", label: "Recebo", options: FREQ, value: d.freq })}
          ${d.freq === "mensal" ? field({ id: "cm-diames", label: "Dia do mês", value: d.diaMes }) : select({ id: "cm-dia", label: "Dia", options: DIAS, value: d.dia })}
          ${field({ id: "cm-salario", label: "Salário fixo (se tiver)", value: d.salario, prefix: "$", placeholder: "0,00" })}
          ${field({ id: "cm-banco", label: "Meu banco principal", type: "text", value: d.banco, placeholder: "Ex.: Chase, Nubank" })}
          ${select({ id: "cm-moeda", label: "Minha moeda", options: MOEDAS, value: d.moeda })}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>O que eu uso</h2></div>
        <ul class="mods">${mods.map((m) => `<li class="mod"><label class="mod-sw">
          <input type="checkbox" data-cm-mod="${m.id}" ${d.mods.includes(m.id) ? "checked" : ""}><span class="sw" aria-hidden="true"></span>
          <span class="mod-txt"><b>${esc(m.pergunta)}</b><small>${esc(m.label)}</small></span></label></li>`).join("")}</ul>
        <p class="hint">Dá para mudar depois em Ajustes → Meu menu.</p>
      </section>

      <button class="btn primary block" type="submit">Começar</button>
      <button class="link pular" type="button" id="cm-pular">pular por agora</button>
    </form>`;

  const f = root.querySelector("#comecar");
  // Guardo o rascunho a cada mudança (troca de modelo/frequência redesenha)
  const ler = () => {
    d.freq = f.querySelector("#cm-freq").value;
    if (f.querySelector("#cm-dia")) d.dia = f.querySelector("#cm-dia").value;
    if (f.querySelector("#cm-diames")) d.diaMes = Math.min(31, Math.max(1, Number(f.querySelector("#cm-diames").value) || 1));
    d.salario = f.querySelector("#cm-salario").value;
    d.banco = f.querySelector("#cm-banco").value;
    d.moeda = f.querySelector("#cm-moeda").value;
    d.mods = [...f.querySelectorAll("[data-cm-mod]:checked")].map((c) => c.dataset.cmMod);
  };
  root.querySelectorAll("[data-modelo]").forEach((b) => (b.onclick = () => {
    ler();
    d.modelo = b.dataset.modelo;
    d.mods = [...MODELOS_APP.find((m) => m.id === d.modelo).mods];
    if (d.modelo === "semanal" || d.modelo === "variavel") d.freq = "semanal";
    ctx.rerender();
  }));
  f.querySelector("#cm-freq").addEventListener("change", () => { ler(); ctx.rerender(); });
  root.querySelector("#cm-pular").onclick = () => { ctx.state.config = { ...(ctx.state.config || {}), onboarding: true }; ctx.persist(); ctx.rerender(); };
  f.addEventListener("submit", (e) => { e.preventDefault(); ler(); montar(ctx, d); });
}

// Aplica as respostas: ciclo, banco, salário, metas, moeda e módulos
function montar(ctx, d) {
  const { state } = ctx;
  const hoje = new Date();
  const dia = Number(d.dia);
  const ciclo = d.freq === "mensal" ? { tipo: "mensal", diaMes: d.diaMes }
    : d.freq === "quinzenal" ? { tipo: "quinzenal", diaSemana: dia, ancora: toISO(addDays(hoje, (dia - hoje.getDay() + 7) % 7)) }
    : { tipo: "semanal", diaSemana: dia };
  salvarParte(state, "ciclo", ciclo);
  const banco = { id: "b" + Date.now().toString(36), banco: d.banco.trim() || "Minha conta", tipo: "checking" };
  state.bancos = [banco];
  const salario = Number(String(d.salario).replace(",", ".")) || 0;
  const entradas = salario > 0 ? [{ id: "en-salario", nome: "Salário", tipo: "fixo", valor: salario, dia: d.freq === "mensal" ? "" : String(dia), conta: banco.id, divisao: [] }] : [];
  if (salario > 0) {
    const r50 = (v) => Math.round(v / 50) * 50;
    salvarParte(state, "metas", { piso: salario, meta: r50(salario * 1.3), turbo: r50(salario * 1.6) });
  }
  if (d.mods.includes("extra")) entradas.push({ id: "en-extra", nome: "Extra", tipo: "variavel", valor: 0, dia: d.freq === "mensal" ? "" : String(dia), conta: banco.id });
  state.config = {
    ...state.config,
    moeda: d.moeda,
    entradas,
    modulos: Object.fromEntries(MODULOS.map((m) => [m.id, d.mods.includes(m.id)])),
    atalhos: d.mods.includes("dividir") ? ["dividir"] : d.mods.includes("extra") ? ["extra"] : [],
    onboarding: true,
  };
  ctx.comecar = null;
  ctx.persist();
  location.hash = "#hoje";
  ctx.rerender();
}
