// =========================================================
// COMPARTILHADOS (Dividir) — contas e dívidas com minhas conexões.
// Aparecem nas duas carteiras. "Me deve" do meu lado vira "Eu devo"
// do lado da outra pessoa. Pagamentos ficam registrados para as duas.
// =========================================================
import { backend } from "../core/backend.js";
import { rede, carregarRede, aceitas, arroba, pago } from "../core/rede.js";
import { toISO, fromISO } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, select, segmented, chip, esc, toast } from "../components/ui.js";

const TIPOS = [{ id: "me_deve", label: "Me deve" }, { id: "eu_devo", label: "Eu devo" }, { id: "conta", label: "Conta dividida" }];
const FREQ = [{ id: "unica", label: "Uma vez" }, { id: "mensal", label: "Todo mês" }, { id: "trimestral", label: "A cada 3 meses" }];
const FREQ_TXT = { unica: "", mensal: "por mês", trimestral: "a cada 3 meses" };

export function compartilhadosHtml(ctx) {
  const r = rede(ctx);
  if (!r.carregado) carregarRede(ctx);
  const eu = ctx.userId;
  const hoje = toISO(new Date());
  const cards = r.itens.map((it) => {
    const outro = it.dono === eu ? it.com : it.dono;
    const quem = `@${esc(arroba(ctx, outro))}`;
    const pagos = (it.pagamentos || []).map((p) => `<li>${money(Number(p.valor), true)} em ${shortDate(fromISO(p.data))}</li>`).join("");
    const aberto = ctx.cpAberto === it.id;
    if (it.tipo === "conta") {
      return `<li class="debt receber"><div class="debt-main">
        <div class="debt-top"><span class="name">${esc(it.nome)}</span><span class="value">${money(Number(it.valor) / 2, true)}</span></div>
        <div class="meta">${chip(`com ${quem}`, "plan")}${chip(`total ${money(Number(it.valor), true)}${FREQ_TXT[it.freq] ? ` ${FREQ_TXT[it.freq]}` : ""}`)}</div>
        ${it.dono === eu ? `<div class="row-actions"><button class="link danger" data-cp-rm="${it.id}">remover</button></div>` : ""}
      </div></li>`;
    }
    // Dívida: "me deve" do meu lado vira "eu devo" do outro
    const meDeve = (it.tipo === "me_deve") === (it.dono === eu);
    const falta = Math.max(0, Number(it.valor) - pago(it));
    return `<li class="debt receber"><div class="debt-main">
      <div class="debt-top"><span class="name">${esc(it.nome)}</span><span class="value">${money(falta, true)}</span></div>
      <div class="meta">${chip(meDeve ? `${quem} me deve` : `devo a ${quem}`, meDeve ? "ok" : "miss")}${falta <= 0 ? chip("quitado ✓", "ok") : ""}</div>
      <div class="track thin"><div class="fill" style="width:${Number(it.valor) ? (pago(it) / Number(it.valor)) * 100 : 0}%"></div></div>
      <div class="hint">pago ${money(pago(it), true)} de ${money(Number(it.valor), true)}</div>
      ${pagos ? `<ul class="mini">${pagos}</ul>` : ""}
      ${aberto ? `<form class="inline rec-form" data-cp-form="${it.id}" novalidate>
          ${field({ id: `cpv-${it.id}`, name: "valor", label: meDeve ? "Quanto recebi" : "Quanto paguei", value: falta, prefix: "$" })}
          ${field({ id: `cpd-${it.id}`, name: "data", label: "Quando", type: "date", value: hoje })}
          <button class="btn primary" type="submit">Salvar</button>
        </form>` : ""}
      <div class="row-actions">
        ${falta > 0 ? `<button class="link" data-cp-pagar="${it.id}">${aberto ? "cancelar" : meDeve ? "Recebi" : "Paguei"}</button>` : ""}
        ${it.dono === eu ? `<button class="link danger" data-cp-rm="${it.id}">remover</button>` : ""}
      </div>
    </div></li>`;
  }).join("");

  const pessoas = aceitas(ctx).map((c) => ({ id: c.outro, label: `@${c.usuario}` }));
  const form = ctx.cpNovo && pessoas.length ? `<form id="cp-novo" novalidate>
      ${segmented({ name: "tipo", label: "O que é", options: TIPOS, value: "me_deve" })}
      <div class="fields stack">
        ${select({ id: "cp-com", label: "Com quem", options: pessoas, value: pessoas[0].id })}
        ${field({ id: "cp-nome", name: "nome", label: "O que é", type: "text" })}
        ${field({ id: "cp-valor", name: "valor", label: "Valor", prefix: "$", placeholder: "0,00" })}
        ${select({ id: "cp-freq", label: "Frequência (conta dividida)", options: FREQ, value: "unica" })}
      </div>
      <div class="inline-btns"><button class="btn primary" type="submit">Compartilhar</button><button class="btn" type="button" id="cp-cancel">Cancelar</button></div>
      <p class="preview" id="cp-msg"></p>
    </form>` : "";

  return `<section class="card">
    <div class="card-head"><h2>Com minhas conexões</h2></div>
    ${!r.carregado ? `<p class="hint">Carregando…</p>` : r.erro ? `<p class="hint">${esc(r.erro)}</p>`
      : r.itens.length ? `<ul class="debts">${cards}</ul>` : `<p class="hint">Nada compartilhado ainda.</p>`}
    ${r.carregado && !pessoas.length ? `<p class="hint">Adicione pessoas em Ajustes → Conexões.</p>` : form || (pessoas.length ? `<button class="btn primary add-btn" id="cp-abrir">+ Adicionar</button>` : "")}
  </section>`;
}

export function bindCompartilhados(root, ctx) {
  const { state } = ctx;
  const r = rede(ctx);
  const recarregar = async (t) => { await carregarRede(ctx, true); if (t) toast(t); };
  const abrir = root.querySelector("#cp-abrir");
  if (abrir) abrir.onclick = () => { ctx.cpNovo = true; ctx.rerender(); };
  const cancel = root.querySelector("#cp-cancel");
  if (cancel) cancel.onclick = () => { ctx.cpNovo = false; ctx.rerender(); };

  const f = root.querySelector("#cp-novo");
  if (f) f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = f.querySelector('input[name="tipo"]:checked').value;
    const com = f.querySelector("#cp-com").value;
    const nome = f.nome.value.trim(), valor = Number(f.valor.value);
    if (!nome || !(valor > 0)) { f.querySelector("#cp-msg").innerHTML = `<span class="status warn">Preencha o que é e o valor.</span>`; return; }
    try {
      await backend.compartilhar({ com, tipo, nome, valor, freq: tipo === "conta" ? f.querySelector("#cp-freq").value : "unica", pagamentos: [] });
      ctx.cpNovo = false;
      await recarregar("Compartilhado ✓");
    } catch (err) { f.querySelector("#cp-msg").innerHTML = `<span class="status warn">${esc(err.message)}</span>`; }
  });

  root.querySelectorAll("[data-cp-pagar]").forEach((b) => (b.onclick = () => { ctx.cpAberto = ctx.cpAberto === b.dataset.cpPagar ? null : b.dataset.cpPagar; ctx.rerender(); }));
  root.querySelectorAll("[data-cp-form]").forEach((fm) => fm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const it = r.itens.find((x) => x.id === fm.dataset.cpForm);
    const valor = Number(fm.valor.value), data = fm.data.value;
    if (!it || !(valor > 0) || !data) return;
    const meDeve = (it.tipo === "me_deve") === (it.dono === ctx.userId);
    try {
      await backend.atualizarCompartilhado(it.id, { pagamentos: [...(it.pagamentos || []), { valor, data, por: ctx.usuario }] });
      // Na minha carteira: recebi → entra como renda; paguei → vira gasto
      if (meDeve) state.recebimentos = [...(state.recebimentos || []), { id: "rc-" + Date.now().toString(36), receberId: `sh:${it.id}`, valor, data }];
      else state.gastos = [...(state.gastos || []), { id: "s" + Date.now().toString(36), data, valor, desc: it.nome, cat: "pessoas", conta: (state.bancos || [])[0]?.id || "citibank", ts: Date.now() }];
      ctx.cpAberto = null;
      ctx.persist();
      await recarregar("Salvo ✓");
    } catch { toast("Não consegui salvar"); }
  }));
  root.querySelectorAll("[data-cp-rm]").forEach((b) => (b.onclick = async () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    try { await backend.apagarCompartilhado(b.dataset.cpRm); await recarregar(); } catch { toast("Não consegui remover"); }
  }));
}
