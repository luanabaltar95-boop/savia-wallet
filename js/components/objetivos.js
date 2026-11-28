// =========================================================
// COMPONENTES DE OBJETIVOS — usados no onboarding, em Ajustes e na Home.
// =========================================================
import { TIPOS, tipo } from "../goals/tipos.js";
import { ROTULO_FONTE } from "../goals/recomendacoes.js";
import { poupanca } from "../core/destino.js";
import { fromISO } from "../core/calendar.js";
import { shortDate, monthYear } from "../core/format.js";
import { field, select, esc } from "./ui.js";

const n = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

// Grade de tipos: toque seleciona (vários); a estrela marca o principal
export function seletorObjetivos({ selecionados = [], principal = null, desativados = [] }) {
  return `<div class="ob-grade">${TIPOS.map((t) => {
    const on = selecionados.includes(t.id);
    const off = desativados.includes(t.id);
    return `<div class="ob-op ${on ? "on" : ""} ${t.emBreve ? "breve" : ""}">
      <button type="button" class="ob-tipo" data-ob-tipo="${t.id}" aria-pressed="${on}" ${off || t.emBreve ? "disabled" : ""}>
        <span class="ob-ic" aria-hidden="true">${t.icone}</span>
        <span class="ob-txt"><b>${esc(t.label)}</b><small>${esc(t.emBreve ? "Em breve" : off ? "Já é um objetivo meu" : t.desc)}</small></span>
      </button>
      ${on && principal !== undefined ? `<button type="button" class="ob-estrela ${principal === t.id ? "on" : ""}" data-ob-principal="${t.id}" aria-label="Tornar ${esc(t.label)} o principal">${principal === t.id ? "★ principal" : "☆"}</button>` : ""}
    </div>`;
  }).join("")}</div>`;
}

// Campos do objetivo conforme o tipo (o resto vem da carteira)
export function camposObjetivo(state, g, p = "ob") {
  const t = tipo(g.tipo);
  const bancos = state.bancos || [];
  const contas = bancos.length ? bancos.map((b) => ({ id: b.id, label: b.banco })) : [{ id: "", label: "Poupança" }];
  const nomeLabel = { compra: "O que quero comprar ou fazer", personalizado: "Meu objetivo", economizar: "Para quê (opcional)", reserva: "Nome (opcional)", patrimonio: "Nome (opcional)" }[g.tipo] || "Nome (opcional)";
  const out = [field({ id: `${p}-nome`, label: nomeLabel, type: "text", value: g.nome, placeholder: t.label })];
  if (t.dinheiro) {
    const alvoLabel = g.tipo === "patrimonio" ? "Patrimônio que quero ter" : g.tipo === "reserva" ? "Valor da reserva (opcional)" : g.tipo === "personalizado" ? "Valor (opcional)" : "Quanto quero juntar";
    const alvoNota = g.tipo === "reserva" ? "Sem valor, uso 3 meses das minhas contas" : g.tipo === "personalizado" ? "Sem valor, sigo por etapas" : "";
    out.push(field({ id: `${p}-alvo`, label: alvoLabel, value: g.alvo || "", prefix: "$", placeholder: "0,00", note: alvoNota }));
    out.push(field({ id: `${p}-ate`, label: "Até quando (opcional)", type: "date", value: g.ate || "" }));
    if (g.tipo !== "patrimonio") {
      out.push(field({ id: `${p}-semanal`, label: "Guardo por semana", value: g.semanal || "", prefix: "$", placeholder: "0,00", note: "Entra no meu plano como “Guardar”" }));
      out.push(select({ id: `${p}-conta`, label: "Guardo na conta", options: contas, value: g.conta || poupanca(state).id }));
    }
  }
  if (g.tipo === "personalizado") {
    out.push(field({ id: `${p}-etapas`, label: "Etapas (uma por linha, se não tiver valor)", type: "text", value: (g.etapas || []).map((e) => e.nome).join(" ; "), placeholder: "Ex.: pesquisar ; orçar ; contratar", note: "Separe com ;" }));
  }
  return out.join("");
}

export function lerCamposObjetivo(root, g, p = "ob") {
  const q = (id) => root.querySelector(`#${p}-${id}`);
  const v = { ...g, nome: (q("nome") || {}).value?.trim() || "" };
  if (q("alvo")) v.alvo = n(q("alvo").value);
  if (q("ate")) v.ate = q("ate").value;
  if (q("semanal")) v.semanal = n(q("semanal").value);
  if (q("conta")) v.conta = q("conta").value;
  if (q("etapas")) {
    const nomes = q("etapas").value.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
    v.etapas = nomes.map((nome, i) => { const ant = (g.etapas || []).find((e) => e.nome === nome); return ant || { id: `e${i}${Date.now().toString(36)}`, nome, feito: false }; });
  }
  return v;
}

// Uma etapa na lista (número, título, detalhe e quando)
export function etapaHtml(e, i, atual) {
  const st = e.ok ? "ok" : e === atual ? "atual" : "";
  const quando = e.ok ? "feito" : e.quando ? `previsão ${quandoTexto(e.quando)}` : "";
  return `<li class="cam-etapa ${st}"><span class="cam-n">${e.ok ? "✓" : i + 1}</span>
    <div class="cam-txt"><b>${esc(e.titulo)}</b><small>${[e.desc, quando].filter(Boolean).map(esc).join(" · ")}</small></div></li>`;
}
export function quandoTexto(iso) {
  const d = fromISO(iso);
  return (d - new Date()) / 86400000 > 120 ? monthYear(d) : shortDate(d);
}

export const fonteTag = (f) => `<span class="origem ${f}">${ROTULO_FONTE[f] || f}</span>`;
