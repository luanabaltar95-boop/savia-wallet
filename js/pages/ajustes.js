// =========================================================
// PÁGINA AJUSTES — onde a carteira é montada, em 5 passos:
// 1 quando eu recebo · 2 minhas contas (fixas por categoria, da semana,
// em atraso) · 3 cartões · 4 dívidas · 5 financiamentos e parcelamentos.
// Nada muda até tocar em Salvar; aí a carteira inteira se recalcula.
// =========================================================
import { syncNote, sairDaConta } from "../core/sync.js";
import { MOEDAS, moedaBase, emOutraMoeda, converter, fmtMoeda } from "../core/cambio.js";
import { cambioHtml, bindCambio } from "./cambio.js";
import { meuMenuHtml, bindMeuMenu } from "./meuMenu.js";
import { bancosAjustesHtml, bindBancosAjustes } from "./bancosAjustes.js";
import { futurosHtml, bindFuturos } from "./futurosAjustes.js";
import { pagamentoHtml, bindPagamento, resumoPagamento } from "./pagamentoAjustes.js";
import { objetivoHtml, bindObjetivo, objetivoResumo } from "./objetivoAjustes.js";
import { ativo, blocoLiberado } from "../core/modulos.js";
import { backend } from "../core/backend.js";
import { dadosHtml, bindDados } from "./dados.js";
import { conexoesHtml, bindConexoes } from "./conexoes.js";
import { parte, salvarParte } from "../core/config.js";
import { FREQS, pagoDe } from "../core/plan.js";
import { money, shortDate } from "../core/format.js";
import { fromISO, toISO, addDays, pagamentoAte, nextPayday } from "../core/calendar.js";
import { field, select, segmented, esc, toast } from "../components/ui.js";

// Linha resumida: nome e detalhe à esquerda, valor à direita
const resumoRow = (nome, [valor, detalhe]) => `<summary>
  <span class="name">${esc(nome || "Sem nome")}${detalhe ? `<small>${esc(detalhe)}</small>` : ""}</span>
  <span class="value">${valor}</span></summary>`;

const blocoDe = (chave) => (["mensais", "semanais"].includes(chave) ? "contas" : (SECOES.find((x) => x.chave === chave) || {}).bloco || null);

// ---------- Contas: uma lista só, por frequência ----------
const FREQ_CONTAS = [{ id: "semanal", label: "Toda semana" }, ...FREQS];
const freqDe = (src, r) => (src === "semanais" ? "semanal" : r.freq || "mensal");
// Campos e em que frequência aparecem ("mes" = qualquer uma menos semanal)
const CAMPOS_CONTA = [
  { f: "nome", label: "Nome", type: "text" },
  { f: "moeda", label: "Moeda", type: "select", options: (st) => opcoesMoeda(st) },
  { f: "valor", label: "Valor" },
  { f: "freq", label: "Frequência", type: "select", options: () => FREQ_CONTAS },
  { f: "dia", label: "Dia do vencimento", so: "mes" },
  { f: "categoria", label: "Categoria", type: "select", options: (st) => opcoesCategoria(st) },
  { f: "desde", label: "Começa em", type: "date" },
  { f: "ate", label: "Termina em (fim do contrato, opcional)", type: "date" },
  { f: "divida", label: "Abate a dívida", type: "select", options: (st) => opcoesDivida(st), so: "mes" },
  { f: "investimento", label: "É investimento", type: "checkbox", so: "mes" },
  { f: "semParcial", label: "Só aceita o valor inteiro (sem pagamento parcial)", type: "checkbox", so: "mes" },
  { f: "compartilhado", label: "Dividido (aba Dividir)", type: "checkbox", so: "semanal" },
];
function linhaConta(src, r, i, state) {
  const freq = freqDe(src, r);
  const vis = (c) => !c.so || (c.so === "semanal" ? freq === "semanal" : freq !== "semanal");
  const campos = CAMPOS_CONTA.map((c) => {
    const id = `ct-${src}-${i}-${c.f}`;
    const attrs = `data-f="${c.f}"`;
    const so = c.so ? `data-so="${c.so}" ${vis(c) ? "" : "hidden"}` : "";
    if (c.type === "select") {
      const v = c.f === "freq" ? freq : c.f === "moeda" ? (r.moeda || moedaBase(state)) : String(r[c.f] ?? "");
      return `<label class="field" for="${id}" ${so}><span class="lbl">${esc(c.label)}</span>
        <select id="${id}" ${attrs}>${c.options(state).map((o) => `<option value="${esc(o.id)}" ${String(o.id) === v ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`;
    }
    if (c.type === "checkbox") {
      const on = c.f === "investimento" ? r.grupo === "investimento" : !!r[c.f];
      return `<label class="check-field" for="${id}" ${so}><input class="check" id="${id}" type="checkbox" ${on ? "checked" : ""} ${attrs}><span>${esc(c.label)}</span></label>`;
    }
    // Conta em outra moeda: o valor aparece na moeda dela
    const valor = c.f === "valor" && emOutraMoeda(state, r) ? r.valorMoeda : r[c.f];
    const note = c.f === "valor" && emOutraMoeda(state, r) && r.valor ? `≈ ${money(r.valor, true)} hoje` : "";
    return field({ id, label: c.label, type: c.type || "number", value: valor, attrs, note }).replace('<label class="field"', `<label class="field" ${so}`);
  }).join("");
  const cat = (opcoesCategoria(state).find((c) => c.id === r.categoria) || {}).label || "";
  const [valor0, det] = freq === "semanal" ? [money(r.valor, true), ""] : SECOES[0].resumo(r);
  const valor = emOutraMoeda(state, r) ? fmtMoeda(r.valorMoeda, r.moeda) : valor0;
  const fim = r.ate ? `termina ${shortDate(fromISO(r.ate))}` : "";
  const resumo = [valor, [det, cat, fim].filter(Boolean).join(" · ")];
  return `<details class="row-edit">
    ${resumoRow(r.nome, resumo)}
    <form class="conta-form" data-src="${src}" data-i="${i}" novalidate>
      <div class="fields stack">${campos}</div>
      ${r.ate ? `<button class="link" type="button" data-renovar="${src}|${i}">+ Novo contrato a partir de ${shortDate(addDays(fromISO(r.ate), 1))}</button>` : ""}
      <div class="save-bar">
        <button class="btn primary" type="submit">Salvar</button>
        <button class="btn" type="button" data-fechar-row>Cancelar</button>
        <span class="save-msg" aria-live="polite"></span>
        <button class="link danger-link" type="button" data-rmconta="${src}" data-i="${i}">remover</button>
      </div>
    </form>
  </details>`;
}
// Organizar: no grupo aberto, cada conta ganha ↑ ↓ (a ordem fica salva)
let organizando = null;
const SETA_CIMA = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>`;
const SETA_BAIXO = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>`;

function linhaOrdem(x, pos, n, state) {
  const v = emOutraMoeda(state, x.r) ? fmtMoeda(x.r.valorMoeda, x.r.moeda) : money(x.r.valor, true);
  return `<div class="ordem-row">
    <div class="ordem-info"><span class="name">${esc(x.r.nome || "Sem nome")}</span><span class="hint">${x.r.dia ? `dia ${x.r.dia} · ` : ""}${v}</span></div>
    <button class="btn icon" data-mover="${x.src}|${x.i}|-1" aria-label="Subir" ${pos === 0 ? "disabled" : ""}>${SETA_CIMA}</button>
    <button class="btn icon" data-mover="${x.src}|${x.i}|1" aria-label="Descer" ${pos === n - 1 ? "disabled" : ""}>${SETA_BAIXO}</button>
  </div>`;
}

function contasHtml(state) {
  const todas = [
    ...parte(state, "semanais").map((r, i) => ({ src: "semanais", r, i })),
    ...parte(state, "mensais").map((r, i) => ({ src: "mensais", r, i })),
  ];
  const grupos = FREQ_CONTAS.map((f) => {
    const its = todas.filter((x) => freqDe(x.src, x.r) === f.id);
    if (!its.length) return "";
    const total = its.reduce((t, x) => t + Number(x.r.valor || 0), 0);
    const org = organizando === f.id;
    return `<div class="cat-grupo">
      <div class="cat-head"><h4>${esc(f.label)}</h4><span>${money(total, true)}</span></div>
      ${its.length > 1 ? `<div class="ordem-acoes">
        <button class="link" data-organizar="${f.id}">${org ? "Pronto" : "Organizar"}</button>
        ${org && f.id !== "semanal" ? `<button class="link" data-por-dia="${f.id}">por dia do vencimento</button>` : ""}
      </div>` : ""}
      <div class="rows">${org ? its.map((x, k) => linhaOrdem(x, k, its.length, state)).join("") : its.map((x) => linhaConta(x.src, x.r, x.i, state)).join("")}</div>
    </div>`;
  }).join("");
  return `<section class="sub" data-sub="contas">
    
    ${grupos || `<p class="hint">Nenhuma conta ainda.</p>`}
    <button class="btn primary add-btn" id="add-conta">+ Adicionar</button>
  </section>`;
}

// Blocos de Ajustes, na ordem em que a carteira é montada
const BLOCOS = [
  { id: "ciclo", n: 1, titulo: "Meu pagamento" },
  { id: "contas", n: 2, titulo: "Minhas contas" },
  { id: "cartoes", n: 3, titulo: "Cartões" },
  { id: "dividas", n: 4, titulo: "Dívidas" },
  { id: "financiamentos", n: 5, titulo: "Parcelamentos" },
];

const novoId = () => "u-" + Date.now().toString(36);
const opcoesMoeda = (state) => MOEDAS.map((m) => ({ id: m.id, label: m.id === moedaBase(state) ? `${m.label} · principal` : m.label }));
const opcoesDivida = (state) => [{ id: "", label: "Nenhuma" }, ...parte(state, "outras").map((o) => ({ id: o.id, label: o.nome || "Sem nome" }))];
const opcoesCategoria = (state) => parte(state, "categorias");
const nomeFreq = (id) => (FREQS.find((f) => f.id === id) || FREQS[0]).label.toLowerCase();

// Listas editáveis: cada uma pertence a um bloco
const SECOES = [
  {
    chave: "mensais", bloco: null, titulo: "Contas fixas", agrupar: true,
    hint: "",
    cols: [
      { f: "nome", label: "Nome", type: "text" },
      { f: "valor", label: "Valor" },
      { f: "dia", label: "Dia do vencimento" },
      { f: "freq", label: "Frequência", type: "select", options: () => FREQS },
      { f: "categoria", label: "Categoria", type: "select", options: opcoesCategoria },
      { f: "desde", label: "A partir de", type: "date" },
      { f: "ate", label: "Até (opcional)", type: "date" },
      { f: "divida", label: "Abate a dívida", type: "select", options: opcoesDivida },
      { f: "investimento", label: "É investimento", type: "checkbox" },
    ],
    novo: (cat) => ({ id: novoId(), nome: "", valor: 0, dia: 1, freq: "mensal", categoria: cat || "outras", grupo: "contas", diaConfirmar: true }),
    resumo: (r) => [money(r.valor, true), r.diaConfirmar ? "dia a confirmar" : `dia ${r.dia}`],
  },
  {
    chave: "semanais", bloco: null, titulo: "Custos da semana",
    hint: "",
    cols: [
      { f: "nome", label: "Nome", type: "text" },
      { f: "valor", label: "Por semana" },
      { f: "compartilhado", label: "Dividido (aba Dividir)", type: "checkbox" },
    ],
    novo: () => ({ id: novoId(), nome: "", valor: 0, grupo: "vida" }),
    resumo: (r) => [money(r.valor, true), "por semana"],
  },
  // Lista única: semanais + mensais, organizada por frequência (renderContas)
  { chave: "contas", bloco: "contas", unificada: true, titulo: "Contas" },
  {
    chave: "pontuais", bloco: "contas", titulo: "Em atraso e contas únicas",
    hint: "",
    cols: [
      { f: "nome", label: "Nome", type: "text" },
      { f: "valor", label: "Valor" },
      { f: "semana", label: "Pagar no pagamento de", type: "date" },
      { f: "atrasado", label: "Está atrasada", type: "checkbox" },
      { f: "semParcial", label: "Só aceita o valor inteiro", type: "checkbox" },
      { f: "divida", label: "Abate a dívida", type: "select", options: opcoesDivida },
    ],
    novo: () => ({ id: novoId(), nome: "", valor: 0, grupo: "contas", atrasado: true, acao: "pagar", semana: toISO(nextPayday()) }),
    resumo: (r) => [money(r.valor, true), r.atrasado ? "atrasada" : ""],
  },
  {
    chave: "cartoes", bloco: "cartoes", titulo: "Meus cartões",
    hint: "",
    cols: [
      { f: "nome", label: "Nome", type: "text" },
      { f: "saldo", label: "Saldo da fatura" },
      { f: "minimo", label: "Pagamento mínimo" },
      { f: "apr", label: "Juros ao ano (%)" },
      { f: "limite", label: "Limite" },
      { f: "dia", label: "Dia do vencimento" },
    ],
    novo: () => ({ id: novoId(), nome: "", saldo: 0, minimo: 0, apr: 0, limite: 0, dia: 1 }),
    resumo: (r) => [money(r.saldo), `vence dia ${r.dia} · mínimo ${money(r.minimo)}`],
  },
  {
    chave: "outras", bloco: "dividas", titulo: "Empréstimos e outras dívidas",
    hint: "",
    cols: [
      { f: "nome", label: "Nome", type: "text" },
      { f: "saldo", label: "Saldo" },
      { f: "parcela", label: "Parcela por mês" },
      { f: "ate", label: "Previsão de quitar (opcional)", type: "date" },
      { f: "nota", label: "Observação", type: "text" },
    ],
    novo: () => ({ id: novoId(), nome: "", saldo: 0, parcela: 0, nota: "" }),
    resumo: (r) => [money(r.saldo), r.parcela ? `${money(r.parcela)} por mês` : ""],
  },
  {
    chave: "parcelas", bloco: "financiamentos", titulo: "Financiamentos e parcelamentos",
    hint: "",
    cols: [
      { f: "nome", label: "Nome", type: "text" },
      { f: "valor", label: "Parcela" },
      { f: "dia", label: "Dia do vencimento" },
      { f: "desde", label: "Primeira parcela", type: "date" },
      { f: "ate", label: "Última parcela", type: "date" },
      { f: "total", label: "Total financiado (opcional)" },
      { f: "divida", label: "Abate a dívida", type: "select", options: opcoesDivida },
    ],
    novo: () => ({ id: novoId(), nome: "", valor: 0, dia: 1, grupo: "minimos", ate: "" }),
    resumo: (r) => [money(r.valor, true), `dia ${r.dia}${r.ate ? ` · até ${shortDate(fromISO(r.ate))}` : ""}`],
  },
];

// Qualquer data escolhida vira o dia de pagamento cuja lista inclui a data
function sextaDe(iso) {
  if (!iso) return "";
  return toISO(pagamentoAte(fromISO(iso)));
}

function periodo(r) {
  if (r.desde) return `a partir de ${shortDate(fromISO(r.desde))}`;
  if (r.ate) return `até ${shortDate(fromISO(r.ate))}`;
  return "";
}

function linha(sec, r, i, state) {
  const campos = sec.cols.map((c) => {
    const id = `${sec.chave}-${i}-${c.f}`;
    const attrs = `data-k="${sec.chave}" data-i="${i}" data-f="${c.f}"`;
    if (c.type === "select") {
      const v = String(r[c.f] ?? (c.f === "freq" ? "mensal" : ""));
      return `<label class="field" for="${id}"><span class="lbl">${esc(c.label)}</span>
        <select id="${id}" ${attrs}>${c.options(state).map((o) => `<option value="${esc(o.id)}" ${String(o.id) === v ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`;
    }
    if (c.type === "checkbox") {
      return `<label class="check-field" for="${id}"><input class="check" id="${id}" type="checkbox" ${(c.f === "investimento" ? r.grupo === "investimento" : r[c.f]) ? "checked" : ""} ${attrs}><span>${esc(c.label)}</span></label>`;
    }
    return field({ id, label: c.label, type: c.type || "number", value: r[c.f], attrs, note: "" });
  }).join("");
  const p = periodo(r);
  return `<details class="row-edit">
    ${resumoRow(r.nome, sec.resumo(r))}
    ${p ? `<p class="hint">Vale ${p}.</p>` : ""}
    <form class="row-form" data-form="${sec.chave}" data-i="${i}" novalidate>
      <div class="fields stack">${campos}</div>
      <div class="save-bar">
        <button class="btn primary" type="submit">Salvar</button>
        <button class="btn" type="button" data-fechar-row>Cancelar</button>
        <span class="save-msg" aria-live="polite"></span>
        ${sec.fixo ? "" : `<button class="link danger-link" type="button" data-rm="${sec.chave}" data-i="${i}">remover</button>`}
      </div>
    </form>
  </details>`;
}

export function renderAjustes(root, ctx) {
  const { state, persist } = ctx;
  const ciclo = parte(state, "ciclo");

  // Uma lista (subseção) dentro de um bloco
  const lista = (sec, _, todas) => {
    if (sec.unificada) return contasHtml(state);
    const unica = todas.length === 1; // título do bloco já diz o que é
    const rows = parte(state, sec.chave);
    let corpo;
    if (sec.agrupar) {
      const cats = parte(state, "categorias");
      const ids = new Set(cats.map((c) => c.id));
      const grupos = [...cats, ...(rows.some((r) => !ids.has(r.categoria || "outras")) && !ids.has("outras") ? [{ id: "outras", label: "Outras" }] : [])];
      corpo = grupos.filter((g) => rows.some((r) => (ids.has(r.categoria || "outras") ? (r.categoria || "outras") : "outras") === g.id)).map((g) => {
        const its = rows.map((r, i) => [r, i]).filter(([r]) => (ids.has(r.categoria || "outras") ? (r.categoria || "outras") : "outras") === g.id);
        const total = its.reduce((t, [r]) => t + Number(r.valor || 0), 0);
        return `<div class="cat-grupo">
          <div class="cat-head"><h4>${esc(g.label)}</h4><span>${its.length ? money(total, true) : ""}</span></div>
          <div class="rows">${its.map(([r, i]) => linha(sec, r, i, state)).join("")}</div>
        </div>`;
      }).join("") + `<div class="inline-btns"><button class="btn primary add-btn" data-add="${sec.chave}">+ Adicionar</button>` + (ctx.novaCat
        ? `<form class="inline nova-cat" id="form-cat" novalidate>${field({ id: "cat-nome", label: "Nova categoria", type: "text", value: "" })}<button class="btn primary" type="submit">Criar</button></form>`
        : `<button class="btn primary add-btn" id="add-cat">+ Adicionar</button>`) + `</div>
        <p class="hint">Categorias: ${cats.map((c) => esc(c.label)).join(" · ")}</p>`;
    } else {
      corpo = `<div class="rows">${rows.map((r, i) => linha(sec, r, i, state)).join("")}</div>
        <button class="btn primary add-btn" data-add="${sec.chave}">+ Adicionar</button>`;
    }
    return `<section class="sub" data-sub="${sec.chave}">
      ${unica ? "" : `<div class="sub-head"><h3>${sec.titulo}</h3><span class="total">${rows.length}</span></div>`}
      ${sec.hint ? `<p class="hint">${sec.hint}</p>` : ""}
      ${corpo}
    </section>`;
  };

  const categoriasHtml = () => {
    const cats = parte(state, "categorias");
    return `<div class="sub cats">
      <ul class="chips-list">${cats.map((c) => `<li>${esc(c.label)}</li>`).join("")}</ul>
      ${ctx.novaCat
        ? `<form class="nova-cat" id="form-cat" novalidate>${field({ id: "cat-nome", label: "Nova categoria", type: "text", value: "" })}<button class="btn primary" type="submit">Criar</button></form>`
        : `<button class="btn primary add-btn" id="add-cat">+ Adicionar</button>`}
    </div>`;
  };

  // Atrasadas: o que falta pagar em cima; as já pagas ficam guardadas embaixo
  const atrasadasHtml = () => {
    const sec = SECOES.find((x) => x.chave === "pontuais");
    const rows = parte(state, "pontuais");
    const st = rows.map((r, i) => {
      const p = pagoDe(state, r.id);
      const falta = Math.max(0, Number(r.valor || 0) - p.total);
      return { r, i, p, falta, paga: p.quitado || falta <= 0.005 };
    });
    const abertas = st.filter((x) => !x.paga), pagas = st.filter((x) => x.paga);
    const linhaAberta = (x) => `<div class="atraso-linha">${linha(sec, x.r, x.i, state)}
      <div class="atraso-st">${x.p.total ? `<span class="chip">paguei ${money(x.p.total, true)} · faltam ${money(x.falta, true)}</span>` : ""}
        <button class="link" type="button" data-ja-paguei="${x.i}">Já paguei</button></div></div>`;
    return `<section class="sub" data-sub="pontuais">
      ${abertas.length ? `<div class="rows">${abertas.map(linhaAberta).join("")}</div>` : `<p class="hint">Nada em atraso. 🎉</p>`}
      <button class="btn primary add-btn" data-add="pontuais">+ Adicionar</button>
      ${pagas.length ? `<details class="sub pagas"><summary class="sub-head"><h3>Pagas</h3><span class="total">${pagas.length}</span></summary>
        <ul class="resumo-lista">${pagas.map((x) => `<li><div class="rs-nome"><span>${esc(x.r.nome)}</span><small class="hint">paga${x.p.data ? ` em ${shortDate(fromISO(x.p.data))}` : ""}</small></div><b>${money(x.p.total || x.r.valor, true)}</b></li>`).join("")}</ul></details>` : ""}
    </section>`;
  };

  // Minhas contas em abas: uma lista por vez (página curta)
  const contasAbas = () => {
    const aba = ctx.contasAba || "fixas";
    const abas = [
      { id: "fixas", label: "Contas", n: parte(state, "mensais").length + parte(state, "semanais").length },
      { id: "atraso", label: "Atrasadas", n: parte(state, "pontuais").length },
      { id: "futuras", label: "Futuras", n: parte(state, "pedidos").length },
      { id: "categorias", label: "Categorias", n: parte(state, "categorias").length },
    ];
    const corpo = aba === "atraso" ? atrasadasHtml()
      : aba === "futuras" ? futurosHtml(ctx)
      : aba === "categorias" ? categoriasHtml()
      : contasHtml(state);
    return `<div class="abas" role="tablist">${abas.map((a) => `<button type="button" role="tab" class="aba ${a.id === aba ? "on" : ""}" aria-selected="${a.id === aba}" data-aba="${a.id}">${a.label}<span>${a.n}</span></button>`).join("")}</div>
      <div class="aba-corpo">${corpo}</div>`;
  };

  const resumoBloco = (b) => {
    if (b.id === "ciclo") return esc(resumoPagamento(ciclo));
    const n = SECOES.filter((x) => x.bloco === b.id).reduce((t, x) => t + (x.unificada ? parte(state, "mensais").length + parte(state, "semanais").length : parte(state, x.chave).length), 0);
    return String(n);
  };


  // Blocos de módulos desligados não aparecem (numeração segue a ordem)
  const blocos = BLOCOS.filter((b) => blocoLiberado(state, b.id)).map((b, i) => ({ ...b, n: i === 0 ? 1 : i + 3 })).map((b) => `
    <details class="card sec" data-sec="${b.id}" ${ctx.openSec === b.id ? "open" : ""}>
      <summary class="sec-head"><h2><span class="passo">${b.n}</span>${b.titulo}</h2><span class="total">${resumoBloco(b)}</span></summary>
      <div class="sec-body">
        ${b.id === "ciclo" ? pagamentoHtml(ctx) : b.id === "contas" ? contasAbas() : SECOES.filter((x) => x.bloco === b.id).map(lista).join("")}
      </div>
    </details>${b.id === "ciclo" ? `<details class="card sec" data-sec="objetivo" ${ctx.openSec === "objetivo" ? "open" : ""}>
        <summary class="sec-head"><h2><span class="passo">2</span>Meu objetivo</h2><span class="total">${objetivoResumo(ctx)}</span></summary>
        <div class="sec-body">${objetivoHtml(ctx)}</div></details>` + bancosAjustesHtml(ctx, 3) : ""}`).join("");
  const grupo = (titulo, html) => (html.trim() ? `<section class="grupo"><h3 class="grupo-t">${titulo}</h3><div class="grupo-card">${html}</div></section>` : "");


  root.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">Ajustes</p>
      <h1>Meus números</h1>
      
    </header>

    ${grupo("Meu dinheiro", blocos)}

    ${grupo("Meu app", `${meuMenuHtml(ctx)}${ativo(state, "moedas") ? cambioHtml(ctx) : ""}${ativo(state, "dividir") ? conexoesHtml(ctx) : ""}`)}

    ${grupo("Minha conta", `<details class="card sec" data-sec="perfil" ${ctx.openSec === "perfil" ? "open" : ""}>
      <summary class="sec-head"><h2>Meu perfil</h2><span class="total">@${esc(ctx.usuario || "")}</span></summary>
      <form class="sec-body" id="form-perfil" novalidate autocomplete="off">
        <div class="fields stack">
          ${field({ id: "pf-nova", name: "nova", label: "Nova senha", type: "password", attrs: 'autocomplete="new-password"' })}
          ${field({ id: "pf-nova2", name: "nova2", label: "Repetir nova senha", type: "password", attrs: 'autocomplete="new-password"' })}
        </div>
        <p class="preview" id="pf-msg" aria-live="polite"></p>
        <button class="btn primary block" type="submit">Salvar</button>
      </form>
    </details>

    ${dadosHtml(ctx)}`)}

    <button class="btn danger block" id="sair">Sair</button>

    ${syncNote(ctx)}
  `;

  const salvar = () => { persist(); ctx.rerender(); };

  // Lembra qual categoria está aberta (uma por vez)
  root.querySelectorAll("details.sec").forEach((d) => {
    d.addEventListener("toggle", () => {
      if (d.open) {
        ctx.openSec = d.dataset.sec;
        root.querySelectorAll("details.sec").forEach((o) => { if (o !== d) o.open = false; });
      } else if (ctx.openSec === d.dataset.sec) ctx.openSec = null;
    });
  });

  // Edição: nada muda até tocar em Salvar. Ao salvar, a carteira inteira recalcula.
  const marcarAlterado = (form) => {
    const msg = form.querySelector(".save-msg");
    msg.textContent = "alterações não salvas";
    msg.className = "save-msg warn";
  };

  root.querySelectorAll("form.row-form, form.conta-form").forEach((form) => {
    form.addEventListener("input", () => marcarAlterado(form));
    form.addEventListener("change", () => marcarAlterado(form));
  });

  root.querySelectorAll("form.row-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const k = form.dataset.form, i = Number(form.dataset.i);
      const rows = JSON.parse(JSON.stringify(parte(state, k)));
      const r = rows[i];
      form.querySelectorAll("[data-f]").forEach((el) => {
        const f = el.dataset.f;
        const antes = r[f];
        if (f === "investimento") { r.grupo = el.checked ? "investimento" : "contas"; return; }
        if (el.type === "checkbox") r[f] = el.checked;
        else if (f === "semana") r[f] = el.value ? sextaDe(el.value) : r[f];
        else if (el.type === "number") r[f] = el.value === "" ? 0 : Number(el.value);
        else if (el.tagName === "SELECT" && f === "divida") { if (el.value) r.divida = el.value; else delete r.divida; }
        else if (el.type === "date" && !el.value && ["desde", "ate"].includes(f)) delete r[f];
        else r[f] = el.value;
        if (r[f] === antes) return;
        if ((k === "cartoes" || k === "outras") && f === "saldo") r.saldoEm = Date.now();
        if (k === "cartoes" && f === "minimo") r.confirmado = true;
        if (["valor", "minimo", "dia"].includes(f)) r.estimativa = false; // você confirmou o valor
        if (f === "dia") r.diaConfirmar = false;
      });
      salvarParte(state, k, rows);
      ctx.openRow = null; // fecha o item ao salvar
      ctx.openSec = blocoDe(k);
      ctx.salvoEm = `${k}|${i}`;
      salvar();
    });
  });


  root.querySelectorAll("[data-add]").forEach((b) => {
    b.onclick = () => {
      const sec = SECOES.find((s) => s.chave === b.dataset.add);
      const rows = [...parte(state, sec.chave), sec.novo(b.dataset.cat)];
      salvarParte(state, sec.chave, rows);
      ctx.openRow = `${sec.chave}|${rows.length - 1}`;
      ctx.openSec = sec.bloco;
      salvar();
    };
  });
  root.querySelectorAll("[data-rm]").forEach((b) => {
    b.onclick = () => {
      const rows = parte(state, b.dataset.rm).filter((_, i) => i !== Number(b.dataset.i));
      salvarParte(state, b.dataset.rm, rows);
      ctx.openSec = blocoDe(b.dataset.rm);
      salvar();
    };
  });

  // Contas (lista única): mostrar só os campos da frequência escolhida
  root.querySelectorAll("form.conta-form").forEach((form) => {
    const sel = form.querySelector('[data-f="freq"]');
    sel.addEventListener("change", () => {
      const sem = sel.value === "semanal";
      form.querySelectorAll("label[data-so]").forEach((lbl) => { lbl.hidden = lbl.dataset.so === "semanal" ? !sem : sem; });
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const src = form.dataset.src, i = Number(form.dataset.i);
      const antes = parte(state, src)[i];
      const v = (f) => form.querySelector(`[data-f="${f}"]`);
      const freq = v("freq").value;
      const moeda = v("moeda").value;
      const digitado = Number(v("valor").value) || 0;
      const base = { ...antes, nome: v("nome").value, valor: digitado, categoria: v("categoria").value };
      if (moeda !== moedaBase(state)) {
        // Guardo o valor na moeda; o valor convertido fica como referência
        base.moeda = moeda; base.valorMoeda = digitado;
        base.valor = converter(state, digitado, moeda) ?? antes.valor ?? 0;
      } else { delete base.moeda; delete base.valorMoeda; }
      if (digitado !== (antes.valorMoeda ?? antes.valor)) base.estimativa = false;
      let destino, novo;
      if (freq === "semanal") {
        destino = "semanais";
        novo = { ...base, grupo: "vida", compartilhado: v("compartilhado").checked };
        ["freq", "dia", "divida", "diaConfirmar"].forEach((k) => delete novo[k]);
        ["desde", "ate"].forEach((f) => { if (v(f).value) novo[f] = v(f).value; else delete novo[f]; });
        if (antes.estimativa && base.valor === antes.valor) novo.estimativa = true;
      } else {
        destino = "mensais";
        novo = { ...base, freq, dia: Number(v("dia").value) || 1, grupo: v("investimento").checked ? "investimento" : "contas" };
        delete novo.compartilhado;
        if (Number(v("dia").value)) novo.diaConfirmar = false;
        ["desde", "ate"].forEach((f) => { if (v(f).value) novo[f] = v(f).value; else delete novo[f]; });
        if (v("divida").value) novo.divida = v("divida").value; else delete novo.divida;
        if (v("semParcial").checked) novo.semParcial = true; else delete novo.semParcial;
      }
      if (destino === src) {
        salvarParte(state, src, parte(state, src).map((x, k) => (k === i ? novo : x)));
      } else {
        // mudou de semanal para mensal (ou o contrário): troca de lista
        salvarParte(state, src, parte(state, src).filter((_, k) => k !== i));
        salvarParte(state, destino, [...parte(state, destino), novo]);
      }
      ctx.openRow = null;
      ctx.openSec = "contas";
      ctx.salvoEm = "contas";
      salvar();
    });
  });
  root.querySelectorAll("[data-rmconta]").forEach((b) => {
    b.onclick = () => {
      salvarParte(state, b.dataset.rmconta, parte(state, b.dataset.rmconta).filter((_, i) => i !== Number(b.dataset.i)));
      ctx.openSec = "contas";
      salvar();
    };
  });
  // Atrasada que já paguei (fora do app ou o resto): marca quitada e o plano refaz
  root.querySelectorAll("[data-ja-paguei]").forEach((b) => (b.onclick = () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "Confirmar: já paguei"; return; }
    const r = parte(state, "pontuais")[Number(b.dataset.jaPaguei)];
    const p = pagoDe(state, r.id);
    const sem = r.semana || toISO(nextPayday());
    const atual = (state.pagos[sem] || {})[r.id];
    const valor = atual && typeof atual === "object" ? Number(atual.valor) || 0 : Math.max(0, Number(r.valor || 0) - p.total);
    state.pagos[sem] = { ...(state.pagos[sem] || {}), [r.id]: { ...(typeof atual === "object" ? atual : {}), valor, juros: 0, data: toISO(new Date()), quitado: true, nome: r.nome, ts: atual && atual.ts ? atual.ts : 1 } }; // pago fora do app: não mexe no saldo
    ctx.openSec = "contas"; ctx.contasAba = "atraso";
    persist(); ctx.rerender(); toast("Paga ✓ · plano atualizado");
  }));

  // Renovar: a conta termina numa data; o novo contrato começa no dia seguinte
  root.querySelectorAll("[data-renovar]").forEach((b) => (b.onclick = () => {
    const [src, i] = b.dataset.renovar.split("|");
    const lista = parte(state, src);
    const velho = lista[Number(i)];
    const novo = { ...velho, id: novoId(), nome: `${velho.nome} (novo)`, desde: toISO(addDays(fromISO(velho.ate), 1)) };
    delete novo.ate;
    salvarParte(state, src, [...lista, novo]);
    ctx.openSec = "contas"; ctx.contasAba = "fixas"; ctx.openRow = `${src}|${lista.length}`;
    persist(); ctx.rerender(); toast("Novo contrato criado · ajuste o valor");
  }));

  // Organizar a ordem das contas
  root.querySelectorAll("[data-organizar]").forEach((b) => (b.onclick = () => {
    organizando = organizando === b.dataset.organizar ? null : b.dataset.organizar;
    ctx.openSec = "contas"; ctx.rerender();
  }));
  root.querySelectorAll("[data-mover]").forEach((b) => (b.onclick = () => {
    const [src, i, dir] = b.dataset.mover.split("|");
    const lista = parte(state, src).slice();
    const freq = freqDe(src, lista[i]);
    // vizinho do mesmo grupo (mesma frequência)
    let j = Number(i) + Number(dir);
    while (j >= 0 && j < lista.length && freqDe(src, lista[j]) !== freq) j += Number(dir);
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    salvarParte(state, src, lista);
    ctx.openSec = "contas"; persist(); ctx.rerender();
  }));
  root.querySelectorAll("[data-por-dia]").forEach((b) => (b.onclick = () => {
    const lista = parte(state, "mensais");
    const grupo = lista.filter((r) => freqDe("mensais", r) === b.dataset.porDia).sort((a, c) => (Number(a.dia) || 99) - (Number(c.dia) || 99));
    let k = 0;
    salvarParte(state, "mensais", lista.map((r) => (freqDe("mensais", r) === b.dataset.porDia ? grupo[k++] : r)));
    ctx.openSec = "contas"; persist(); ctx.rerender();
  }));

  const addConta = root.querySelector("#add-conta");
  if (addConta) addConta.onclick = () => {
    const rows = [...parte(state, "mensais"), { id: novoId(), nome: "", valor: 0, dia: 1, freq: "mensal", categoria: "outras", grupo: "contas", diaConfirmar: true }];
    salvarParte(state, "mensais", rows);
    ctx.abrirConta = `mensais|${rows.length - 1}`;
    ctx.openSec = "contas";
    salvar();
  };
  if (ctx.abrirConta) {
    const [src, i] = ctx.abrirConta.split("|");
    const f = root.querySelector(`form.conta-form[data-src="${src}"][data-i="${i}"]`);
    if (f) { f.closest("details").open = true; f.scrollIntoView({ block: "center" }); f.querySelector('[data-f="nome"]').focus(); }
    ctx.abrirConta = null;
  }

  // Meu perfil: trocar @ e senha (pede a senha atual)
  const fp = root.querySelector("#form-perfil");
  fp.addEventListener("submit", async (e) => {
    e.preventDefault();
    const aviso = (t) => { fp.querySelector("#pf-msg").innerHTML = `<span class="status warn">${t}</span>`; };
    if (fp.nova.value.length < 8) return aviso("Nova senha com pelo menos 8 caracteres.");
    if (fp.nova.value !== fp.nova2.value) return aviso("As senhas não são iguais.");
    try { await backend.trocarSenha(fp.nova.value); } catch (err) { return aviso(err.message); }
    ctx.openSec = null;
    ctx.rerender();
    toast("Salvo ✓");
  });

  bindDados(root, ctx);
  bindConexoes(root, ctx);
  bindCambio(root, ctx);
  bindMeuMenu(root, ctx);
  bindBancosAjustes(root, ctx);
  bindFuturos(root, ctx);
  bindPagamento(root, ctx);
  bindObjetivo(root, ctx);
  root.querySelectorAll("[data-aba]").forEach((b) => (b.onclick = () => { ctx.contasAba = b.dataset.aba; ctx.openSec = "contas"; ctx.openRow = null; ctx.rerender(); }));

  root.querySelector("#sair").onclick = async () => { await sairDaConta(ctx); location.hash = "home"; ctx.rerender(); };

  // + Nova categoria (contas fixas)
  const addCat = root.querySelector("#add-cat");
  if (addCat) addCat.onclick = () => { ctx.novaCat = true; ctx.openSec = "contas"; ctx.rerender(); root.querySelector("#cat-nome")?.focus(); };
  const formCat = root.querySelector("#form-cat");
  if (formCat) formCat.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = root.querySelector("#cat-nome").value.trim();
    ctx.novaCat = false;
    if (nome) {
      const id = nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || novoId();
      const cats = parte(state, "categorias");
      if (!cats.some((c) => c.id === id)) salvarParte(state, "categorias", [...cats, { id, label: nome }]);
    }
    ctx.openSec = "contas";
    salvar();
  });

  // Editando um item: só ele fica aberto; Cancelar fecha sem salvar
  root.querySelectorAll("details.row-edit").forEach((d) => d.addEventListener("toggle", () => {
    if (!d.open) return;
    root.querySelectorAll("details.row-edit[open]").forEach((o) => { if (o !== d) o.open = false; });
  }));
  root.querySelectorAll("[data-fechar-row]").forEach((b) => (b.onclick = () => {
    const d = b.closest("details.row-edit");
    const f = d.querySelector("form");
    if (f) f.reset();
    d.open = false;
    ctx.openRow = null;
  }));

  // Mantém aberto o item que estava sendo editado
  if (ctx.openRow) {
    const [k, i] = ctx.openRow.split("|");
    const form = root.querySelector(`form[data-form="${k}"][data-i="${i}"]`);
    if (form) form.closest("details").open = true;
  }
  // Confirmação depois de salvar: o item fecha e o título mostra "salvo ✓"
  if (ctx.salvoEm) {
    let summary;
    if (["metas", "ciclo", "contas"].includes(ctx.salvoEm)) summary = root.querySelector(`details[data-sec="${ctx.salvoEm}"] > summary`);
    else {
      const [k, i] = ctx.salvoEm.split("|");
      const form = root.querySelector(`form[data-form="${k}"][data-i="${i}"]`);
      summary = form && form.closest("details").querySelector("summary");
    }
    if (summary) summary.scrollIntoView({ block: "nearest" });
    toast("Salvo ✓");
    ctx.salvoEm = null;
  }

}
