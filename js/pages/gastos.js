// =========================================================
// GASTOS — seção da página Minhas contas.
// Registrar o que saiu (de um banco ou cartão) e ver os gastos do período.
// No cartão, o gasto vira compra e aumenta o saldo usado.
// No banco, o saldo da conta desconta o gasto.
// =========================================================
import { CATEGORIAS, nomeCat, somaGastos, gastosDaSemana, gastosDoMes, porCategoria, CONTA, meiosDePagamento, ehCartao, disponivel } from "../core/gastos.js";
import { saldoBanco } from "../core/bancos.js";
import { bancosDe } from "../core/gastos.js";
import { addMov, removeMov } from "../core/config.js";
import { toISO, fromISO, addDays, nextPayday, pagamentoAnterior, periodo, getCiclo } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { card, field, select, esc, toast } from "../components/ui.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (iso) => { const d = fromISO(iso); return `${DIAS[d.getDay()]} ${shortDate(d)}`; };
const PREV = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>`;
const NEXT = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>`;

// Nome do banco/cartão de um gasto
function nomeMeio(seed, state, id) {
  id = id || CONTA;
  const c = seed.cartoes.find((x) => x.id === id);
  if (c) return c.nome;
  return bancosDe(state).find((b) => b.id === id)?.banco || id;
}
function notaMeio(seed, state, id) {
  const c = seed.cartoes.find((x) => x.id === id);
  if (c) return `Usado ${money(c.saldo, true)} de ${money(c.limite, true)} · disponível ${money(disponivel(c), true)}`;
  const b = bancosDe(state).find((x) => x.id === id);
  const s = b && saldoBanco(state, b);
  return s != null ? `Saldo na conta: ${money(s, true)}` : "";
}

// Botão + formulário (fica no topo da página)
export function gastoFormHtml(ctx) {
  const { seed, state } = ctx;
  if (!ctx.gastoAberto) return `<button class="btn primary add-btn" id="g-abrir">+ Adicionar</button>`;
  const draft = ctx.gastoDraft || { data: toISO(new Date()), cat: "alimentacao", conta: bancosDe(state)[0].id };
  return `<form class="card" id="gasto" novalidate>
      <div class="card-head"><h2>Novo gasto</h2><button class="link" type="button" id="g-fechar">fechar</button></div>
      <div class="fields stack">
        ${field({ id: "g-valor", name: "valor", label: "Valor", value: draft.valor, prefix: "$", placeholder: "0,00" })}
        ${field({ id: "g-desc", name: "desc", label: "O que foi", type: "text", value: draft.desc })}
        ${select({ id: "g-conta", label: "Pago com", options: meiosDePagamento(seed, state), value: draft.conta, note: notaMeio(seed, state, draft.conta) })}
        ${select({ id: "g-cat", label: "Categoria", options: CATEGORIAS, value: draft.cat })}
        ${field({ id: "g-data", name: "data", label: "Data", type: "date", value: draft.data })}
      </div>
      <p class="preview" id="g-msg"></p>
      <button class="btn primary" type="submit">Salvar gasto</button>
    </form>`;
}

// Lista do período + resumo do mês (fica embaixo das contas)
export function gastosListaHtml(ctx) {
  const { seed, state } = ctx;
  if (!ctx.payday) ctx.payday = nextPayday();
  const iso = toISO(ctx.payday);
  const hoje = new Date();
  const sem = gastosDaSemana(state, iso);
  const mes = gastosDoMes(state, hoje.getFullYear(), hoje.getMonth());
  const alim = (seed.semanais || []).find((s) => s.id === "vida");
  const alimPlano = alim ? alim.valor * (periodo(ctx.payday).dias / 7) : 0;
  const alimGasto = somaGastos(sem.filter((g) => g.cat === "alimentacao"));
  const ini = pagamentoAnterior(ctx.payday), fim = addDays(ctx.payday, -1);

  const linhas = sem.map((g) => `<li class="reg">
    <span class="reg-dia">${diaCurto(g.data)}</span>
    <span class="reg-info">${g.desc ? `${esc(g.desc)}<small> · ${esc(nomeCat(g.cat))}</small>` : esc(nomeCat(g.cat))}<small> · ${esc(nomeMeio(seed, state, g.conta))}</small></span>
    <span class="reg-val">−${money(Number(g.valor), true)}</span>
    <button class="link" data-delg="${esc(g.id)}">apagar</button></li>`).join("");
  const cats = porCategoria(mes).map((c) => `<li><span>${esc(c.label)}</span><span>${money(c.valor, true)}</span></li>`).join("");

  return `
    <section class="card">
      <div class="card-head"><h2>Meus gastos</h2><span class="total">${money(somaGastos(sem), true)}</span></div>
      <div class="mini-nav">
        <button class="btn icon" data-week="-1" aria-label="Período anterior">${PREV}</button>
        <span>${shortDate(ini)} – ${shortDate(fim)}</span>
        <button class="btn icon" data-week="1" aria-label="Próximo período">${NEXT}</button>
      </div>
      ${alimPlano ? `<p class="hint">Alimentação: ${money(alimGasto, true)} de ${money(alimPlano, true)} planejados${alimGasto > alimPlano ? " · passei do plano" : ""}</p>` : ""}
      ${linhas ? `<ul class="regs">${linhas}</ul>` : `<p class="hint">Nenhum gasto neste período.</p>`}
    </section>
    ${card({ title: `Gastos de ${MESES[hoje.getMonth()]}`, total: money(somaGastos(mes), true), body: cats ? `<ul class="cat-list">${cats}</ul>` : `<p class="hint">Sem gastos no mês.</p>` })}`;
}

export function bindGastos(root, ctx) {
  const { seed, state, persist } = ctx;
  const abrir = root.querySelector("#g-abrir");
  if (abrir) abrir.onclick = () => { ctx.gastoAberto = true; ctx.rerender(); root.querySelector("#g-valor")?.focus(); };

  const form = root.querySelector("#gasto");
  if (form) {
    form.querySelector("#g-fechar").onclick = () => { ctx.gastoAberto = false; ctx.rerender(); };
    const lerDraft = () => ({ ...Object.fromEntries(new FormData(form)), cat: form.querySelector("#g-cat").value, conta: form.querySelector("#g-conta").value });
    form.addEventListener("input", () => { ctx.gastoDraft = lerDraft(); });
    form.querySelector("#g-conta").addEventListener("change", (e) => {
      ctx.gastoDraft = lerDraft();
      e.target.closest(".field").querySelector(".note").textContent = notaMeio(seed, state, e.target.value);
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const cat = form.querySelector("#g-cat").value;
      const meio = form.querySelector("#g-conta").value;
      if (!d.data || !(Number(d.valor) > 0)) { root.querySelector("#g-msg").innerHTML = `<span class="status warn">Preencha o valor e a data.</span>`; return; }
      const g = { id: "s" + Date.now().toString(36), data: d.data, valor: Number(d.valor), desc: d.desc || "", cat, conta: meio, ts: Date.now() };
      state.gastos = [...(state.gastos || []), g];
      if (ehCartao(seed, meio)) addMov(state, { id: `gs:${g.id}`, cartao: meio, tipo: "compra", valor: g.valor, data: g.data, desc: g.desc || nomeCat(cat) });
      ctx.gastoDraft = { data: d.data, cat, conta: meio };
      ctx.gastoAberto = false;
      persist(); ctx.rerender();
      toast("Salvo ✓");
    });
  }

  root.querySelectorAll("[data-delg]").forEach((b) => {
    b.onclick = () => {
      state.gastos = state.gastos.filter((g) => g.id !== b.dataset.delg);
      removeMov(state, `gs:${b.dataset.delg}`);
      persist(); ctx.rerender();
    };
  });
}
