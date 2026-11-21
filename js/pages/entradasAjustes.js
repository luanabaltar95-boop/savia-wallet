// =========================================================
// MINHAS ENTRADAS (Ajustes) — cadastro de onde vem o dinheiro.
// Salário fixo (valor, dia, conta e divisão entre contas) e
// extras variáveis (dia e conta certos; o valor eu confirmo).
// =========================================================
import { lista } from "../core/entradas.js";
import { contasCorrentes } from "../core/contasCorrentes.js";
import { getCiclo, DIAS_SEMANA } from "../core/calendar.js";
import { parte } from "../core/config.js";
import { money } from "../core/format.js";
import { field, select, segmented, chip, esc, toast } from "../components/ui.js";

const novoId = () => "en-" + Date.now().toString(36);
const DIAS = DIAS_SEMANA.map((d, i) => ({ id: String(i), label: d }));

export function entradasAjustesHtml(ctx, n) {
  const { state } = ctx;
  const contas = contasCorrentes(state);
  const nomeConta = (id) => (contas.find((b) => b.id === id) || contas[0]).banco;
  const semanal = getCiclo().tipo === "semanal";
  const calcs = parte(state, "fontes");
  const ed = ctx.entAjuste; // id em edição ou "nova"

  const form = (e = { tipo: "fixo", dia: String(getCiclo().diaSemana ?? 5), conta: contas[0].id }) => {
    const div = (e.divisao || [])[0] || {};
    return `<form class="ent-cad" id="ent-cad" data-id="${esc(e.id || "")}" novalidate>
      ${segmented({ name: "tipo", label: "Tipo", options: [{ id: "fixo", label: "Fixo" }, { id: "variavel", label: "Variável" }], value: e.tipo })}
      <div class="fields stack">
        ${field({ id: "ec-nome", name: "nome", label: "Nome", type: "text", value: e.nome || "", placeholder: e.tipo === "fixo" ? "Salário" : "Lyft, gorjeta, freela…" })}
        ${field({ id: "ec-valor", name: "valor", label: e.tipo === "fixo" ? "Valor" : "Valor de sempre (estimativa)", value: e.valor ?? "", prefix: "$", placeholder: "0,00" })}
        ${semanal ? select({ id: "ec-dia", label: "Dia que cai", options: DIAS, value: String(e.dia ?? "5") }) : `<p class="hint">Cai no dia do pagamento.</p>`}
        ${select({ id: "ec-conta", label: "Cai na conta", options: contas.map((b) => ({ id: b.id, label: b.banco })), value: e.conta || contas[0].id, note: `Falta um banco? <a href="#ajustes" data-ir-bancos>Adicionar em Meus bancos</a>` })}
        ${e.tipo === "variavel" && calcs.length ? select({ id: "ec-calc", label: "Somar da calculadora", options: [{ id: "", label: "Não, eu digito" }, ...calcs.map((f) => ({ id: f.id, label: f.nome }))], value: e.calc || "" }) : ""}
        ${e.tipo === "fixo" && contas.length > 1 ? `
          ${select({ id: "ec-div-conta", label: "Parte em outra conta (opcional)", options: [{ id: "", label: "Não" }, ...contas.map((b) => ({ id: b.id, label: b.banco }))], value: div.conta || "" })}
          ${field({ id: "ec-div-valor", name: "divValor", label: "Quanto vai para ela", value: div.valor ?? "", prefix: "$", placeholder: "0,00" })}` : ""}
      </div>
      <div class="inline-btns">
        <button class="btn primary" type="submit">Salvar</button>
        <button class="btn" type="button" id="ec-cancel">Cancelar</button>
        ${e.id ? `<button class="link danger" type="button" id="ec-del">remover</button>` : ""}
      </div>
    </form>`;
  };

  const linha = (e) => ed === e.id ? form(e) : `<li class="share">
      <div><div class="name">${esc(e.nome)}</div>
        <div class="meta">${chip(e.tipo === "fixo" ? "fixo" : "variável", e.tipo === "fixo" ? "ok" : "plan")}${semanal && e.dia !== "" && e.dia != null ? chip(DIAS_SEMANA[Number(e.dia)].toLowerCase()) : ""}${chip(nomeConta(e.conta))}${(e.divisao || []).filter((d) => d.conta && Number(d.valor) > 0).map((d) => chip(`${money(Number(d.valor), true)} no ${nomeConta(d.conta)}`)).join("")}</div></div>
      <div class="ent-dir"><b>${e.tipo === "fixo" ? money(Number(e.valor), true) : e.calc ? "calculadora" : `≈ ${money(Number(e.valor) || 0, true)}`}</b>
        <button class="link" data-ec-edit="${esc(e.id)}">editar</button></div>
    </li>`;

  const l = lista(state);
  return `<details class="card sec" data-sec="entradas" ${ctx.openSec === "entradas" ? "open" : ""}>
    <summary class="sec-head"><h2>${n ? `<span class="passo">${n}</span>` : ""}Minhas entradas</h2><span class="total">${l.length}</span></summary>
    <div class="sec-body">
      ${l.length ? `<ul class="shares">${l.map(linha).join("")}</ul>` : `<p class="hint">Cadastre o que entra (salário e extras). Toda semana aparece sozinho na Hoje.</p>`}
      ${ed === "nova" ? form({ tipo: ctx.entTipo || "fixo", dia: String(getCiclo().diaSemana ?? 5), conta: contas[0].id }) : `<button class="btn primary add-btn" id="ec-nova">+ Adicionar</button>`}
    </div>
  </details>`;
}

export function bindEntradasAjustes(root, ctx) {
  const { state, persist } = ctx;
  const salvar = (t) => { ctx.entAjuste = null; ctx.openSec = "entradas"; persist(); ctx.rerender(); if (t) toast(t); };
  const nova = root.querySelector("#ec-nova");
  if (nova) nova.onclick = () => { ctx.entAjuste = "nova"; ctx.entTipo = "fixo"; ctx.openSec = "entradas"; ctx.rerender(); };
  root.querySelectorAll("[data-ec-edit]").forEach((b) => (b.onclick = () => { ctx.entAjuste = b.dataset.ecEdit; ctx.openSec = "entradas"; ctx.rerender(); }));
  root.querySelectorAll("[data-ir-bancos]").forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); ctx.entAjuste = null; ctx.bancoAjuste = "novo"; ctx.openSec = "bancos"; ctx.rerender({ focus: "bc-banco" }); }));
  const f = root.querySelector("#ent-cad");
  if (!f) return;
  // Trocar fixo/variável redesenha o formulário (campos diferentes)
  f.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener("change", () => {
    if (f.dataset.id) {
      state.config.entradas = lista(state).map((e) => (e.id === f.dataset.id ? { ...e, tipo: r.value } : e));
    } else ctx.entTipo = r.value;
    ctx.rerender();
  }));
  f.querySelector("#ec-cancel").onclick = () => { ctx.entAjuste = null; ctx.rerender(); };
  const del = f.querySelector("#ec-del");
  if (del) del.onclick = () => {
    if (!del.dataset.confirma) { del.dataset.confirma = "1"; del.textContent = "confirmar"; return; }
    state.config = { ...state.config, entradas: lista(state).filter((e) => e.id !== f.dataset.id) };
    salvar();
  };
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (id) => f.querySelector(id);
    const tipo = f.querySelector('input[name="tipo"]:checked').value;
    const nome = v("#ec-nome").value.trim();
    const valor = Number(v("#ec-valor").value.replace(",", ".")) || 0;
    if (!nome) return toast("Dê um nome");
    if (tipo === "fixo" && !(valor > 0)) return toast("Coloque o valor");
    const novo = {
      id: f.dataset.id || novoId(), nome, tipo, valor,
      dia: v("#ec-dia") ? v("#ec-dia").value : "",
      conta: v("#ec-conta").value,
    };
    if (tipo === "variavel" && v("#ec-calc")) novo.calc = v("#ec-calc").value || null;
    const dc = v("#ec-div-conta"), dv = v("#ec-div-valor");
    novo.divisao = tipo === "fixo" && dc && dc.value && Number(dv.value) > 0 ? [{ conta: dc.value, valor: Number(dv.value.replace(",", ".")) }] : [];
    const atual = lista(state);
    state.config = { ...state.config, entradas: f.dataset.id ? atual.map((x) => (x.id === novo.id ? novo : x)) : [...atual, novo] };
    salvar("Salvo ✓");
  });
}
