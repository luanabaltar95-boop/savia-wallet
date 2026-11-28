// =========================================================
// AJUSTES → MEUS OBJETIVOS — vários objetivos, um principal,
// em ordem de prioridade. Os dados vêm da carteira (fonte única):
// aqui só fica o que é do objetivo (valor, data, quanto guardar).
// =========================================================
import { todosObjetivos, salvarObjetivos, normalizar, novoIdObjetivo } from "../goals/modelo.js";
import { avaliar } from "../goals/engine.js";
import { tipo } from "../goals/tipos.js";
import { seletorObjetivos, camposObjetivo, lerCamposObjetivo, etapaHtml, quandoTexto } from "../components/objetivos.js";
import { ICONE } from "../components/icones.js";
import { money } from "../core/format.js";
import { esc, toast } from "../components/ui.js";

const REPETEM = ["compra", "personalizado", "economizar"]; // tipos que podem ter mais de um
const pct = (a) => `${Math.round(a.progresso * 100)}%`;

export function objetivoResumo(ctx) {
  const ativos = todosObjetivos(ctx.state).filter((g) => g.status === "ativo");
  if (!ativos.length) return "definir";
  return `${ativos.length} ${ativos.length === 1 ? "ativo" : "ativos"}`;
}

function linha(ctx, a, i, total) {
  const g = a;
  const menu = ctx.obMenu === g.id;
  const det = a.emBreve ? "em breve" : a.continuo ? `${a.etapas.filter((e) => e.ok).length} de ${a.etapas.length} em dia`
    : a.tipo !== "dividas" && a.valor && a.valor.alvo ? `${money(a.valor.atual)} de ${money(a.valor.alvo)} · ${pct(a)}` : a.etapas.length ? `etapa ${Math.min(a.etapas.filter((e) => e.ok).length + 1, a.etapas.length)} de ${a.etapas.length}` : "";
  if (ctx.obEdit === g.id) return formHtml(ctx, g);
  const alcancado = !a.continuo && a.etapas.length > 0 && !a.atual;
  // Personalizado por etapas: marco cada etapa como feita aqui mesmo
  const manual = g.tipo === "personalizado" && !(g.alvo > 0);
  const etapas = a.etapas.length && (ctx.obVer === g.id || manual)
    ? `<ol class="cam-lista">${a.etapas.map((e, k) => manual
      ? `<li class="cam-etapa ${e.ok ? "ok" : ""}"><button type="button" class="cam-n" data-ob-etapa="${g.id}|${e.id}" aria-label="Marcar ${esc(e.titulo)}">${e.ok ? "✓" : k + 1}</button><div class="cam-txt"><b>${esc(e.titulo)}</b></div></li>`
      : etapaHtml(e, k, a.atual)).join("")}</ol>` : "";
  return `<li class="ob-linha ${g.status !== "ativo" ? "pausado" : ""}">
    <div class="ob-cab">
      <span class="ob-ic" aria-hidden="true">${a.icone}</span>
      <div class="ob-txt"><b>${esc(a.titulo)}${g.principal ? ` <span class="ob-badge">principal</span>` : ""}${alcancado ? ` <span class="ob-badge ok">alcançado ✓</span>` : ""}</b>
        <small>${esc([g.status === "pausado" ? "pausado" : "", det].filter(Boolean).join(" · "))}</small></div>
      <button class="rc-menu" type="button" data-ob-menu="${g.id}" aria-label="Opções de ${esc(a.titulo)}">${ICONE.pontos}</button>
    </div>
    ${g.status === "ativo" && a.atual ? `<p class="ob-agora">Agora: <b>${esc(a.atual.titulo)}</b>${a.atual.quando ? ` · previsão ${quandoTexto(a.atual.quando)}` : ""}</p>` : ""}
    ${a.faltando.length ? `<div class="ob-falta">${a.faltando.map((f) => f.onde.sec ? `<a href="#ajustes" class="chip-link" data-ob-ir="${f.onde.sec}">+ ${esc(f.label)}</a>` : `<a class="chip-link" href="${f.onde.href}">+ ${esc(f.label)}</a>`).join("")}</div>` : ""}
    ${a.etapas.length && !manual ? `<button class="link" type="button" data-ob-ver="${g.id}">${ctx.obVer === g.id ? "esconder etapas" : `ver as ${a.etapas.length} etapas`}</button>` : ""}
    ${etapas}
    ${menu ? `<div class="sheet-acoes ob-acoes">
      ${a.emBreve ? "" : `<button type="button" data-ob-editar="${g.id}">Editar</button>`}
      ${!g.principal && g.status === "ativo" ? `<button type="button" data-ob-principal-set="${g.id}">Tornar principal</button>` : ""}
      ${i > 0 ? `<button type="button" data-ob-mover="${g.id}|-1">Subir na prioridade</button>` : ""}
      ${i < total - 1 ? `<button type="button" data-ob-mover="${g.id}|1">Descer na prioridade</button>` : ""}
      <button type="button" data-ob-pausar="${g.id}">${g.status === "ativo" ? "Pausar" : "Retomar"}</button>
      <button type="button" class="danger" data-ob-remover="${g.id}">Remover</button>
      <button type="button" class="neutro" data-ob-menu="${g.id}">Fechar</button>
    </div>` : ""}
  </li>`;
}

function formHtml(ctx, g) {
  return `<li class="ob-linha"><form class="ob-form" data-ob-form="${g.id}" novalidate>
    <div class="ob-cab"><span class="ob-ic" aria-hidden="true">${tipo(g.tipo).icone}</span><div class="ob-txt"><b>${esc(tipo(g.tipo).label)}</b>
      <small>${esc(tipo(g.tipo).desc)}</small></div></div>
    <div class="fields stack">${camposObjetivo(ctx.state, g)}</div>
    ${g.tipo === "dividas" ? `<p class="hint">As etapas saem dos meus atrasados, cartões, dívidas e parcelamentos.</p>` : ""}
    ${tipo(g.tipo).continuo ? `<p class="hint">Objetivo contínuo: a carteira acompanha se está tudo em dia.</p>` : ""}
    <div class="save-bar"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-ob-cancelar>Cancelar</button></div>
  </form></li>`;
}

export function objetivoHtml(ctx) {
  const { state, seed } = ctx;
  const todos = todosObjetivos(state).filter((g) => g.status !== "arquivado");
  const av = avaliar(seed, state);
  const comAval = todos.map((g) => ({ ...(av.find((a) => a.id === g.id) || { ...g, titulo: g.nome || tipo(g.tipo).label, icone: tipo(g.tipo).icone, label: tipo(g.tipo).label, etapas: [], faltando: [], progresso: 0, atual: null }), principal: g.principal, status: g.status }));
  const ativos = comAval.filter((g) => g.status === "ativo");
  const pausados = comAval.filter((g) => g.status === "pausado");
  const novo = ctx.obEdit && String(ctx.obEdit).startsWith("novo:") ? normalizar({ id: ctx.obEdit, tipo: ctx.obEdit.slice(5) }) : null;
  const desativados = ativos.map((g) => g.tipo).filter((t) => !REPETEM.includes(t));
  return `<div class="ob-ajustes">
    <p class="hint">Meus objetivos em ordem de prioridade. O dinheiro vai primeiro para o de cima.</p>
    ${ativos.length || novo ? `<ul class="ob-lista">${ativos.map((a, i) => linha(ctx, a, i, ativos.length)).join("")}${novo ? formHtml(ctx, novo) : ""}</ul>` : `<p class="hint">Nenhum objetivo ainda.</p>`}
    ${pausados.length ? `<h4 class="ob-sub">Pausados</h4><ul class="ob-lista">${pausados.map((a, i) => linha(ctx, a, i, pausados.length)).join("")}</ul>` : ""}
    ${ctx.obNovo ? `<div class="ob-novo"><h4 class="ob-sub">O que quero alcançar?</h4>${seletorObjetivos({ desativados, principal: undefined })}
        <button class="btn" type="button" data-ob-novo-fechar>Cancelar</button></div>`
      : !novo ? `<button class="btn primary add-btn" type="button" data-ob-novo>+ Adicionar objetivo</button>` : ""}
  </div>`;
}

export function bindObjetivo(root, ctx) {
  const { state } = ctx;
  const box = root.querySelector(".ob-ajustes");
  if (!box) return;
  const de = (sel, fn) => box.querySelectorAll(sel).forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); fn(b); }));
  const re = () => { ctx.openSec = "objetivo"; ctx.rerender(); };
  const gravar = (lista, msg) => { salvarObjetivos(state, lista); ctx.obMenu = null; ctx.obEdit = null; ctx.openSec = "objetivo"; ctx.persist(); ctx.rerender(); if (msg) toast(msg); };
  const lista = () => todosObjetivos(state);

  de("[data-ob-menu]", (b) => { ctx.obMenu = ctx.obMenu === b.dataset.obMenu ? null : b.dataset.obMenu; re(); });
  de("[data-ob-ver]", (b) => { ctx.obVer = ctx.obVer === b.dataset.obVer ? null : b.dataset.obVer; re(); });
  de("[data-ob-editar]", (b) => { ctx.obEdit = b.dataset.obEditar; ctx.obMenu = null; re(); });
  de("[data-ob-cancelar]", () => { ctx.obEdit = null; re(); });
  de("[data-ob-novo]", () => { ctx.obNovo = true; re(); });
  de("[data-ob-novo-fechar]", () => { ctx.obNovo = false; re(); });
  de("[data-ob-tipo]", (b) => { ctx.obNovo = false; ctx.obEdit = `novo:${b.dataset.obTipo}`; re(); });
  de("[data-ob-etapa]", (b) => {
    const [gid, eid] = b.dataset.obEtapa.split("|");
    gravar(lista().map((g) => (g.id === gid ? { ...g, etapas: g.etapas.map((e) => (e.id === eid ? { ...e, feito: !e.feito } : e)) } : g)));
  });
  de("[data-ob-ir]", (b) => { ctx.openSec = b.dataset.obIr; ctx.rerender(); });
  de("[data-ob-principal-set]", (b) => gravar(lista().map((g) => ({ ...g, principal: g.id === b.dataset.obPrincipalSet })), "Agora é o principal"));
  de("[data-ob-mover]", (b) => {
    const [id, dir] = b.dataset.obMover.split("|");
    const l = lista().filter((g) => g.status !== "arquivado");
    const i = l.findIndex((g) => g.id === id), j = i + Number(dir);
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    gravar([...l.map((g, k) => ({ ...g, prioridade: k + 1 })), ...lista().filter((g) => g.status === "arquivado")]);
  });
  de("[data-ob-pausar]", (b) => gravar(lista().map((g) => (g.id === b.dataset.obPausar ? { ...g, status: g.status === "ativo" ? "pausado" : "ativo", principal: false } : g))));
  de("[data-ob-remover]", (b) => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "Confirmar: remover"; return; }
    // Arquivado: sai das telas e do plano, mas o histórico fica guardado
    gravar(lista().map((g) => (g.id === b.dataset.obRemover ? { ...g, status: "arquivado", principal: false } : g)), "Objetivo removido");
  });
  box.querySelectorAll("[data-ob-form]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = f.dataset.obForm;
    const atuais = lista();
    if (id.startsWith("novo:")) {
      const g = normalizar(lerCamposObjetivo(f, { tipo: id.slice(5), etapas: [] }));
      const ativos = atuais.filter((x) => x.status === "ativo");
      gravar([...atuais, { ...g, id: novoIdObjetivo(), dono: ctx.usuario || "", inicio: new Date().toISOString().slice(0, 10), prioridade: ativos.length + 1, principal: !ativos.length }], "Objetivo criado");
    } else {
      gravar(atuais.map((g) => (g.id === id ? lerCamposObjetivo(f, g) : g)), "Salvo ✓");
    }
  }));
}
