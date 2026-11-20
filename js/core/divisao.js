// =========================================================
// DIVISÃO — contas que divido com cada pessoa, o que fica devendo
// e os pagamentos entre nós.
//
// Pessoa: offline (só o nome, tudo fica na minha carteira) ou ligada
// a um @ (o meu "livro" é publicado no Supabase e aparece para ela).
//   state.pessoas     [{ id, nome, userId?, inicio }]
//   conta.pessoa      id da pessoa (semanais compartilhadas e compartilhadas)
//   state.compart     { [semana ISO | "m:AAAA-MM"]: { [contaId]: "sozinha" } }
//   state.pagDivisao  pagamentos com pessoas offline [{ id, pessoa, dir, valor, data }]
//   state.dividasP    dívidas com pessoas offline [{ id, pessoa, tipo, nome, valor, data }]
// Dividido: a pessoa me deve metade. Paguei sozinha: ela não deve nada.
// =========================================================
import { backend } from "./backend.js";
import { parte } from "./config.js";
import { rede, carregarRede, aceitas, arroba } from "./rede.js";
import { toISO, fromISO, proximoPagamento, pagamentoSeguinte, fator } from "./calendar.js";

const r2 = (n) => Math.round(n * 100) / 100;
const mesKey = (d) => `m:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const pessoas = (state) => state.pessoas || [];
export const chaveDe = (p) => (p.userId ? `u:${p.userId}` : `p:${p.id}`);

// Todas as contas divididas (semanais + mensais/trimestrais) com a pessoa de cada uma
export function contasDivididas(ctx) {
  const ps = pessoas(ctx.state);
  const pad = ps[0] ? ps[0].id : null;
  const sem = parte(ctx.state, "semanais").filter((s) => s.compartilhado).map((s) => ({ ...s, freq: "semanal", origem: "semanais" }));
  const out = parte(ctx.state, "compartilhadas").map((c) => ({ ...c, origem: "compartilhadas" }));
  return [...sem, ...out].map((c) => {
    const pessoa = c.pessoa || pad;
    const p = ps.find((x) => x.id === pessoa);
    return { ...c, pessoa, desde: c.desde || (p && p.inicio) || toISO(new Date()) };
  });
}

export const marca = (state, key, id) => ((state.compart || {})[key] || {})[id] || "dividido";

// Cada vez que a conta acontece, de "desde" até hoje (inclui a semana atual)
export function ocorrencias(state, conta, hoje = new Date()) {
  const out = [];
  const ini = fromISO(conta.desde);
  if (conta.freq === "semanal") {
    const fim = proximoPagamento(hoje);
    for (let p = proximoPagamento(ini), n = 0; p <= fim && n < 400; p = pagamentoSeguinte(p), n++) {
      const key = toISO(p);
      const total = r2(Number(conta.valor) * fator(p));
      out.push({ key, data: key, total });
    }
  } else {
    const passo = conta.freq === "trimestral" ? 3 : 1;
    let d = new Date(ini.getFullYear(), ini.getMonth() + (ini.getDate() === 1 ? 0 : 1), 1);
    for (let n = 0; d <= hoje && n < 200; n++, d = new Date(d.getFullYear(), d.getMonth() + passo, 1)) {
      out.push({ key: mesKey(d), data: toISO(d), total: r2(Number(conta.valor)) });
    }
  }
  return out.map((o) => {
    const sozinha = marca(state, o.key, conta.id) === "sozinha";
    return { ...o, id: conta.id, nome: conta.nome, sozinha, parte: sozinha ? 0 : r2(o.total / 2) };
  });
}

// Livro que publico para uma pessoa ligada (o que ela vê do lado dela)
export function meuLivro(ctx, pessoa) {
  const contas = contasDivididas(ctx).filter((c) => c.pessoa === pessoa.id);
  const linhas = contas.flatMap((c) => ocorrencias(ctx.state, c)).sort((a, b) => a.data.localeCompare(b.data));
  return {
    usuario: ctx.usuario,
    contas: contas.map((c) => ({ id: c.id, nome: c.nome, valor: Number(c.valor), freq: c.freq })),
    linhas: linhas.map(({ key, id, data, nome, total, parte, sozinha }) => ({ key, id, data, nome, total, parte, sozinha })),
  };
}

// ---- Pessoas que aparecem na página: as minhas + quem divide comigo ----
export function cartoes(ctx) {
  const eu = ctx.userId;
  const lista = pessoas(ctx.state).map((p) => ({ chave: chaveDe(p), pessoa: p, userId: p.userId || null }));
  rede(ctx).itens.forEach((it) => {
    const outro = it.dono === eu ? it.com : it.dono;
    if (!lista.some((x) => x.userId === outro)) lista.push({ chave: `u:${outro}`, pessoa: null, userId: outro });
  });
  return lista.map((x) => ({ ...x, nome: x.userId ? `@${arroba(ctx, x.userId)}` : x.pessoa.nome }));
}

// ---- Extrato com uma pessoa: o que ela me deve, o que eu devo, pagamentos ----
// saldo > 0: ela me deve · saldo < 0: eu devo
export function extrato(ctx, card) {
  const eu = ctx.userId;
  const mov = []; // { data, desc, valor (+ ela me deve / − eu devo), tipo, ref }
  if (card.pessoa) {
    contasDivididas(ctx).filter((c) => c.pessoa === card.pessoa.id).forEach((c) =>
      ocorrencias(ctx.state, c).forEach((o) => mov.push({ data: o.data, desc: o.nome, valor: o.parte, tipo: o.sozinha ? "sozinha" : "conta", total: o.total })));
  }
  if (!card.userId) {
    (ctx.state.dividasP || []).filter((d) => d.pessoa === card.pessoa.id).forEach((d) =>
      mov.push({ data: d.data, desc: d.nome, valor: d.tipo === "me_deve" ? Number(d.valor) : -Number(d.valor), tipo: "divida", ref: { local: d.id } }));
    (ctx.state.pagDivisao || []).filter((p) => p.pessoa === card.pessoa.id).forEach((p) =>
      mov.push({ data: p.data, desc: p.dir === "recebi" ? "Recebi" : "Paguei", valor: p.dir === "recebi" ? -Number(p.valor) : Number(p.valor), tipo: "pagamento", ref: { local: p.id }, meu: true }));
  } else {
    rede(ctx).itens.filter((it) => (it.dono === eu && it.com === card.userId) || (it.com === eu && it.dono === card.userId)).forEach((it) => {
      const meu = it.dono === eu;
      if (it.tipo === "divisao" && !meu) {
        ((it.dados || {}).linhas || []).forEach((l) => mov.push({ data: l.data, desc: l.nome, valor: -l.parte, tipo: l.sozinha ? "sozinha-dela" : "conta-dela", total: l.total }));
      }
      if (it.tipo === "me_deve" || it.tipo === "eu_devo") {
        const elaMeDeve = (it.tipo === "me_deve") === meu;
        mov.push({ data: (it.criado_em || "").slice(0, 10), desc: it.nome, valor: elaMeDeve ? Number(it.valor) : -Number(it.valor), tipo: "divida", ref: { row: it.id }, meu });
      }
      (it.pagamentos || []).forEach((p) => {
        // Pagamento novo tem de/para; os antigos seguem a direção da dívida
        let recebi;
        if (p.para) recebi = p.para === eu;
        else if (it.tipo === "divisao") recebi = meu;
        else recebi = (it.tipo === "me_deve") === meu;
        mov.push({ data: p.data, desc: recebi ? "Recebi" : "Paguei", valor: recebi ? -Number(p.valor) : Number(p.valor), tipo: "pagamento", ref: { row: it.id, pid: p.id }, meu: p.por === ctx.usuario });
      });
    });
  }
  mov.sort((a, b) => b.data.localeCompare(a.data));
  const saldo = r2(mov.reduce((a, m) => a + m.valor, 0));
  return { mov, saldo };
}

// ---- Publicar meus livros para as pessoas ligadas ----
const meuLivroRow = (ctx, userId) => rede(ctx).itens.find((it) => it.tipo === "divisao" && it.dono === ctx.userId && it.com === userId);

async function garantirLivro(ctx, userId) {
  let row = meuLivroRow(ctx, userId);
  if (!row) {
    row = await backend.compartilhar({ com: userId, tipo: "divisao", nome: "divisão", valor: 0, freq: "unica", pagamentos: [], dados: {} });
    rede(ctx).itens.push(row);
  }
  return row;
}

let publicando = false;
export async function publicarLivros(ctx) {
  const r = rede(ctx);
  if (!r.carregado || r.erro || publicando) return;
  publicando = true;
  try {
    for (const p of pessoas(ctx.state).filter((x) => x.userId)) {
      if (!aceitas(ctx).some((c) => c.outro === p.userId)) continue;
      const dados = meuLivro(ctx, p);
      const row = await garantirLivro(ctx, p.userId);
      if (JSON.stringify(row.dados || {}) !== JSON.stringify(dados)) {
        await backend.atualizarCompartilhado(row.id, { dados });
        row.dados = dados;
      }
    }
  } catch (err) { console.error("publicar", err); }
  publicando = false;
}

// ---- Registrar / apagar pagamento (qualquer um dos dois pode) ----
export async function registrarPagamento(ctx, card, dir, valor, data) {
  const id = "pg-" + Date.now().toString(36);
  if (!card.userId) {
    ctx.state.pagDivisao = [...(ctx.state.pagDivisao || []), { id, pessoa: card.pessoa.id, dir, valor, data }];
    ctx.persist();
    return;
  }
  const eu = ctx.userId, ela = card.userId;
  // Vai no livro que já existe entre nós (o meu ou o dela); se não tiver, crio o meu
  const row = meuLivroRow(ctx, ela)
    || rede(ctx).itens.find((it) => it.tipo === "divisao" && it.dono === ela && it.com === eu)
    || (await garantirLivro(ctx, ela));
  const pg = { id, valor, data, por: ctx.usuario, de: dir === "recebi" ? ela : eu, para: dir === "recebi" ? eu : ela };
  await backend.atualizarCompartilhado(row.id, { pagamentos: [...(row.pagamentos || []), pg] });
  await carregarRede(ctx, true);
}

export async function apagarPagamento(ctx, ref) {
  if (ref.local) {
    ctx.state.pagDivisao = (ctx.state.pagDivisao || []).filter((p) => p.id !== ref.local);
    ctx.persist();
    return;
  }
  const row = rede(ctx).itens.find((it) => it.id === ref.row);
  if (!row) return;
  await backend.atualizarCompartilhado(row.id, { pagamentos: (row.pagamentos || []).filter((p) => p.id !== ref.pid) });
  await carregarRede(ctx, true);
}
