// =========================================================
// COMPONENTES — funções que devolvem HTML usando as classes de
// styles/components.css. Páginas só montam estas peças.
// =========================================================
import { money, shortDate } from "../core/format.js";
import { fromISO } from "../core/calendar.js";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const chip = (text, cls = "") => `<span class="chip ${cls}">${esc(text)}</span>`;

export function card({ title, total, hint, body, cls = "" }) {
  return `<section class="card ${cls}">
    ${title ? `<div class="card-head"><h2>${esc(title)}</h2>${total != null ? `<span class="total">${esc(total)}</span>` : ""}</div>` : ""}
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
    ${body || ""}
  </section>`;
}

// Campo com rótulo, entrada e nota. Em .fields os três alinham entre colunas (subgrid).
// prefix/suffix: símbolo dentro do campo ($, h, mi)
const CAL = `<svg class="date-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>`;

// Data exibida em português, centralizada; o seletor nativo fica por cima (invisível)
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const dataTexto = (iso) => {
  if (!iso) return "Escolher data";
  const d = fromISO(iso);
  const ano = d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MES[d.getMonth()]}${ano}`;
};

export function field({ id, label, value, type = "number", readonly = false, note = "", attrs = "", name, prefix = "", suffix = "", placeholder = "0" }) {
  if (type === "date") {
    return `<label class="field" for="${id}">
    <span class="lbl">${esc(label)}</span>
    <span class="input-wrap date-wrap">
      <span class="date-display">${esc(dataTexto(value))}</span>${CAL}
      <input id="${id}" name="${name || id}" type="date" value="${esc(value ?? "")}" ${attrs}>
    </span>
    <span class="hint note">${note}</span>
  </label>`;
  }
  const num = type === "number" ? `inputmode="decimal" min="0" step="any" placeholder="${esc(placeholder)}"` : "";
  const cls = [prefix ? "has-prefix" : "", suffix ? "has-suffix" : ""].join(" ").trim();
  return `<label class="field" for="${id}">
    <span class="lbl">${esc(label)}</span>
    <span class="input-wrap ${cls}">
      ${prefix ? `<span class="affix pre" aria-hidden="true">${esc(prefix)}</span>` : ""}
      <input id="${id}" name="${name || id}" type="${type}" ${num} value="${esc(value ?? "")}" ${readonly ? "readonly" : ""} ${attrs}>
      ${suffix ? `<span class="affix suf" aria-hidden="true">${esc(suffix)}</span>` : ""}
    </span>
    <span class="hint note">${note}</span>
  </label>`;
}

// Lista de opções (select)
export function select({ id, label, options, value, note = "" }) {
  return `<label class="field" for="${id}">
    <span class="lbl">${esc(label)}</span>
    <select id="${id}" name="${id}">${options.map((o) => `<option value="${esc(o.id)}" ${o.id === value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>
    <span class="hint note">${note}</span>
  </label>`;
}

// Escolha única em botões (ex.: quem pagou a gasolina)
export function segmented({ name, label, options, value }) {
  return `<fieldset class="seg"><legend>${esc(label)}</legend>
    <div class="seg-opts" style="--n:${options.length === 4 ? 2 : Math.min(options.length, 3)}">${options.map((o) => `<label><input type="radio" name="${name}" value="${o.id}" ${o.id === value ? "checked" : ""}><span>${esc(o.label)}</span></label>`).join("")}</div>
  </fieldset>`;
}

// Progresso até o próximo nível + os três níveis
export function levels({ renda, piso, meta, turbo, nomes = {} }) {
  const steps = [
    { nome: nomes.piso || "Piso", valor: piso },
    { nome: nomes.meta || "Meta", valor: meta },
    { nome: nomes.turbo || "Turbo", valor: turbo },
  ];
  const next = steps.find((s) => renda < s.valor);
  const prev = [...steps].reverse().find((s) => renda >= s.valor);
  const from = prev ? prev.valor : 0;
  const pct = next ? Math.max(0, Math.min(100, ((renda - from) / (next.valor - from)) * 100)) : 100;

  let status;
  if (!renda) status = `<span class="status">Quando eu digitar quanto entrou, aparece meu nível.</span>`;
  else if (!prev) status = `<span class="status warn">Faltam ${money(piso - renda)} para ${steps[0].nome}.</span>`;
  else if (next) status = `<span class="status ok">${prev.nome} ✓ · faltam ${money(next.valor - renda)} para ${next.nome}.</span>`;
  else status = `<span class="status ok">${steps[2].nome} ✓ · semana excelente.</span>`;

  const tiles = steps.map((s) => {
    const ok = renda >= s.valor;
    return `<div class="level ${ok ? "ok" : ""}"><span>${s.nome}</span><b>${money(s.valor)}</b></div>`;
  }).join("");

  return `<div class="levels">
    ${status}
    <div class="track" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
      <div class="fill ${prev ? "" : "low"}" style="width:${pct}%"></div>
    </div>
    <div class="level-row">${tiles}</div>
  </div>`;
}

// Linha de dívida: posição, nome, etiquetas, saldo e barra de uso
export function debtRow({ rank, nome, saldo, tags = [], uso, sub }) {
  return `<li class="debt">
    ${rank ? `<span class="rank">${rank}º</span>` : ""}
    <div class="debt-main">
      <div class="debt-top"><span class="name">${esc(nome)}</span><span class="value">${money(saldo)}</span></div>
      ${tags.length ? `<div class="meta">${tags.join("")}</div>` : ""}
      ${uso != null ? `<div class="track thin"><div class="fill ${uso > 0.9 ? "low" : ""}" style="width:${Math.min(100, uso * 100)}%"></div></div>` : ""}
      ${sub ? `<div class="hint">${sub}</div>` : ""}
    </div>
  </li>`;
}

// Pequenos blocos de número (resumo)
export function stats(items) {
  return `<div class="level-row">${items.map((s) => `<div class="level"><span>${esc(s.label)}</span><b>${esc(s.valor)}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ""}</div>`).join("")}</div>`;
}

const VERBO ={ pagar: "pagar", guardar: "guardar", usar: "para usar" };

// Linha da lista de sexta: o que fazer com cada valor
export function payRow(item, { valorAgora, pago, info, destino, n }) {
  const tags = [];
  if (destino) tags.push(chip(`→ ${destino}`, "ok"));
  if (info && info.valor != null) tags.push(chip(`pago ${money(info.valor, true)}${Number(info.juros) ? ` + ${money(Number(info.juros), true)} juros` : ""}`, "ok"));
  if (item.atrasado) tags.push(chip("atrasado", "miss"));
  tags.push(chip(item.vence && item.acao === "pagar" ? `pagar até ${shortDate(item.vence)}` : VERBO[item.acao] || "guardar", item.acao === "pagar" ? "part" : "plan"));
  if (item.veioDe) tags.push(chip("veio do pagamento anterior"));
  if (item.protegido) tags.push(chip("protegido", "plan"));
  if (item.estimativa) tags.push(chip("≈ estimativa"));
  const parcial = !info && valorAgora < item.valor - 0.005;
  return `<li class="mission ${pago ? "done" : ""}">
    <input class="check" type="checkbox" data-pago="${esc(item.id)}" ${pago ? "checked" : ""} aria-label="Marcar ${esc(item.nome)} como feito">
    <div>
      <div class="name">${n ? `<span class="num">${n}</span>` : ""}${esc(item.nome)}</div>
      ${item.detalhe ? `<div class="hint">${esc(item.detalhe)}</div>` : ""}
      <div class="meta">${tags.join("")}</div>
    </div>
    <div class="value">${money(valorAgora, true)}${parcial ? `<div class="hint">de ${money(item.valor, true)}</div>` : ""}</div>
  </li>`;
}

export function mission(item, { coberto, pago, mostrarCobertura }) {
  const tags = [];
  if (item.atrasado) tags.push(chip("atrasado", "miss"));
  if (item.vence) tags.push(chip(`vence ${shortDate(item.vence)}`));
  if (item.protegido) tags.push(chip("protegido", "plan"));
  if (item.estimativa) tags.push(chip("≈ estimativa"));
  if (mostrarCobertura && !pago) {
    if (coberto >= item.valor - 0.005) tags.push(chip("coberto", "ok"));
    else if (coberto > 0) tags.push(chip(`faltam ${money(item.valor - coberto)}`, "part"));
    else tags.push(chip("sem dinheiro ainda", "miss"));
  }
  return `<li class="mission ${pago ? "done" : ""}">
    <input class="check" type="checkbox" data-pago="${esc(item.id)}" ${pago ? "checked" : ""} aria-label="Marcar ${esc(item.nome)} como pago">
    <div>
      <div class="name">${esc(item.nome)}</div>
      ${item.detalhe ? `<div class="hint">${esc(item.detalhe)}</div>` : ""}
      <div class="meta">${tags.join("")}</div>
    </div>
    <div class="value">${money(item.valor, true)}</div>
  </li>`;
}

// Aviso rápido no topo da tela (some sozinho)
export function toast(msg) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
