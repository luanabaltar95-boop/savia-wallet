// =========================================================
// PÁGINA AJUSTES — onde a carteira é montada, em 5 passos:
// 1 quando eu recebo · 2 minhas contas (fixas por categoria, da semana,
// em atraso) · 3 cartões · 4 dívidas · 5 financiamentos e parcelamentos.
// Nada muda até tocar em Salvar; aí a carteira inteira se recalcula.
// =========================================================
import { syncNote, sairDaConta } from "../core/sync.js";
import { MOEDAS, moedaBase, emOutraMoeda, converter, fmtMoeda } from "../core/cambio.js";
import { cambioHtml, bindCambio } from "./cambio.js";
import { entradasAjustesHtml, bindEntradasAjustes } from "./entradasAjustes.js";
import { meuMenuHtml, bindMeuMenu } from "./meuMenu.js";
import { ativo, blocoLiberado } from "../core/modulos.js";
import { backend } from "../core/backend.js";
import { dadosHtml, bindDados } from "./dados.js";
import { conexoesHtml, bindConexoes } from "./conexoes.js";
import { parte, salvarParte } from "../core/config.js";
import { FREQS } from "../core/plan.js";
import { money, shortDate } from "../core/format.js";
import { fromISO, toISO, addDays, pagamentoAte, TIPOS_CICLO, DIAS_SEMANA, getCiclo, setCiclo, nextPayday, pagamentoSeguinte } from "../core/calendar.js";
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
  { f: "desde", label: "A partir de", type: "date", so: "mes" },
  { f: "ate", label: "Até (opcional)", type: "date", so: "mes" },
  { f: "divida", label: "Abate a dívida", type: "select", options: (st) => opcoesDivida(st), so: "mes" },
  { f: "investimento", label: "É investimento", type: "checkbox", so: "mes" },
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
  const resumo = [valor, [det, cat].filter(Boolean).join(" · ")];
  return `<details class="row-edit">
    ${resumoRow(r.nome, resumo)}
    <form class="conta-form" data-src="${src}" data-i="${i}" novalidate>
      <div class="fields stack">${campos}</div>
      <div class="save-bar">
        <button class="btn primary" type="submit">Salvar</button>
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
  { id: "ciclo", n: 1, titulo: "Quando eu recebo" },
  { id: "contas", n: 2, titulo: "Minhas contas" },
  { id: "cartoes", n: 3, titulo: "Cartões" },
  { id: "dividas", n: 4, titulo: "Dívidas" },
  { id: "financiamentos", n: 5, titulo: "Financiamentos e parcelamentos" },
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

// Seção "Quando você recebe" (ciclo de pagamento)
const DIAS = DIAS_SEMANA.map((l, i) => ({ id: String(i), label: l }));
function resumoCiclo(c) {
  if (c.tipo === "quinzenal") return "quinzenal";
  if (c.tipo === "mensal") return `todo dia ${c.diaMes || 1}`;
  if (c.tipo === "manual") return `${(c.datas || []).length} datas`;
  return `toda ${DIAS_SEMANA[Number(c.diaSemana ?? 5)].toLowerCase()}`;
}
function cicloBody(c) {
  const t = c.tipo;
  const campos = t === "semanal" ? select({ id: "c-dia", label: "Dia da semana", options: DIAS, value: String(c.diaSemana ?? 5) })
    : t === "quinzenal" ? field({ id: "c-ancora", label: "Data de um pagamento", type: "date", value: c.ancora || toISO(nextPayday()), note: "" })
    : t === "mensal" ? field({ id: "c-diames", label: "Dia do mês", value: c.diaMes || 1, note: "" })
    : `${field({ id: "c-nova", label: "Adicionar data", type: "date", value: "" })}
       <ul class="cat-list datas">${[...(c.datas || [])].sort().map((d) => `<li><span>${shortDate(fromISO(d))}</span><button class="link" type="button" data-rmdata="${d}">remover</button></li>`).join("") || `<li class="hint">Nenhuma data ainda.</li>`}</ul>`;
  // prévia com o rascunho (sem mudar o ciclo do app)
  const atual = getCiclo();
  setCiclo(c);
  let p = nextPayday();
  const prox = Array.from({ length: 4 }, () => { const d = p; p = pagamentoSeguinte(p); return shortDate(d); });
  setCiclo(atual);
  return `${segmented({ name: "c-tipo", label: "Recebo", options: TIPOS_CICLO, value: t })}
    <div class="fields stack">${campos}</div>
    <p class="hint">Próximos: ${prox.join(" · ")}</p>`;
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
        <span class="save-msg" aria-live="polite"></span>
        ${sec.fixo ? "" : `<button class="link danger-link" type="button" data-rm="${sec.chave}" data-i="${i}">remover</button>`}
      </div>
    </form>
  </details>`;
}

export function renderAjustes(root, ctx) {
  const { state, persist } = ctx;
  const metas = parte(state, "metas");
  const colchao = parte(state, "colchaoSemanal");
  const ciclo = parte(state, "ciclo");

  // Uma lista (subseção) dentro de um bloco
  const lista = (sec, _, todas) => {
    if (sec.unificada) return contasHtml(state) + categoriasHtml();
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
    return `<details class="sub cats" ${ctx.novaCat ? "open" : ""}>
      <summary class="sub-head"><h3>Categorias</h3><span class="total">${cats.length}</span></summary>
      <ul class="chips-list">${cats.map((c) => `<li>${esc(c.label)}</li>`).join("")}</ul>
      ${ctx.novaCat
        ? `<form class="nova-cat" id="form-cat" novalidate>${field({ id: "cat-nome", label: "Nova categoria", type: "text", value: "" })}<button class="btn primary" type="submit">Criar</button></form>`
        : `<button class="btn primary add-btn" id="add-cat">+ Adicionar</button>`}
    </details>`;
  };

  const resumoBloco = (b) => {
    if (b.id === "ciclo") return esc(resumoCiclo(ciclo));
    const n = SECOES.filter((x) => x.bloco === b.id).reduce((t, x) => t + (x.unificada ? parte(state, "mensais").length + parte(state, "semanais").length : parte(state, x.chave).length), 0);
    return String(n);
  };

  const cicloHtml = `
    <form id="form-ciclo" novalidate>
      ${cicloBody(ctx.cicloDraft || ciclo)}
      <div class="fields metas">
        ${field({ id: "m-piso", label: "Piso", value: (ctx.metasDraft || metas).piso, attrs: 'data-meta="piso"', prefix: "$" })}
        ${field({ id: "m-meta", label: "Meta", value: (ctx.metasDraft || metas).meta, attrs: 'data-meta="meta"', prefix: "$" })}
        ${field({ id: "m-turbo", label: "Turbo", value: (ctx.metasDraft || metas).turbo, attrs: 'data-meta="turbo"', prefix: "$" })}
        ${field({ id: "m-colchao", label: "Poupança semanal", value: ctx.metasDraft ? ctx.metasDraft.poupanca : colchao, attrs: 'data-colchao="1"', prefix: "$" })}
      </div>
      <div class="save-bar"><button class="btn primary" type="submit">Salvar</button><span class="save-msg" aria-live="polite"></span></div>
    </form>`;

  // Blocos de módulos desligados não aparecem (numeração segue a ordem)
  const blocos = BLOCOS.filter((b) => blocoLiberado(state, b.id)).map((b, i) => ({ ...b, n: i + 1 })).map((b) => `
    <details class="card sec" data-sec="${b.id}" ${ctx.openSec === b.id ? "open" : ""}>
      <summary class="sec-head"><h2><span class="passo">${b.n}</span>${b.titulo}</h2><span class="total">${resumoBloco(b)}</span></summary>
      <div class="sec-body">
        ${b.id === "ciclo" ? cicloHtml : SECOES.filter((x) => x.bloco === b.id).map(lista).join("")}
      </div>
    </details>${b.id === "ciclo" ? entradasAjustesHtml(ctx) : ""}`).join("");


  root.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">Ajustes</p>
      <h1>Meus números</h1>
      
    </header>

    ${blocos}

    ${meuMenuHtml(ctx)}

    ${ativo(state, "moedas") ? cambioHtml(ctx) : ""}

    ${ativo(state, "dividir") ? conexoesHtml(ctx) : ""}

    <details class="card sec" data-sec="perfil" ${ctx.openSec === "perfil" ? "open" : ""}>
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

    ${dadosHtml(ctx)}

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
  // Ciclo de pagamento: rascunho até salvar
  const fc = root.querySelector("#form-ciclo");
  const guardarMetas = () => {
    const g = (sel) => Number(fc.querySelector(sel).value) || 0;
    ctx.metasDraft = { piso: g('[data-meta="piso"]'), meta: g('[data-meta="meta"]'), turbo: g('[data-meta="turbo"]'), poupanca: g("[data-colchao]") };
  };
  const lerCiclo = () => {
    guardarMetas();
    const base = { ...(ctx.cicloDraft || ciclo) };
    const tipo = fc.querySelector('input[name="c-tipo"]:checked')?.value || base.tipo;
    const d = { tipo, diaSemana: base.diaSemana ?? 5, ancora: base.ancora, diaMes: base.diaMes, datas: base.datas || [] };
    if (fc.querySelector("#c-dia")) d.diaSemana = Number(fc.querySelector("#c-dia").value);
    if (fc.querySelector("#c-ancora")) d.ancora = fc.querySelector("#c-ancora").value || d.ancora;
    if (fc.querySelector("#c-diames")) d.diaMes = Math.min(31, Math.max(1, Number(fc.querySelector("#c-diames").value) || 1));
    return d;
  };
  fc.querySelectorAll('input[name="c-tipo"]').forEach((r) => r.addEventListener("change", () => {
    ctx.cicloDraft = lerCiclo(); ctx.openSec = "ciclo"; ctx.rerender();
  }));
  const nova = fc.querySelector("#c-nova");
  if (nova) nova.addEventListener("change", () => {
    const d = lerCiclo();
    if (nova.value && !d.datas.includes(nova.value)) d.datas = [...d.datas, nova.value].sort();
    ctx.cicloDraft = d; ctx.openSec = "ciclo"; ctx.rerender();
  });
  fc.querySelectorAll("[data-rmdata]").forEach((b) => (b.onclick = () => {
    const d = lerCiclo(); d.datas = d.datas.filter((x) => x !== b.dataset.rmdata);
    ctx.cicloDraft = d; ctx.openSec = "ciclo"; ctx.rerender();
  }));
  if (ctx.cicloDraft) { const m = fc.querySelector(".save-msg"); m.textContent = "alterações não salvas"; m.className = "save-msg warn"; }
  fc.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = lerCiclo();
    if (d.tipo === "manual" && !d.datas.length) { const m = fc.querySelector(".save-msg"); m.textContent = "adicione pelo menos uma data"; m.className = "save-msg warn"; return; }
    const limpo = d.tipo === "semanal" ? { tipo: "semanal", diaSemana: d.diaSemana }
      : d.tipo === "quinzenal" ? { tipo: "quinzenal", diaSemana: fromISO(d.ancora || toISO(nextPayday())).getDay(), ancora: d.ancora || toISO(nextPayday()) }
      : d.tipo === "mensal" ? { tipo: "mensal", diaMes: d.diaMes || 1 }
      : { tipo: "manual", datas: d.datas };
    salvarParte(state, "ciclo", limpo);
    const m = { ...parte(state, "metas") };
    fc.querySelectorAll("[data-meta]").forEach((el) => { m[el.dataset.meta] = Number(el.value) || 0; });
    salvarParte(state, "metas", m);
    salvarParte(state, "colchaoSemanal", Number(fc.querySelector("[data-colchao]").value) || 0);
    ctx.cicloDraft = null;
    ctx.metasDraft = null;
    ctx.openSec = null;
    ctx.salvoEm = "ciclo";
    salvar();
  });

  root.querySelectorAll("form.row-form, form.conta-form, #form-ciclo").forEach((form) => {
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
        ["freq", "dia", "desde", "ate", "divida", "diaConfirmar"].forEach((k) => delete novo[k]);
        if (antes.estimativa && base.valor === antes.valor) novo.estimativa = true;
      } else {
        destino = "mensais";
        novo = { ...base, freq, dia: Number(v("dia").value) || 1, grupo: v("investimento").checked ? "investimento" : "contas" };
        delete novo.compartilhado;
        if (Number(v("dia").value)) novo.diaConfirmar = false;
        ["desde", "ate"].forEach((f) => { if (v(f).value) novo[f] = v(f).value; else delete novo[f]; });
        if (v("divida").value) novo.divida = v("divida").value; else delete novo.divida;
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
  bindEntradasAjustes(root, ctx);
  bindMeuMenu(root, ctx);

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
