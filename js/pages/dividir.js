// =========================================================
// PÁGINA DIVIDIR — um cartão por pessoa com quem eu divido.
// Pessoa só com o nome (fica na minha carteira) ou ligada a um @
// (aparece na carteira dela também). Nas minhas contas eu marco,
// semana a semana, se foi dividido ou se paguei sozinha.
// As duas pessoas podem registrar pagamentos.
// =========================================================
import { syncNote } from "../core/sync.js";
import { backend } from "../core/backend.js";
import { receberHtml, bindReceber } from "./receber.js";
import { parte, salvarParte } from "../core/config.js";
import { rede, carregarRede, aceitas } from "../core/rede.js";
import { pessoas, cartoes, extrato, contasDivididas, ocorrencias, publicarLivros, registrarPagamento, apagarPagamento } from "../core/divisao.js";
import { toISO, fromISO, nextPayday, pagamentoAnterior } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, select, segmented, chip, esc, toast } from "../components/ui.js";
import { weekNav, bindWeekNav } from "../components/weekNav.js";

const FREQ = [{ id: "semanal", label: "Semanal" }, { id: "mensal", label: "Mensal" }, { id: "trimestral", label: "A cada 3 meses" }];
const FREQ_TXT = { semanal: "por semana", mensal: "por mês", trimestral: "a cada 3 meses" };
const novoId = (p) => p + Date.now().toString(36);
const ui = (ctx) => (ctx.dv ||= {});

export function renderDividir(root, ctx) {
  const { state } = ctx;
  if (!ctx.payday) ctx.payday = nextPayday();
  carregarRede(ctx);
  const r = rede(ctx);
  const v = ui(ctx);
  const fim = toISO(ctx.payday), ini = toISO(pagamentoAnterior(ctx.payday));
  const naSemana = (data) => data > ini && data <= fim;
  const hoje = toISO(new Date());
  const lista = cartoes(ctx);

  const pessoaCard = (card) => {
    const { mov, saldo } = extrato(ctx, card);
    const k = card.chave;
    const minhas = card.pessoa ? contasDivididas(ctx).filter((c) => c.pessoa === card.pessoa.id) : [];
    const livroDela = card.userId ? r.itens.find((it) => it.tipo === "divisao" && it.dono === card.userId && it.com === ctx.userId) : null;

    // Esta semana: minhas contas (eu marco) e as dela (só vejo)
    const semMinhas = minhas.flatMap((c) => ocorrencias(state, c).filter((o) => naSemana(o.data)).map((o) => `<li class="share">
        <div><div class="name">${esc(c.nome)}</div><div class="hint">total ${money(o.total, true)} · ${o.sozinha ? "paguei sozinha" : `${esc(card.nome)} me deve ${money(o.parte, true)}`}</div></div>
        <button class="toggle ${o.sozinha ? "on" : ""}" data-dv-toggle="${esc(o.key)}|${esc(c.id)}" aria-pressed="${o.sozinha}">${o.sozinha ? "Paguei sozinha" : "Dividido"}</button>
      </li>`)).join("");
    const semDela = ((livroDela && livroDela.dados && livroDela.dados.linhas) || []).filter((l) => naSemana(l.data)).map((l) => `<li class="share">
        <div><div class="name">${esc(l.nome)}</div><div class="hint">total ${money(l.total, true)} · ${l.sozinha ? `${esc(card.nome)} pagou sozinha` : `devo ${money(l.parte, true)}`}</div></div>
        ${chip(l.sozinha ? "pago" : "dividido", l.sozinha ? "ok" : "plan")}
      </li>`).join("");

    const hist = mov.slice(0, 40).map((m) => `<li class="reg">
        <span class="reg-dia">${m.data ? shortDate(fromISO(m.data)) : ""}</span>
        <span class="reg-info">${esc(m.desc)}${m.tipo === "sozinha" ? " · paguei sozinha" : m.tipo === "sozinha-dela" ? " · pago por ela" : ""}</span>
        <span class="reg-val ${m.valor < 0 && m.tipo === "pagamento" ? "ok" : ""}">${m.valor === 0 ? "—" : `${m.valor > 0 ? "+" : "−"}${money(Math.abs(m.valor), true)}`}</span>
        <span>${m.tipo === "pagamento" && m.meu ? `<button class="link danger" data-dv-rmpg='${esc(JSON.stringify(m.ref))}'>apagar</button>` : ""}</span>
      </li>`).join("");

    const dividas = mov.filter((m) => m.tipo === "divida").map((m) => `<li class="share">
        <div><div class="name">${esc(m.desc)}</div><div class="hint">${m.valor > 0 ? `${esc(card.nome)} me deve` : "eu devo"} ${money(Math.abs(m.valor), true)}</div></div>
        ${m.ref.local || m.meu ? `<button class="link danger" data-dv-rmdiv='${esc(JSON.stringify(m.ref))}'>remover</button>` : ""}
      </li>`).join("");
    const contasLista = minhas.map((c) => `<li class="share">
        <div><div class="name">${esc(c.nome)}</div><div class="meta">${chip(`${money(Number(c.valor), true)} ${FREQ_TXT[c.freq] || ""}`)}${chip(`desde ${shortDate(fromISO(c.desde))}`)}</div></div>
        <button class="link danger" data-dv-rmconta="${esc(c.origem)}|${esc(c.id)}">remover</button>
      </li>`).join("");

    const livres = aceitas(ctx).filter((c) => !pessoas(state).some((p) => p.userId === c.outro));
    const valorPadrao = Math.abs(saldo) || "";
    const formPagar = v.pagar === k ? `<form class="dv-form" data-dv-pagar="${esc(k)}" novalidate>
        ${segmented({ name: "dir", label: "O que aconteceu", options: [{ id: "recebi", label: `${card.nome} me pagou` }, { id: "paguei", label: `Paguei ${card.nome}` }], value: saldo < 0 ? "paguei" : "recebi" })}
        <div class="fields">
          ${field({ id: `dvv-${k}`, name: "valor", label: "Valor", value: valorPadrao, prefix: "$" })}
          ${field({ id: `dvd-${k}`, name: "data", label: "Quando", type: "date", value: hoje })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-dv-fechar>Cancelar</button></div>
      </form>` : "";
    const formConta = v.conta === k ? `<form class="dv-form" data-dv-conta="${esc(k)}" novalidate>
        <div class="fields stack">
          ${field({ id: `dcn-${k}`, name: "nome", label: "Conta", type: "text" })}
          ${field({ id: `dcv-${k}`, name: "valor", label: "Valor total", prefix: "$", placeholder: "0,00" })}
          ${select({ id: `dcf-${k}`, label: "Frequência", options: FREQ, value: "semanal" })}
          ${field({ id: `dcd-${k}`, name: "desde", label: "A partir de", type: "date", value: hoje })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button><button class="btn" type="button" data-dv-fechar>Cancelar</button></div>
      </form>` : "";
    const formDivida = v.divida === k ? `<form class="dv-form" data-dv-divida="${esc(k)}" novalidate>
        ${segmented({ name: "tipo", label: "Quem deve", options: [{ id: "me_deve", label: `${card.nome} me deve` }, { id: "eu_devo", label: "Eu devo" }], value: "me_deve" })}
        <div class="fields stack">
          ${field({ id: `ddn-${k}`, name: "nome", label: "O que é", type: "text" })}
          ${field({ id: `ddv-${k}`, name: "valor", label: "Valor", prefix: "$", placeholder: "0,00" })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button><button class="btn" type="button" data-dv-fechar>Cancelar</button></div>
      </form>` : "";

    return `<section class="card pessoa">
      <div class="card-head"><h2>${esc(card.nome)}</h2><span class="total">${saldo > 0 ? `me deve ${money(saldo, true)}` : saldo < 0 ? `eu devo ${money(-saldo, true)}` : "tudo certo"}</span></div>
      ${semMinhas || semDela ? `<ul class="shares">${semMinhas}${semDela}</ul>` : `<p class="hint">Nada dividido nesta semana.</p>`}
      ${formPagar || `<button class="btn primary add-btn" data-dv-abrir="pagar|${esc(k)}">Registrar pagamento</button>`}

      <details class="sub" ${v.hist === k ? "open" : ""} data-dv-det="hist|${esc(k)}">
        <summary>Histórico</summary>
        ${hist ? `<ul class="regs">${hist}</ul>` : `<p class="hint">Nada ainda.</p>`}
      </details>

      <details class="sub" ${v.cfg === k || v.conta === k || v.divida === k ? "open" : ""} data-dv-det="cfg|${esc(k)}">
        <summary>Contas e dívidas</summary>
        ${contasLista || dividas ? `<ul class="shares">${contasLista}${dividas}</ul>` : `<p class="hint">Nenhuma conta ou dívida.</p>`}
        ${formConta || formDivida || `<div class="inline-btns">
          <button class="btn primary add-btn" data-dv-abrir="conta|${esc(k)}">+ Conta</button>
          <button class="btn primary add-btn" data-dv-abrir="divida|${esc(k)}">+ Dívida</button></div>`}
        ${card.pessoa && !card.userId && livres.length ? `<form class="dv-link" data-dv-vincular="${esc(card.pessoa.id)}">
          ${select({ id: `dvl-${k}`, label: "Vincular a um @", options: livres.map((c) => ({ id: c.outro, label: `@${c.usuario}` })), value: livres[0].outro })}
          <button class="btn" type="submit">Vincular</button></form>` : ""}
        ${card.pessoa ? `<button class="link danger" data-dv-rmpessoa="${esc(card.pessoa.id)}">remover ${esc(card.nome)}</button>` : ""}
      </details>
    </section>`;
  };

  const livresNova = aceitas(ctx).filter((c) => !pessoas(state).some((p) => p.userId === c.outro));
  const opcoesNova = [...livresNova.map((c) => ({ id: c.outro, label: `@${c.usuario}` })), { id: "__nome", label: "Outra pessoa (só o nome)" }];
  const semPessoas = !pessoas(state).length;
  const formPessoa = v.novaPessoa || !lista.length || (semPessoas && contasDivididas(ctx).length) ? `<section class="card">
      <div class="card-head"><h2>Com quem eu divido</h2></div>
      ${semPessoas && contasDivididas(ctx).length ? `<p class="hint">Minhas contas divididas passam para essa pessoa.</p>` : ""}
      <form id="dv-pessoa" novalidate>
        <div class="fields stack">
          ${select({ id: "dvp-quem", label: "Pessoa", options: opcoesNova, value: opcoesNova[0].id })}
          ${field({ id: "dvp-nome", name: "nome", label: "Nome (se não tem @)", type: "text" })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button>${lista.length ? `<button class="btn" type="button" id="dvp-cancel">Cancelar</button>` : ""}</div>
      </form>
    </section>` : `<button class="btn primary add-btn" id="dvp-abrir">+ Pessoa</button>`;

  root.innerHTML = `
    ${weekNav(ctx.payday, "Dividir")}
    ${!r.carregado ? `<p class="hint">Carregando…</p>` : ""}
    ${lista.map(pessoaCard).join("")}
    ${formPessoa}
    ${receberHtml(ctx)}
    ${syncNote(ctx)}
  `;

  bindReceber(root, ctx);
  bindWeekNav(root, ctx);
  bindDividir(root, ctx, lista);
  publicarLivros(ctx);
}

function bindDividir(root, ctx, lista) {
  const { state } = ctx;
  const v = ui(ctx);
  const cardDe = (k) => lista.find((c) => c.chave === k);
  const salvar = () => { ctx.persist(); ctx.rerender(); };
  const fechar = () => { v.pagar = v.conta = v.divida = null; };

  root.querySelectorAll("[data-dv-abrir]").forEach((b) => (b.onclick = () => {
    const [o, k] = b.dataset.dvAbrir.split("|"); fechar(); v[o] = k; ctx.rerender();
  }));
  root.querySelectorAll("[data-dv-fechar]").forEach((b) => (b.onclick = () => { fechar(); ctx.rerender(); }));
  root.querySelectorAll("[data-dv-det]").forEach((d) => d.addEventListener("toggle", () => {
    const [o, k] = d.dataset.dvDet.split("|");
    if (d.open) v[o] = k; else if (v[o] === k) v[o] = null;
  }));

  // Dividido ↔ Paguei sozinha
  root.querySelectorAll("[data-dv-toggle]").forEach((b) => (b.onclick = () => {
    const [key, id] = b.dataset.dvToggle.split("|");
    const sem = { ...((state.compart || {})[key] || {}) };
    if (sem[id] === "sozinha") delete sem[id]; else sem[id] = "sozinha";
    state.compart = { ...(state.compart || {}), [key]: sem };
    salvar();
  }));

  root.querySelectorAll("[data-dv-pagar]").forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const valor = Number(f.valor.value), data = f.data.value;
    const dir = f.querySelector('input[name="dir"]:checked').value;
    if (!(valor > 0) || !data) return;
    try { await registrarPagamento(ctx, cardDe(f.dataset.dvPagar), dir, valor, data); fechar(); ctx.rerender(); toast("Salvo ✓"); }
    catch (err) { console.error(err); toast("Não consegui salvar"); }
  }));
  root.querySelectorAll("[data-dv-rmpg]").forEach((b) => (b.onclick = async () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    try { await apagarPagamento(ctx, JSON.parse(b.dataset.dvRmpg)); ctx.rerender(); } catch { toast("Não consegui apagar"); }
  }));

  // Pessoa nova (rede ou só o nome). A primeira fica com as contas que já existem.
  const garantirPessoa = (card) => {
    if (card.pessoa) return card.pessoa;
    const p = { id: novoId("pe-"), nome: card.nome, userId: card.userId, inicio: toISO(new Date()) };
    state.pessoas = [...pessoas(state), p];
    return p;
  };
  root.querySelectorAll("[data-dv-conta]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const card = cardDe(f.dataset.dvConta);
    const nome = f.nome.value.trim(), valor = Number(f.valor.value), desde = f.desde.value || toISO(new Date());
    const freq = f.querySelector("select").value;
    if (!nome || !(valor > 0)) return;
    const p = garantirPessoa(card);
    if (freq === "semanal") salvarParte(state, "semanais", [...parte(state, "semanais"), { id: novoId("u-"), nome, valor, grupo: "vida", compartilhado: true, pessoa: p.id, desde }]);
    else salvarParte(state, "compartilhadas", [...parte(state, "compartilhadas"), { id: novoId("c-"), nome, valor, freq, pessoa: p.id, desde }]);
    fechar(); salvar();
  }));
  root.querySelectorAll("[data-dv-rmconta]").forEach((b) => (b.onclick = () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    const [origem, id] = b.dataset.dvRmconta.split("|");
    if (origem === "semanais") salvarParte(state, "semanais", parte(state, "semanais").map((s) => (s.id === id ? { ...s, compartilhado: false } : s)).filter((s) => s.id !== id || !s.id.startsWith("u-")));
    else salvarParte(state, "compartilhadas", parte(state, "compartilhadas").filter((c) => c.id !== id));
    salvar();
  }));

  root.querySelectorAll("[data-dv-divida]").forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const card = cardDe(f.dataset.dvDivida);
    const nome = f.nome.value.trim(), valor = Number(f.valor.value);
    const tipo = f.querySelector('input[name="tipo"]:checked').value;
    if (!nome || !(valor > 0)) return;
    try {
      if (card.userId) {
        await backend.compartilhar({ com: card.userId, tipo, nome, valor, freq: "unica", pagamentos: [], dados: {} });
        fechar(); await carregarRede(ctx, true);
      } else {
        state.dividasP = [...(state.dividasP || []), { id: novoId("dv-"), pessoa: card.pessoa.id, tipo, nome, valor, data: toISO(new Date()) }];
        fechar(); salvar();
      }
    } catch (err) { toast(err.message || "Não consegui salvar"); }
  }));
  root.querySelectorAll("[data-dv-rmdiv]").forEach((b) => (b.onclick = async () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    const ref = JSON.parse(b.dataset.dvRmdiv);
    if (ref.local) { state.dividasP = (state.dividasP || []).filter((d) => d.id !== ref.local); salvar(); return; }
    try { await backend.apagarCompartilhado(ref.row); await carregarRede(ctx, true); } catch { toast("Não consegui remover"); }
  }));

  // Vincular pessoa offline a um @: o que estava só comigo vai para o Supabase
  root.querySelectorAll("[data-dv-vincular]").forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = f.dataset.dvVincular, userId = f.querySelector("select").value;
    const p = pessoas(state).find((x) => x.id === id);
    const card = { chave: `u:${userId}`, pessoa: { ...p, userId }, userId };
    try {
      for (const d of (state.dividasP || []).filter((x) => x.pessoa === id))
        await backend.compartilhar({ com: userId, tipo: d.tipo, nome: d.nome, valor: d.valor, freq: "unica", pagamentos: [], dados: {} });
      state.pessoas = pessoas(state).map((x) => (x.id === id ? { ...x, userId } : x));
      await carregarRede(ctx, true);
      await publicarLivros(ctx);
      for (const pg of (state.pagDivisao || []).filter((x) => x.pessoa === id)) await registrarPagamento(ctx, card, pg.dir, pg.valor, pg.data);
      state.dividasP = (state.dividasP || []).filter((x) => x.pessoa !== id);
      state.pagDivisao = (state.pagDivisao || []).filter((x) => x.pessoa !== id);
      salvar(); toast("Vinculado ✓");
    } catch (err) { console.error(err); toast("Não consegui vincular"); }
  }));
  root.querySelectorAll("[data-dv-rmpessoa]").forEach((b) => (b.onclick = () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    state.pessoas = pessoas(state).filter((p) => p.id !== b.dataset.dvRmpessoa);
    salvar();
  }));

  const abrir = root.querySelector("#dvp-abrir");
  if (abrir) abrir.onclick = () => { v.novaPessoa = true; ctx.rerender(); };
  const cancel = root.querySelector("#dvp-cancel");
  if (cancel) cancel.onclick = () => { v.novaPessoa = false; ctx.rerender(); };
  const fp = root.querySelector("#dv-pessoa");
  if (fp) fp.addEventListener("submit", (e) => {
    e.preventDefault();
    const quem = fp.querySelector("#dvp-quem").value;
    const con = aceitas(ctx).find((c) => c.outro === quem);
    const nome = con ? `@${con.usuario}` : fp.nome.value.trim();
    if (!nome) return;
    const primeira = !pessoas(state).length;
    const p = { id: novoId("pe-"), nome, inicio: toISO(new Date()), ...(con ? { userId: con.outro } : {}) };
    state.pessoas = [...pessoas(state), p];
    if (primeira) {
      // As contas que já estavam aqui passam a ser com essa pessoa, a partir de hoje
      salvarParte(state, "semanais", parte(state, "semanais").map((s) => (s.compartilhado && !s.pessoa ? { ...s, pessoa: p.id, desde: s.desde || p.inicio } : s)));
      salvarParte(state, "compartilhadas", parte(state, "compartilhadas").map((c) => (!c.pessoa ? { ...c, pessoa: p.id, desde: c.desde || p.inicio } : c)));
    }
    v.novaPessoa = false;
    salvar();
  });
}
