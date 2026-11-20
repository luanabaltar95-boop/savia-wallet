// =========================================================
// PÁGINA DIVIDIR
//   + Adicionar conta (no topo): a conta pode ser com um @ ou só um nome
//   1. Contas divididas: todas, com Dividido / Paguei sozinha na semana
//   2. Saldo em aberto: quanto cada pessoa me deve (ou eu devo),
//      pagamentos (as duas pessoas registram), histórico e dívidas
// =========================================================
import { syncNote } from "../core/sync.js";
import { backend } from "../core/backend.js";
import { receberHtml, bindReceber } from "./receber.js";
import { parte, salvarParte } from "../core/config.js";
import { rede, carregarRede, aceitas, arroba } from "../core/rede.js";
import { pessoas, cartoes, extrato, contasDivididas, ocorrencias, publicarLivros, registrarPagamento, apagarPagamento } from "../core/divisao.js";
import { toISO, fromISO, nextPayday, pagamentoAnterior } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, select, segmented, chip, esc, toast } from "../components/ui.js";
import { weekNav, bindWeekNav } from "../components/weekNav.js";

const FREQ = [{ id: "semanal", label: "Semanal" }, { id: "mensal", label: "Mensal" }, { id: "trimestral", label: "A cada 3 meses" }];
const FREQ_TXT = { semanal: "por semana", mensal: "por mês", trimestral: "a cada 3 meses" };
const novoId = (p) => p + Date.now().toString(36);
const ui = (ctx) => (ctx.dv ||= {});
const btnRemover = (attr, val, txt = "remover") => `<button class="link danger" ${attr}="${esc(val)}">${txt}</button>`;

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
  const nomeDe = (pessoaId) => (pessoas(state).find((p) => p.id === pessoaId) || {}).nome;

  // Quem pode entrar numa conta: minhas pessoas, conexões ainda não usadas, ou um nome novo
  const livres = aceitas(ctx).filter((c) => !pessoas(state).some((p) => p.userId === c.outro));
  const opcoesQuem = [
    ...pessoas(state).map((p) => ({ id: `p:${p.id}`, label: p.nome })),
    ...livres.map((c) => ({ id: `u:${c.outro}`, label: `@${c.usuario}` })),
    { id: "novo", label: "Outra pessoa (só o nome)" },
  ];

  // ---- + Adicionar conta ----
  const topo = v.nova ? `<section class="card">
      <div class="card-head"><h2>Nova conta dividida</h2></div>
      <form id="dv-nova" novalidate>
        <div class="fields stack">
          ${field({ id: "dvn-nome", name: "nome", label: "Conta", type: "text" })}
          ${field({ id: "dvn-valor", name: "valor", label: "Valor total", prefix: "$", placeholder: "0,00" })}
          ${select({ id: "dvn-freq", label: "Frequência", options: FREQ, value: "semanal" })}
          ${field({ id: "dvn-desde", name: "desde", label: "A partir de", type: "date", value: hoje })}
          ${select({ id: "dvn-quem", label: "Com quem", options: opcoesQuem, value: opcoesQuem[0].id })}
          ${field({ id: "dvn-pessoa", name: "pessoa", label: "Nome da pessoa (se for outra)", type: "text" })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button><button class="btn" type="button" id="dvn-cancel">Cancelar</button></div>
      </form>
    </section>` : `<button class="btn primary add-btn" id="dvn-abrir">+ Adicionar conta</button>`;

  // ---- 1. Contas divididas ----
  const minhas = contasDivididas(ctx);
  const semPessoa = !pessoas(state).length;
  const linhaMinha = (c) => {
    const occ = ocorrencias(state, c).filter((o) => naSemana(o.data));
    const quem = semPessoa ? null : nomeDe(c.pessoa);
    const semana = occ.map((o) => `<div class="dv-semana">
        <span class="hint">${o.sozinha ? "esta semana: paguei sozinha" : `esta semana: ${esc(quem || "a pessoa")} deve ${money(o.parte, true)}`}</span>
        <button class="toggle ${o.sozinha ? "on" : ""}" data-dv-toggle="${esc(o.key)}|${esc(c.id)}" aria-pressed="${o.sozinha}">${o.sozinha ? "Paguei sozinha" : "Dividido"}</button>
      </div>`).join("");
    return `<li class="dv-conta">
      <div class="debt-top"><span class="name">${esc(c.nome)}</span><span class="value">${money(Number(c.valor), true)}</span></div>
      <div class="meta">${chip(FREQ_TXT[c.freq] || "")}${quem ? chip(`com ${quem}`, "plan") : chip("sem pessoa", "miss")}${chip(`minha parte ${money(Number(c.valor) / 2, true)}`)}</div>
      ${semana}
      <div class="row-actions">${btnRemover("data-dv-rmconta", `${c.origem}|${c.id}`)}</div>
    </li>`;
  };
  // Contas que outras pessoas dividem comigo (vêm do livro delas)
  const delas = r.itens.filter((it) => it.tipo === "divisao" && it.com === ctx.userId).flatMap((it) => {
    const nome = `@${arroba(ctx, it.dono)}`;
    const linhas = (it.dados && it.dados.linhas) || [];
    return ((it.dados && it.dados.contas) || []).map((c) => {
      const l = linhas.filter((x) => x.id === c.id && naSemana(x.data))[0];
      return `<li class="dv-conta">
        <div class="debt-top"><span class="name">${esc(c.nome)}</span><span class="value">${money(c.valor, true)}</span></div>
        <div class="meta">${chip(FREQ_TXT[c.freq] || "")}${chip(`de ${nome}`, "plan")}${chip(`minha parte ${money(c.valor / 2, true)}`)}</div>
        ${l ? `<div class="dv-semana"><span class="hint">${l.sozinha ? `esta semana: ${esc(nome)} pagou sozinha` : `esta semana: devo ${money(l.parte, true)}`}</span>${chip(l.sozinha ? "pago" : "dividido", l.sozinha ? "ok" : "plan")}</div>` : ""}
      </li>`;
    });
  }).join("");

  const contasCard = `<section class="card">
    <div class="card-head"><h2>Contas divididas</h2><span class="total">${minhas.length + (delas ? (delas.match(/dv-conta/g) || []).length : 0)}</span></div>
    ${semPessoa && minhas.length ? `<form class="dv-link" id="dv-primeira">
        ${select({ id: "dvq-quem", label: "Com quem eu divido estas contas", options: opcoesQuem, value: opcoesQuem[0].id })}
        ${field({ id: "dvq-nome", name: "pessoa", label: "Nome (se for outra)", type: "text" })}
        <button class="btn primary" type="submit">Salvar</button></form>` : ""}
    ${minhas.length || delas ? `<ul class="dv-contas">${minhas.map(linhaMinha).join("")}${delas}</ul>` : `<p class="hint">Nenhuma conta dividida ainda.</p>`}
  </section>`;

  // ---- 2. Saldo em aberto ----
  const saldoLinha = (card) => {
    const { mov, saldo } = extrato(ctx, card);
    const k = card.chave;
    const hist = mov.filter((m) => m.valor !== 0).slice(0, 40).map((m) => `<li class="reg">
        <span class="reg-dia">${m.data ? shortDate(fromISO(m.data)) : ""}</span>
        <span class="reg-info">${esc(m.desc)}</span>
        <span class="reg-val ${m.tipo === "pagamento" ? "ok" : ""}">${m.valor > 0 ? "+" : "−"}${money(Math.abs(m.valor), true)}</span>
        <span>${m.tipo === "pagamento" && m.meu ? `<button class="link danger" data-dv-rmpg='${esc(JSON.stringify(m.ref))}'>apagar</button>` : ""}</span>
      </li>`).join("");
    const dividas = mov.filter((m) => m.tipo === "divida").map((m) => `<li class="share">
        <div><div class="name">${esc(m.desc)}</div><div class="hint">${m.valor > 0 ? "me deve" : "eu devo"} ${money(Math.abs(m.valor), true)}</div></div>
        ${m.ref.local || m.meu ? `<button class="link danger" data-dv-rmdiv='${esc(JSON.stringify(m.ref))}'>remover</button>` : ""}
      </li>`).join("");
    const formPagar = v.pagar === k ? `<form class="dv-form" data-dv-pagar="${esc(k)}" novalidate>
        ${segmented({ name: "dir", label: "O que aconteceu", options: [{ id: "recebi", label: `${card.nome} me pagou` }, { id: "paguei", label: `Paguei ${card.nome}` }], value: saldo < 0 ? "paguei" : "recebi" })}
        <div class="fields">
          ${field({ id: `dvv-${k}`, name: "valor", label: "Valor", value: Math.abs(saldo) || "", prefix: "$" })}
          ${field({ id: `dvd-${k}`, name: "data", label: "Quando", type: "date", value: hoje })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-dv-fechar>Cancelar</button></div>
      </form>` : "";
    const formDivida = v.divida === k ? `<form class="dv-form" data-dv-divida="${esc(k)}" novalidate>
        ${segmented({ name: "tipo", label: "Quem deve", options: [{ id: "me_deve", label: `${card.nome} me deve` }, { id: "eu_devo", label: "Eu devo" }], value: "me_deve" })}
        <div class="fields stack">
          ${field({ id: `ddn-${k}`, name: "nome", label: "O que é", type: "text" })}
          ${field({ id: `ddv-${k}`, name: "valor", label: "Valor", prefix: "$", placeholder: "0,00" })}
        </div>
        <div class="inline-btns"><button class="btn primary" type="submit">Adicionar</button><button class="btn" type="button" data-dv-fechar>Cancelar</button></div>
      </form>` : "";
    const vincular = card.pessoa && !card.userId && livres.length ? `<form class="dv-link" data-dv-vincular="${esc(card.pessoa.id)}">
        ${select({ id: `dvl-${k}`, label: "Vincular a um @", options: livres.map((c) => ({ id: c.outro, label: `@${c.usuario}` })), value: livres[0].outro })}
        <button class="btn" type="submit">Vincular</button></form>` : "";

    return `<li class="dv-pessoa">
      <div class="debt-top"><span class="name">${esc(card.nome)}</span>
        <span class="value ${saldo < 0 ? "neg" : ""}">${saldo > 0 ? `me deve ${money(saldo, true)}` : saldo < 0 ? `devo ${money(-saldo, true)}` : "tudo certo"}</span></div>
      ${formPagar || `<button class="btn primary add-btn" data-dv-abrir="pagar|${esc(k)}">Registrar pagamento</button>`}
      <details class="sub" ${v.hist === k || v.divida === k ? "open" : ""} data-dv-det="hist|${esc(k)}">
        <summary>Histórico e dívidas</summary>
        ${dividas ? `<ul class="shares">${dividas}</ul>` : ""}
        ${formDivida || `<button class="btn primary add-btn" data-dv-abrir="divida|${esc(k)}">+ Dívida</button>`}
        ${hist ? `<ul class="regs">${hist}</ul>` : `<p class="hint">Nada ainda.</p>`}
        ${vincular}
        ${card.pessoa ? btnRemover("data-dv-rmpessoa", card.pessoa.id, `remover ${esc(card.nome)}`) : ""}
      </details>
    </li>`;
  };
  const saldoCard = lista.length ? `<section class="card">
      <div class="card-head"><h2>Saldo em aberto</h2></div>
      <ul class="dv-pessoas">${lista.map(saldoLinha).join("")}</ul>
    </section>` : "";

  root.innerHTML = `
    ${weekNav(ctx.payday, "Dividir")}
    ${topo}
    ${!r.carregado ? `<p class="hint">Carregando…</p>` : ""}
    ${contasCard}
    ${saldoCard}
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
  const fechar = () => { v.pagar = v.divida = null; };
  const confirma = (b) => { if (b.dataset.confirma) return true; b.dataset.confirma = "1"; b.textContent = "confirmar"; return false; };

  // Acha ou cria a pessoa a partir do "Com quem" (p:id · u:userId · novo + nome)
  const pessoaDe = (quem, nomeNovo) => {
    if (quem.startsWith("p:")) return pessoas(state).find((p) => p.id === quem.slice(2));
    const con = quem.startsWith("u:") ? aceitas(ctx).find((c) => c.outro === quem.slice(2)) : null;
    const nome = con ? `@${con.usuario}` : (nomeNovo || "").trim();
    if (!nome) return null;
    const p = { id: novoId("pe-"), nome, inicio: toISO(new Date()), ...(con ? { userId: con.outro } : {}) };
    state.pessoas = [...pessoas(state), p];
    return p;
  };

  const abrir = root.querySelector("#dvn-abrir");
  if (abrir) abrir.onclick = () => { v.nova = true; ctx.rerender(); };
  const cancel = root.querySelector("#dvn-cancel");
  if (cancel) cancel.onclick = () => { v.nova = false; ctx.rerender(); };
  const fn = root.querySelector("#dv-nova");
  if (fn) fn.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = fn.nome.value.trim(), valor = Number(fn.valor.value), desde = fn.desde.value || toISO(new Date());
    const freq = fn.querySelector("#dvn-freq").value;
    if (!nome || !(valor > 0)) return toast("Preencha a conta e o valor");
    const p = pessoaDe(fn.querySelector("#dvn-quem").value, fn.pessoa.value);
    if (!p) return toast("Escreva o nome da pessoa");
    if (freq === "semanal") salvarParte(state, "semanais", [...parte(state, "semanais"), { id: novoId("u-"), nome, valor, grupo: "vida", compartilhado: true, pessoa: p.id, desde }]);
    else salvarParte(state, "compartilhadas", [...parte(state, "compartilhadas"), { id: novoId("c-"), nome, valor, freq, pessoa: p.id, desde }]);
    v.nova = false;
    salvar();
  });

  // Contas antigas ainda sem pessoa: escolho com quem divido, a partir de hoje
  const fq = root.querySelector("#dv-primeira");
  if (fq) fq.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = pessoaDe(fq.querySelector("#dvq-quem").value, fq.pessoa.value);
    if (!p) return toast("Escreva o nome da pessoa");
    salvarParte(state, "semanais", parte(state, "semanais").map((s) => (s.compartilhado && !s.pessoa ? { ...s, pessoa: p.id, desde: s.desde || p.inicio } : s)));
    salvarParte(state, "compartilhadas", parte(state, "compartilhadas").map((c) => (!c.pessoa ? { ...c, pessoa: p.id, desde: c.desde || p.inicio } : c)));
    salvar();
  });

  root.querySelectorAll("[data-dv-toggle]").forEach((b) => (b.onclick = () => {
    const [key, id] = b.dataset.dvToggle.split("|");
    const sem = { ...((state.compart || {})[key] || {}) };
    if (sem[id] === "sozinha") delete sem[id]; else sem[id] = "sozinha";
    state.compart = { ...(state.compart || {}), [key]: sem };
    salvar();
  }));
  root.querySelectorAll("[data-dv-rmconta]").forEach((b) => (b.onclick = () => {
    if (!confirma(b)) return;
    const [origem, id] = b.dataset.dvRmconta.split("|");
    if (origem === "semanais") salvarParte(state, "semanais", parte(state, "semanais").filter((s) => s.id !== id || !s.id.startsWith("u-")).map((s) => (s.id === id ? { ...s, compartilhado: false } : s)));
    else salvarParte(state, "compartilhadas", parte(state, "compartilhadas").filter((c) => c.id !== id));
    salvar();
  }));

  root.querySelectorAll("[data-dv-abrir]").forEach((b) => (b.onclick = () => {
    const [o, k] = b.dataset.dvAbrir.split("|"); fechar(); v[o] = k; ctx.rerender();
  }));
  root.querySelectorAll("[data-dv-fechar]").forEach((b) => (b.onclick = () => { fechar(); ctx.rerender(); }));
  root.querySelectorAll("[data-dv-det]").forEach((d) => d.addEventListener("toggle", () => {
    const [o, k] = d.dataset.dvDet.split("|");
    if (d.open) v[o] = k; else if (v[o] === k) v[o] = null;
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
    if (!confirma(b)) return;
    try { await apagarPagamento(ctx, JSON.parse(b.dataset.dvRmpg)); ctx.rerender(); } catch { toast("Não consegui apagar"); }
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
    if (!confirma(b)) return;
    const ref = JSON.parse(b.dataset.dvRmdiv);
    if (ref.local) { state.dividasP = (state.dividasP || []).filter((d) => d.id !== ref.local); salvar(); return; }
    try { await backend.apagarCompartilhado(ref.row); await carregarRede(ctx, true); } catch { toast("Não consegui remover"); }
  }));

  // Pessoa só com nome → vinculo a um @ (o que estava só comigo vai para o Supabase)
  root.querySelectorAll("[data-dv-vincular]").forEach((f) => f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = f.dataset.dvVincular, userId = f.querySelector("select").value;
    const p = pessoas(state).find((x) => x.id === id);
    const card = { chave: `u:${userId}`, pessoa: { ...p, userId }, userId };
    try {
      for (const d of (state.dividasP || []).filter((x) => x.pessoa === id))
        await backend.compartilhar({ com: userId, tipo: d.tipo, nome: d.nome, valor: d.valor, freq: "unica", pagamentos: [], dados: {} });
      state.pessoas = pessoas(state).map((x) => (x.id === id ? { ...x, userId, nome: `@${arroba(ctx, userId)}` } : x));
      await carregarRede(ctx, true);
      await publicarLivros(ctx);
      for (const pg of (state.pagDivisao || []).filter((x) => x.pessoa === id)) await registrarPagamento(ctx, card, pg.dir, pg.valor, pg.data);
      state.dividasP = (state.dividasP || []).filter((x) => x.pessoa !== id);
      state.pagDivisao = (state.pagDivisao || []).filter((x) => x.pessoa !== id);
      salvar(); toast("Vinculado ✓");
    } catch (err) { console.error(err); toast("Não consegui vincular"); }
  }));
  root.querySelectorAll("[data-dv-rmpessoa]").forEach((b) => (b.onclick = () => {
    if (!confirma(b)) return;
    state.pessoas = pessoas(state).filter((p) => p.id !== b.dataset.dvRmpessoa);
    salvar();
  }));
}
