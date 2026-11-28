// =========================================================
// ENTRADAS NA HOJE — linhas compactas no card "Vai entrar".
// Cada linha: ícone · nome · banco e data · valor · menu ⋯.
// Ações (editar, confirmar, remover) e formulários abrem num
// bottom sheet, sem cobrir o resto da tela.
// =========================================================
import { entradasDaSemana, confirmar, desconfirmar, mudarValor, voltarPadrao, avulsas, addAvulsa, editAvulsa, rmAvulsa } from "../core/entradas.js";
import { contasCorrentes } from "../core/contasCorrentes.js";
import { fromISO, toISO, DIAS_SEMANA } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, select, esc, toast } from "../components/ui.js";
import { ICONE } from "../components/icones.js";

const nomeConta = (state, id) => (contasCorrentes(state).find((b) => b.id === id) || {}).banco || "minha conta";
const dia = (iso) => `${DIAS_SEMANA[fromISO(iso).getDay()].slice(0, 3).toLowerCase()} ${shortDate(fromISO(iso))}`;

// Uma linha de receita
const linhaRc = ({ icone, nome, sub, valor, status = "", acao = "", menu = "" }) => `<li class="rc-linha">
    <span class="rc-ic">${icone}</span>
    <div class="rc-txt"><span class="rc-nome">${esc(nome)}</span><span class="rc-sub">${sub}</span></div>
    <div class="rc-dir"><b class="num">${money(valor, true)}</b>${status}</div>
    ${acao}${menu}
  </li>`;
const btnMenu = (attr) => `<button class="rc-menu" type="button" ${attr} aria-label="Opções">${ICONE.pontos}</button>`;

export function entradasLinhas(ctx, iso) {
  const { seed, state } = ctx;
  const lista = entradasDaSemana(seed, state, iso);
  const html = lista.map((e) => {
    const contas = e.partes.map((p) => nomeConta(state, p.conta)).join(" + ");
    const st = e.tipo === "fixo" ? (e.confirmado ? "caiu" : "previsto") : e.confirmado ? "confirmado" : e.pendente ? "confirmar" : "previsto";
    return linhaRc({
      icone: e.tipo === "fixo" ? ICONE.salario : ICONE.extra,
      nome: e.nome,
      sub: `${esc(contas)} · ${dia(e.data)}${e.mudou ? " · só esta semana" : ""}`,
      valor: e.valor,
      status: `<span class="rc-st ${st === "confirmar" ? "warn" : st === "previsto" ? "" : "ok"}">${st}</span>`,
      acao: e.pendente ? `<button class="pill ok" type="button" data-ent-ok="${esc(e.id)}" data-valor="${e.valor}">Confirmar</button>` : "",
      menu: btnMenu(`data-ent-menu="${esc(e.id)}"`),
    });
  }).join("");
  return { html, pendentes: lista.filter((e) => e.pendente) };
}

// Entradas avulsas desta semana (lançadas aqui)
export function avulsasHtml(ctx, iso) {
  const { state } = ctx;
  return avulsas(state, iso).map((a) => linhaRc({
    icone: ICONE.avulsa, nome: a.nome, sub: `${esc(nomeConta(state, a.conta))} · ${dia(a.data)}`, valor: a.valor,
    menu: btnMenu(`data-av-menu="${esc(a.id)}"`),
  })).join("");
}
export const linhaExtra = (icone, nome, sub, valor, link = "") => linhaRc({ icone: ICONE[icone], nome, sub: sub + link, valor });

// Bottom sheet: ações de uma entrada, editar valor, nova/editar avulsa
export function entradasSheet(ctx, iso) {
  const { state } = ctx;
  const casca = (titulo, corpo) => `<div class="sheet-backdrop" data-sheet-fechar>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="sheet-grip"></div><h2>${esc(titulo)}</h2>${corpo}</div></div>`;
  const contas = contasCorrentes(state);
  if (ctx.entMenu) {
    const e = entradasDaSemana(ctx.seed, state, iso).find((x) => x.id === ctx.entMenu);
    if (e) return casca(e.nome, `<div class="sheet-acoes">
        <button type="button" data-ent-edit="${esc(e.id)}">Editar valor desta semana</button>
        ${e.mudou && !(e.tipo === "variavel" && e.confirmado) ? `<button type="button" data-ent-padrao="${esc(e.id)}">Voltar ao padrão</button>` : ""}
        ${e.tipo === "variavel" && e.confirmado ? `<button type="button" data-ent-desfaz="${esc(e.id)}">Desfazer confirmação</button>` : ""}
        <a href="#ajustes" data-abrir-sec="ciclo">Configurar meu pagamento</a>
        <button type="button" class="neutro" data-sheet-fechar>Cancelar</button></div>`);
  }
  if (ctx.avMenu) {
    const a = avulsas(state, iso).find((x) => x.id === ctx.avMenu);
    if (a) return casca(a.nome, `<div class="sheet-acoes">
        <button type="button" data-av-edit="${esc(a.id)}">Editar</button>
        <button type="button" class="danger" data-av-rm="${esc(a.id)}">Remover</button>
        <button type="button" class="neutro" data-sheet-fechar>Cancelar</button></div>`);
  }
  if (ctx.entEdit) {
    const e = entradasDaSemana(ctx.seed, state, iso).find((x) => x.id === ctx.entEdit);
    if (e) return casca(e.nome, `<form class="sheet-form" data-ent-form="${esc(e.id)}" novalidate>
        ${field({ id: `ev-${e.id}`, label: e.pendente ? "Quanto caiu" : "Valor desta semana", value: e.valor, prefix: "$" })}
        <div class="inline-btns"><button class="btn primary" type="submit">${e.tipo === "variavel" ? "Confirmar" : "Salvar"}</button><button class="btn" type="button" data-sheet-fechar>Cancelar</button></div>
      </form>`);
  }
  if (ctx.avNova || ctx.avEdit) {
    const a = ctx.avEdit ? avulsas(state, iso).find((x) => x.id === ctx.avEdit) || {} : {};
    return casca(a.id ? "Editar entrada" : "Outra entrada", `<form class="sheet-form" id="av-form" data-id="${esc(a.id || "")}" novalidate>
        <div class="fields stack">
          ${field({ id: "av-nome", name: "nome", label: "O que entrou", type: "text", value: a.nome || "", placeholder: "Ex.: hora extra, presente, reembolso" })}
          ${field({ id: "av-valor", name: "valor", label: "Valor", prefix: "$", value: a.valor ?? "", placeholder: "0,00" })}
          ${select({ id: "av-conta", label: "Caiu na conta", options: contas.map((b) => ({ id: b.id, label: b.banco })), value: a.conta || contas[0].id })}
          ${field({ id: "av-data", name: "data", label: "Quando", type: "date", value: a.data || toISO(new Date()) })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">${a.id ? "Salvar" : "Adicionar"}</button><button class="btn" type="button" data-sheet-fechar>Cancelar</button></div>
      </form>`);
  }
  return "";
}

export function bindEntradasHoje(root, ctx, iso) {
  const { state, persist } = ctx;
  const limpar = () => { ctx.entMenu = ctx.avMenu = ctx.entEdit = ctx.avEdit = null; ctx.avNova = false; };
  const salvar = (t) => { limpar(); persist(); ctx.rerender(); if (t) toast(t); };
  const abrir = (campo, valor, foco) => { limpar(); ctx[campo] = valor; ctx.rerender(foco ? { focus: foco } : undefined); };

  root.querySelectorAll("[data-ent-menu]").forEach((b) => (b.onclick = () => abrir("entMenu", b.dataset.entMenu)));
  root.querySelectorAll("[data-av-menu]").forEach((b) => (b.onclick = () => abrir("avMenu", b.dataset.avMenu)));
  root.querySelectorAll("[data-ent-edit]").forEach((b) => (b.onclick = () => abrir("entEdit", b.dataset.entEdit, `ev-${b.dataset.entEdit}`)));
  root.querySelectorAll("[data-av-edit]").forEach((b) => (b.onclick = () => abrir("avEdit", b.dataset.avEdit, "av-valor")));
  const nova = root.querySelector("#av-abrir");
  if (nova) nova.onclick = () => abrir("avNova", true, "av-nome");
  // Fechar: botão Cancelar ou toque fora do sheet
  root.querySelectorAll("[data-sheet-fechar]").forEach((el) => el.addEventListener("click", (e) => { if (e.target === el) { limpar(); ctx.rerender(); } }));
  root.querySelectorAll("[data-ent-ok]").forEach((b) => (b.onclick = () => { confirmar(state, iso, b.dataset.entOk, Number(b.dataset.valor)); salvar("Confirmado ✓"); }));
  root.querySelectorAll("[data-ent-padrao]").forEach((b) => (b.onclick = () => { voltarPadrao(state, iso, b.dataset.entPadrao); salvar(); }));
  root.querySelectorAll("[data-ent-desfaz]").forEach((b) => (b.onclick = () => { desconfirmar(state, iso, b.dataset.entDesfaz); salvar(); }));
  root.querySelectorAll("[data-abrir-sec]").forEach((a) => a.addEventListener("click", () => { ctx.openSec = a.dataset.abrirSec; limpar(); }));
  root.querySelectorAll("[data-ent-form]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Number(f.querySelector("input").value.replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return;
    const ent = entradasDaSemana(ctx.seed, state, iso).find((x) => x.id === f.dataset.entForm);
    if (ent && ent.tipo === "variavel" && (ent.pendente || ent.confirmado)) { confirmar(state, iso, ent.id, v); salvar("Confirmado ✓"); }
    else { mudarValor(state, iso, f.dataset.entForm, v); salvar("Salvo ✓"); }
  }));
  const fa = root.querySelector("#av-form");
  if (fa) fa.addEventListener("submit", (e) => {
    e.preventDefault();
    const valor = Number(fa.valor.value.replace(",", "."));
    if (!(valor > 0)) return toast("Coloque o valor");
    const dados = { nome: fa.nome.value.trim(), valor, conta: fa.querySelector("#av-conta").value, data: fa.data.value || toISO(new Date()) };
    if (fa.dataset.id) editAvulsa(state, iso, fa.dataset.id, dados); else addAvulsa(state, iso, dados);
    salvar(fa.dataset.id ? "Salvo ✓" : "Adicionado ✓");
  });
  root.querySelectorAll("[data-av-rm]").forEach((b) => (b.onclick = () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "Toque de novo para remover"; return; }
    rmAvulsa(state, iso, b.dataset.avRm); salvar();
  }));
}
