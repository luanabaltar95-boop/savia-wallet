// =========================================================
// COMEÇAR — primeira vez no app.
//   Passo 1: O que você deseja alcançar? (vários objetivos, um principal)
//   Passo 2: só o que falta para esses objetivos. Cada informação é
//            pedida uma vez, mesmo que vários objetivos precisem dela,
//            e nada que já está na carteira é perguntado de novo.
// O resto (contas, cartões…) é cadastrado aos poucos em Ajustes.
// =========================================================
import { MARCA } from "../config/marca.js";
import { MODULOS } from "../core/modulos.js";
import { MOEDAS } from "../core/cambio.js";
import { salvarParte } from "../core/config.js";
import { DIAS_SEMANA, toISO, addDays } from "../core/calendar.js";
import { TIPOS, tipo } from "../goals/tipos.js";
import { NECESSIDADES, necessidadesDe } from "../goals/necessidades.js";
import { salvarObjetivos, normalizar, novoIdObjetivo } from "../goals/modelo.js";
import { seletorObjetivos, camposObjetivo, lerCamposObjetivo } from "../components/objetivos.js";
import { field, select, esc } from "../components/ui.js";

const FREQ = [{ id: "semanal", label: "Toda semana" }, { id: "quinzenal", label: "A cada 15 dias" }, { id: "mensal", label: "Todo mês" }];
const DIAS = DIAS_SEMANA.map((d, i) => ({ id: String(i), label: d }));

export const precisaComecar = (ctx) => {
  const c = ctx.state.config || {};
  return !c.onboarding && !(c.entradas || []).length && !(ctx.state.bancos || []).length
    && !Object.keys(ctx.state.renda || {}).length && !ctx.seed.mensais.length && !ctx.seed.cartoes.length;
};

const cabecalho = (titulo, sub) => `<header class="page-head home-head">
  <div class="brand"><img class="brand-logo" src="icons/icon-192.png" alt="" width="44" height="44">
    <div><p class="eyebrow">${MARCA}</p><h1>${titulo}</h1></div></div></header>${sub ? `<p class="onb-sub">${sub}</p>` : ""}`;

export function renderComecar(root, ctx) {
  const d = ctx.comecar || (ctx.comecar = { passo: 1, tipos: [], principal: null, freq: "semanal", dia: "5", diaMes: 1, moeda: "USD", banco: "", salario: "", objetivos: {} });
  if (d.passo === 1) return passoObjetivos(root, ctx, d);
  return passoDados(root, ctx, d);
}

function passoObjetivos(root, ctx, d) {
  root.innerHTML = `
    ${cabecalho("O que você deseja alcançar?", "Personalize sua carteira de acordo com seus objetivos.")}
    <section class="card">
      ${seletorObjetivos({ selecionados: d.tipos, principal: d.principal })}
      <p class="hint">Escolha um ou mais. A estrela marca o principal. Dá para mudar depois.</p>
    </section>
    <button class="btn primary block" type="button" id="onb-seguir" ${d.tipos.length ? "" : "disabled"}>Continuar</button>
    <button class="link pular" type="button" id="cm-pular">pular por agora</button>`;
  root.querySelectorAll("[data-ob-tipo]").forEach((b) => (b.onclick = () => {
    const t = b.dataset.obTipo;
    d.tipos = d.tipos.includes(t) ? d.tipos.filter((x) => x !== t) : [...d.tipos, t];
    if (!d.tipos.includes(d.principal)) d.principal = d.tipos[0] || null;
    ctx.rerender();
  }));
  root.querySelectorAll("[data-ob-principal]").forEach((b) => (b.onclick = () => { d.principal = b.dataset.obPrincipal; ctx.rerender(); }));
  root.querySelector("#onb-seguir").onclick = () => { d.passo = 2; ctx.rerender(); window.scrollTo(0, 0); };
  root.querySelector("#cm-pular").onclick = () => pular(ctx);
}

function pular(ctx) {
  ctx.state.config = { ...(ctx.state.config || {}), onboarding: true };
  ctx.comecar = null; ctx.persist(); ctx.rerender();
}

// Os objetivos em ordem: principal primeiro
const ordenados = (d) => [d.principal, ...d.tipos.filter((t) => t !== d.principal)].filter(Boolean);

function passoDados(root, ctx, d) {
  const { seed, state } = ctx;
  const nec = necessidadesDe(d.tipos);
  const falta = (id) => nec.includes(id) && !NECESSIDADES[id].ok(seed, state, null);
  const pedirPagamento = falta("pagamento");
  const pedirBanco = !pedirPagamento && falta("bancos");
  const tipos = ordenados(d);
  const comValor = tipos.filter((t) => tipo(t).dinheiro);
  const mods = MODULOS.filter((m) => !m.emBreve && m.pergunta);
  const ligados = new Set(d.mods || tipos.flatMap((t) => tipo(t).modulos));
  d.mods = [...ligados];
  // O que já está na carteira e vai ser usado (fonte única)
  const jaTenho = [
    seed.cartoes.length ? `${seed.cartoes.length} cartões` : "", seed.outras.length ? `${seed.outras.length} dívidas` : "",
    seed.mensais.length + seed.semanais.length ? `${seed.mensais.length + seed.semanais.length} contas` : "", (state.bancos || []).length ? `${state.bancos.length} contas bancárias` : "",
  ].filter(Boolean);

  root.innerHTML = `
    ${cabecalho("Só o que falta", "Pergunto cada coisa uma vez. O resto cadastro aos poucos.")}
    ${jaTenho.length ? `<section class="card"><p class="hint">Já encontrei na carteira: ${esc(jaTenho.join(", "))}. Vou usar esses dados.</p></section>` : ""}
    <form id="comecar" novalidate>
      ${pedirPagamento ? `<section class="card">
        <div class="card-head"><h2>Quando eu recebo</h2></div>
        <div class="fields stack">
          ${select({ id: "cm-freq", label: "Recebo", options: FREQ, value: d.freq })}
          ${d.freq === "mensal" ? field({ id: "cm-diames", label: "Dia do mês", value: d.diaMes }) : select({ id: "cm-dia", label: "Dia", options: DIAS, value: d.dia })}
          ${field({ id: "cm-salario", label: "Salário fixo (se tiver)", value: d.salario, prefix: "$", placeholder: "0,00" })}
          ${field({ id: "cm-banco", label: "Meu banco principal", type: "text", value: d.banco, placeholder: "Ex.: Nubank, Itaú" })}
          ${select({ id: "cm-moeda", label: d.tipos.includes("moedas") ? "Moeda principal" : "Minha moeda", note: d.tipos.includes("moedas") ? "As outras moedas cadastro no Câmbio" : "", options: MOEDAS, value: d.moeda })}
        </div></section>` : ""}
      ${pedirBanco ? `<section class="card"><div class="fields stack">${field({ id: "cm-banco", label: "Meu banco principal", type: "text", value: d.banco, placeholder: "Ex.: Nubank, Itaú" })}</div></section>` : ""}
      ${comValor.map((t) => `<section class="card">
        <div class="card-head"><h2>${tipo(t).icone} ${esc(tipo(t).label)}</h2></div>
        <div class="fields stack">${camposObjetivo({ ...state, bancos: state.bancos || [] }, normalizar({ tipo: t, ...(d.objetivos[t] || {}) }), `ob-${t}`)}</div>
      </section>`).join("")}
      ${tipos.includes("dividas") ? `<section class="card"><div class="card-head"><h2>⛰️ Sair das dívidas</h2></div>
        <p class="hint">${seed.cartoes.length + seed.outras.length ? "Vou usar os cartões e dívidas que já estão aqui." : "Cartões, empréstimos e atrasados eu cadastro em Ajustes, no meu ritmo. As etapas aparecem conforme eu cadastro."}</p></section>` : ""}
      ${falta("contas") ? `<p class="hint onb-nota">Minhas contas (aluguel, internet…) cadastro depois em Ajustes → Minhas contas.</p>` : ""}
      ${tipos.includes("familia") ? `<p class="hint onb-nota">Para dividir contas com alguém, uso o Dividir e as Conexões.</p>` : ""}
      <details class="card"><summary class="card-head"><h2>Meu menu</h2><span class="total">${ligados.size} ligados</span></summary>
        <ul class="mods">${mods.map((m) => `<li class="mod"><label class="mod-sw">
          <input type="checkbox" data-cm-mod="${m.id}" ${ligados.has(m.id) ? "checked" : ""}><span class="sw" aria-hidden="true"></span>
          <span class="mod-txt"><b>${esc(m.pergunta)}</b><small>${esc(m.label)}</small></span></label></li>`).join("")}</ul>
      </details>
      <button class="btn primary block" type="submit">Começar</button>
      <button class="link pular" type="button" id="cm-voltar">voltar aos objetivos</button>
    </form>`;

  const f = root.querySelector("#comecar");
  const ler = () => {
    const q = (s) => f.querySelector(s);
    if (q("#cm-freq")) d.freq = q("#cm-freq").value;
    if (q("#cm-dia")) d.dia = q("#cm-dia").value;
    if (q("#cm-diames")) d.diaMes = Math.min(31, Math.max(1, Number(q("#cm-diames").value) || 1));
    if (q("#cm-salario")) d.salario = q("#cm-salario").value;
    if (q("#cm-banco")) d.banco = q("#cm-banco").value;
    if (q("#cm-moeda")) d.moeda = q("#cm-moeda").value;
    d.mods = [...f.querySelectorAll("[data-cm-mod]:checked")].map((c) => c.dataset.cmMod);
    comValor.forEach((t) => { d.objetivos[t] = lerCamposObjetivo(f, normalizar({ tipo: t, ...(d.objetivos[t] || {}) }), `ob-${t}`); });
  };
  f.querySelector("#cm-freq")?.addEventListener("change", () => { ler(); ctx.rerender(); });
  root.querySelector("#cm-voltar").onclick = () => { ler(); d.passo = 1; ctx.rerender(); };
  f.addEventListener("submit", (e) => { e.preventDefault(); ler(); montar(ctx, d, { pedirPagamento, pedirBanco }); });
}

// Aplica: ciclo, banco, salário e moeda (se pedidos), objetivos e módulos
function montar(ctx, d, { pedirPagamento, pedirBanco }) {
  const { state } = ctx;
  const hoje = new Date();
  let banco = (state.bancos || [])[0];
  if (pedirPagamento || pedirBanco) {
    banco = { id: "b" + Date.now().toString(36), banco: d.banco.trim() || "Minha conta", tipo: "checking" };
    state.bancos = [...(state.bancos || []), banco];
  }
  const extra = {};
  if (pedirPagamento) {
    const dia = Number(d.dia);
    const ciclo = d.freq === "mensal" ? { tipo: "mensal", diaMes: d.diaMes }
      : d.freq === "quinzenal" ? { tipo: "quinzenal", diaSemana: dia, ancora: toISO(addDays(hoje, (dia - hoje.getDay() + 7) % 7)) }
      : { tipo: "semanal", diaSemana: dia };
    salvarParte(state, "ciclo", ciclo);
    const salario = Number(String(d.salario).replace(",", ".")) || 0;
    const entradas = salario > 0 ? [{ id: "en-salario", nome: "Salário", tipo: "fixo", valor: salario, dia: d.freq === "mensal" ? "" : String(dia), conta: banco.id, divisao: [] }] : [];
    if (salario > 0) salvarParte(state, "metas", { piso: salario, meta: salario, turbo: salario });
    if (d.mods.includes("extra")) entradas.push({ id: "en-extra", nome: "Extra", tipo: "variavel", valor: 0, dia: d.freq === "mensal" ? "" : String(dia), conta: banco.id });
    Object.assign(extra, { moeda: d.moeda, entradas });
  }
  state.config = {
    ...state.config, ...extra,
    modulos: Object.fromEntries(MODULOS.map((m) => [m.id, d.mods.includes(m.id)])),
    atalhos: d.mods.includes("dividir") ? ["dividir"] : d.mods.includes("extra") ? ["extra"] : [],
    onboarding: true,
  };
  const inicio = toISO(hoje);
  salvarObjetivos(state, ordenados(d).map((t, i) => normalizar({
    ...(d.objetivos[t] || {}), id: novoIdObjetivo() + i, tipo: t, dono: ctx.usuario || "", inicio, prioridade: i + 1, principal: i === 0,
    conta: (d.objetivos[t] || {}).conta || "",
  })));
  ctx.comecar = null;
  ctx.persist();
  location.hash = "#home";
  ctx.rerender();
}

export { TIPOS };
