// =========================================================
// PAGAMENTOS FUTUROS (Ajustes → Minhas contas) — compras e reservas
// pagas em partes até uma data (ex.: Airbnb). Cada parte cai em um
// pagamento meu. Aparecem na Hoje na semana de cada parte.
//   config.pedidos: [{ id, nome, vence, parcelas: { [pagamento ISO]: valor } }]
// =========================================================
import { parte, salvarParte } from "../core/config.js";
import { toISO, fromISO, proximoPagamento, pagamentoSeguinte, pagamentoAnterior } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, select, esc, toast } from "../components/ui.js";

const r2 = (v) => Math.round(v * 100) / 100;
const totalDe = (p) => r2(Object.values(p.parcelas || {}).reduce((a, v) => a + (Number(v) || 0), 0));

// Pagamentos para escolher: 4 para trás e 26 para frente (e os que já estão no item)
function opcoesPagamento(extra = []) {
  let p = proximoPagamento(new Date());
  for (let k = 0; k < 4; k++) p = pagamentoAnterior(p);
  const l = [];
  for (let k = 0; k < 31; k++, p = pagamentoSeguinte(p)) l.push(toISO(p));
  return [...new Set([...extra, ...l])].sort().map((iso) => ({ id: iso, label: shortDate(fromISO(iso)) }));
}

export function futurosHtml(ctx) {
  const { state } = ctx;
  const lista = parte(state, "pedidos");
  const ed = ctx.futEdit; // id ou "novo"
  const rascunho = ctx.futRasc;

  const form = (p) => {
    const linhas = p.linhas;
    const ops = opcoesPagamento(linhas.map((l) => l.iso));
    return `<form class="ent-cad fut-form" id="fut-form" data-id="${esc(p.id || "")}" novalidate>
      <div class="fields stack">
        ${field({ id: "fut-nome", name: "nome", label: "Nome", type: "text", value: p.nome || "", placeholder: "Ex.: Airbnb, viagem, presente" })}
        ${field({ id: "fut-vence", name: "vence", label: "Precisa estar pago até", type: "date", value: p.vence || "" })}
      </div>
      <h4 class="sub-h">Partes (em qual pagamento · quanto)</h4>
      <div class="fut-partes">${linhas.map((l, k) => `<div class="fut-parte">
          ${select({ id: `fut-iso-${k}`, label: "", options: ops, value: l.iso, attrs: `data-fut-iso="${k}"` })}
          ${field({ id: `fut-val-${k}`, label: "", value: l.valor, prefix: "$", placeholder: "0,00", attrs: `data-fut-val="${k}"` })}
          <button class="btn icon" type="button" data-fut-rm-parte="${k}" aria-label="Tirar parte">✕</button>
        </div>`).join("")}</div>
      <button class="link" type="button" id="fut-add-parte">+ parte</button>
      <p class="hint">Total ${money(r2(linhas.reduce((a, l) => a + (Number(l.valor) || 0), 0)), true)}</p>
      <div class="inline-btns">
        <button class="btn primary" type="submit">Salvar</button>
        <button class="btn" type="button" id="fut-cancel">Cancelar</button>
        ${p.id ? `<button class="link danger" type="button" id="fut-del">remover</button>` : ""}
      </div>
    </form>`;
  };

  const linha = (p) => ed === p.id ? form(rascunho) : `<li class="share">
      <div><div class="name">${esc(p.nome)}</div>
        <div class="hint">${Object.entries(p.parcelas || {}).sort().map(([iso, v]) => `${shortDate(fromISO(iso))} ${money(Number(v), true)}`).join(" · ")}${p.vence ? ` · até ${shortDate(fromISO(p.vence))}` : ""}</div></div>
      <div class="ent-dir"><b>${money(totalDe(p), true)}</b><button class="link" data-fut-edit="${esc(p.id)}">editar</button></div>
    </li>`;

  return `<div class="sub-sec">
    ${lista.length ? `<ul class="shares">${lista.map(linha).join("")}</ul>` : `<p class="hint">Reservas e compras que pago em partes até uma data.</p>`}
    ${ed === "novo" ? form(rascunho) : ed ? "" : `<button class="btn primary add-btn" id="fut-novo">+ Adicionar</button>`}
  </div>`;
}

export function bindFuturos(root, ctx) {
  const { state, persist } = ctx;
  const abrir = (id) => {
    const p = id === "novo" ? { nome: "", vence: "", parcelas: {} } : parte(state, "pedidos").find((x) => x.id === id);
    const linhas = Object.entries(p.parcelas || {}).sort().map(([iso, valor]) => ({ iso, valor }));
    if (!linhas.length) linhas.push({ iso: toISO(proximoPagamento(new Date())), valor: "" });
    ctx.futEdit = id; ctx.futRasc = { ...p, linhas }; ctx.openSec = "contas"; ctx.rerender();
  };
  const fechar = () => { ctx.futEdit = null; ctx.futRasc = null; ctx.openSec = "contas"; };
  const nv = root.querySelector("#fut-novo");
  if (nv) nv.onclick = () => abrir("novo");
  root.querySelectorAll("[data-fut-edit]").forEach((b) => (b.onclick = () => abrir(b.dataset.futEdit)));
  const f = root.querySelector("#fut-form");
  if (!f) return;
  const r = ctx.futRasc;
  // Guardo o que foi digitado antes de redesenhar (adicionar/tirar parte)
  const ler = () => {
    r.nome = f.nome.value; r.vence = f.vence.value;
    r.linhas = r.linhas.map((l, k) => ({ iso: f.querySelector(`[data-fut-iso="${k}"]`).value, valor: f.querySelector(`[data-fut-val="${k}"]`).value }));
  };
  f.querySelector("#fut-add-parte").onclick = () => {
    ler();
    const ult = r.linhas.length ? fromISO(r.linhas[r.linhas.length - 1].iso) : proximoPagamento(new Date());
    r.linhas.push({ iso: toISO(r.linhas.length ? pagamentoSeguinte(ult) : ult), valor: "" });
    ctx.rerender();
  };
  f.querySelectorAll("[data-fut-rm-parte]").forEach((b) => (b.onclick = () => { ler(); r.linhas.splice(Number(b.dataset.futRmParte), 1); ctx.rerender(); }));
  f.querySelector("#fut-cancel").onclick = () => { fechar(); ctx.rerender(); };
  const del = f.querySelector("#fut-del");
  if (del) del.onclick = () => {
    if (!del.dataset.confirma) { del.dataset.confirma = "1"; del.textContent = "confirmar"; return; }
    salvarParte(state, "pedidos", parte(state, "pedidos").filter((x) => x.id !== f.dataset.id));
    fechar(); persist(); ctx.rerender();
  };
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    ler();
    if (!r.nome.trim()) return toast("Dê um nome");
    const parcelas = {};
    r.linhas.forEach((l) => { const v = Number(String(l.valor).replace(",", ".")); if (v > 0) parcelas[l.iso] = r2((parcelas[l.iso] || 0) + v); });
    if (!Object.keys(parcelas).length) return toast("Coloque o valor de pelo menos uma parte");
    const ultimo = Object.keys(parcelas).sort().pop();
    const item = { id: f.dataset.id || "ped-" + Date.now().toString(36), nome: r.nome.trim(), vence: r.vence || ultimo, parcelas };
    const lista = parte(state, "pedidos");
    salvarParte(state, "pedidos", f.dataset.id ? lista.map((x) => (x.id === item.id ? { ...x, ...item } : x)) : [...lista, item]);
    fechar(); persist(); ctx.rerender(); toast("Salvo ✓");
  });
}
