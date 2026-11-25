// =========================================================
// ENTRADAS NA HOJE — "Quanto vai entrar" montado das entradas
// cadastradas. Fixo entra sozinho; variável eu só confirmo o valor.
// Posso mudar o valor só desta semana.
// =========================================================
import { entradasDaSemana, confirmar, desconfirmar, mudarValor, voltarPadrao, avulsas, addAvulsa, rmAvulsa } from "../core/entradas.js";
import { contasCorrentes } from "../core/contasCorrentes.js";
import { fromISO, toISO, DIAS_SEMANA } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, select, chip, esc, toast } from "../components/ui.js";

const nomeConta = (state, id) => (contasCorrentes(state).find((b) => b.id === id) || {}).banco || "minha conta";
const diaTxt = (iso) => `${DIAS_SEMANA[fromISO(iso).getDay()].toLowerCase()} ${shortDate(fromISO(iso))}`;

export function entradasLinhas(ctx, iso) {
  const { seed, state } = ctx;
  const lista = entradasDaSemana(seed, state, iso);
  const linha = (e) => {
    const contas = e.partes.map((p) => nomeConta(state, p.conta)).join(" + ");
    const status = e.tipo === "fixo"
      ? (e.confirmado ? chip("caiu", "ok") : chip(`cai ${diaTxt(e.data)}`, "plan"))
      : e.confirmado ? chip("confirmado ✓", "ok") : e.pendente ? chip("confirmar", "miss") : chip(`previsto · ${diaTxt(e.data)}`, "plan");
    const editando = ctx.entEdit === e.id;
    return `<li class="ent ${e.pendente ? "pend" : ""}">
      <div class="ent-top">
        <div class="rs-nome"><span>${esc(e.nome)}</span><small class="hint">${esc(contas)}${e.mudou ? " · só esta semana" : ""}</small></div>
        <b>${money(e.valor, true)}</b>
      </div>
      ${editando ? `<form class="inline ent-form" data-ent-form="${esc(e.id)}" novalidate>
          ${field({ id: `ev-${e.id}`, label: e.pendente ? "Quanto caiu" : "Valor desta semana", value: e.valor, prefix: "$" })}
          <button class="btn primary" type="submit">${e.tipo === "variavel" ? "Confirmar" : "Salvar"}</button>
          <button class="btn" type="button" data-ent-cancel>Cancelar</button>
        </form>`
        : `<div class="row-actions">${status}
          ${e.pendente ? `<button class="btn primary" data-ent-ok="${esc(e.id)}" data-valor="${e.valor}">Confirmar</button>` : ""}
          <button class="link" data-ent-edit="${esc(e.id)}">${e.pendente ? "mudar valor" : "mudar"}</button>
          ${e.mudou && !(e.tipo === "variavel" && e.confirmado) ? `<button class="link" data-ent-padrao="${esc(e.id)}">voltar ao padrão</button>` : ""}
          ${e.tipo === "variavel" && e.confirmado ? `<button class="link" data-ent-desfaz="${esc(e.id)}">desfazer</button>` : ""}
        </div>`}
    </li>`;
  };
  return { html: `<ul class="ent-lista">${lista.map(linha).join("")}</ul>`, pendentes: lista.filter((e) => e.pendente) };
}

// Entrada avulsa: algo que entrou só esta semana (lanço aqui, não em Ajustes)
export function avulsasHtml(ctx, iso) {
  const { state } = ctx;
  const lista = avulsas(state, iso);
  const contas = contasCorrentes(state);
  const hoje = toISO(new Date());
  const linhas = lista.map((a) => `<li class="ent">
      <div class="ent-top">
        <div class="rs-nome"><span>${esc(a.nome)}</span><small class="hint">${esc(nomeConta(state, a.conta))} · ${shortDate(fromISO(a.data))}</small></div>
        <b>${money(a.valor, true)}</b>
      </div>
      <div class="row-actions">${chip("só esta semana", "plan")}<button class="link danger" data-av-rm="${esc(a.id)}">remover</button></div>
    </li>`).join("");
  const form = ctx.avNova ? `<form class="ent-cad" id="av-form" novalidate>
      <div class="fields stack">
        ${field({ id: "av-nome", name: "nome", label: "O que entrou", type: "text", placeholder: "Ex.: hora extra, presente, reembolso" })}
        ${field({ id: "av-valor", name: "valor", label: "Valor", prefix: "$", placeholder: "0,00" })}
        ${select({ id: "av-conta", label: "Caiu na conta", options: contas.map((b) => ({ id: b.id, label: b.banco })), value: contas[0].id })}
        ${field({ id: "av-data", name: "data", label: "Quando", type: "date", value: hoje })}
      </div>
      <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button><button class="btn" type="button" id="av-cancel">Cancelar</button></div>
    </form>` : `<button class="btn primary add-btn" id="av-abrir">+ Outra entrada</button>`;
  return `${linhas ? `<ul class="ent-lista">${linhas}</ul>` : ""}${form}`;
}

export function bindEntradasHoje(root, ctx, iso) {
  const { state, persist } = ctx;
  const salvar = (t) => { ctx.entEdit = null; persist(); ctx.rerender(); if (t) toast(t); };
  const lista = () => entradasDaSemana(ctx.seed, state, iso);
  const ab = root.querySelector("#av-abrir");
  if (ab) ab.onclick = () => { ctx.avNova = true; ctx.rerender({ focus: "av-nome" }); };
  const ca = root.querySelector("#av-cancel");
  if (ca) ca.onclick = () => { ctx.avNova = false; ctx.rerender(); };
  const fa = root.querySelector("#av-form");
  if (fa) fa.addEventListener("submit", (e) => {
    e.preventDefault();
    const valor = Number(fa.valor.value.replace(",", "."));
    if (!(valor > 0)) return toast("Coloque o valor");
    addAvulsa(state, iso, { nome: fa.nome.value.trim(), valor, conta: fa.querySelector("#av-conta").value, data: fa.data.value || toISO(new Date()) });
    ctx.avNova = false;
    salvar("Adicionado ✓");
  });
  root.querySelectorAll("[data-av-rm]").forEach((b) => (b.onclick = () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    rmAvulsa(state, iso, b.dataset.avRm); salvar();
  }));
  root.querySelectorAll("[data-ent-edit]").forEach((b) => (b.onclick = () => { ctx.entEdit = b.dataset.entEdit; ctx.rerender({ focus: `ev-${b.dataset.entEdit}` }); }));
  root.querySelectorAll("[data-ent-cancel]").forEach((b) => (b.onclick = () => { ctx.entEdit = null; ctx.rerender(); }));
  root.querySelectorAll("[data-ent-ok]").forEach((b) => (b.onclick = () => { confirmar(state, iso, b.dataset.entOk, Number(b.dataset.valor)); salvar("Confirmado ✓"); }));
  root.querySelectorAll("[data-ent-padrao]").forEach((b) => (b.onclick = () => { voltarPadrao(state, iso, b.dataset.entPadrao); salvar(); }));
  root.querySelectorAll("[data-ent-desfaz]").forEach((b) => (b.onclick = () => { desconfirmar(state, iso, b.dataset.entDesfaz); salvar(); }));
  root.querySelectorAll("[data-ent-form]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Number(f.querySelector("input").value.replace(",", "."));
    if (!Number.isFinite(v) || v < 0) return;
    const ent = lista().find((x) => x.id === f.dataset.entForm);
    if (ent && ent.tipo === "variavel" && (ent.pendente || ent.confirmado)) { confirmar(state, iso, ent.id, v); salvar("Confirmado ✓"); }
    else { mudarValor(state, iso, f.dataset.entForm, v); salvar("Salvo ✓"); }
  }));
}
