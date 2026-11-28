// =========================================================
// GOAL ENGINE — avalia cada objetivo a partir dos dados da carteira.
// Independente da tela: Home, Ajustes e o plano só leem o resultado.
// Cálculos determinísticos; cada número diz de onde vem:
//   confirmado (saldo conferido / pagamento marcado), projecao (pelo
//   plano e pelo ritmo), estimativa (valor sugerido), pendente (falta dado).
//
// avaliar(seed, state) → [{ id, tipo, nome, label, etapas[], atual, progresso,
//   valor{atual,alvo,falta,fonte}, previsao, status, faltando[], continuo }]
// Dois objetivos guardando na mesma conta não contam o mesmo dinheiro:
// o saldo vai para o de maior prioridade primeiro, o resto para o seguinte.
// =========================================================
import { toISO, fromISO, addDays } from "../core/calendar.js";
import { saldoAtual, base as baseSaldo } from "../core/saldo.js";
import { poupanca } from "../core/destino.js";
import { parte } from "../core/config.js";
import { cotacao, moedaBase } from "../core/cambio.js";
import { jornada, feito } from "../core/jornada.js";
import { objetivos } from "./modelo.js";
import { tipo, ehDinheiro } from "./tipos.js";
import { faltando, NECESSIDADES } from "./necessidades.js";

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(v * 100) / 100;
const iso = (d) => (!d ? null : typeof d === "string" ? d : toISO(d));
const MESES = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };

// Custo de vida por mês (contas fixas + da semana), na moeda da carteira
export function custoMensal(seed) {
  const sem = seed.semanais.reduce((a, s) => a + n(s.valor), 0) * 52 / 12;
  const mes = seed.mensais.reduce((a, m) => a + n(m.valor) / (MESES[m.freq] || 1), 0);
  return r2(sem + mes);
}

// Conta onde o objetivo guarda (a escolhida ou a poupança)
export function contaDoObjetivo(state, g) {
  return (state.bancos || []).find((b) => b.id === g.conta) || poupanca(state);
}

// Etapas por marcos de valor (25/50/75/100% ou meses de contas)
function marcos(lista, atual) {
  // frac = quanto da etapa já foi percorrido (real, para o desenho)
  return lista.map((m, i) => {
    const de = i ? lista[i - 1].valor : 0;
    return { id: m.id, titulo: m.titulo, desc: m.desc, ok: atual >= m.valor - 0.005, quando: null, valor: m.valor,
      frac: m.valor > de ? Math.max(0, Math.min(1, (atual - de) / (m.valor - de))) : 0 };
  });
}

function previsaoNoRitmo(falta, semanal, hoje) {
  if (falta <= 0) return toISO(hoje);
  return semanal > 0 ? toISO(addDays(hoje, Math.ceil(falta / semanal) * 7)) : null;
}

// ----- Avaliadores por tipo -----
function avaliarDividas(seed, state) {
  // Sem cartões/dívidas cadastrados não há etapas (nada de "tudo em dia" falso)
  if (!NECESSIDADES.dividas.ok(seed, state)) return { etapas: [], progresso: 0, valor: null, previsao: null };
  const j = jornada(seed, state);
  const etapas = j.fases.map((f) => ({ ...f, quando: iso(f.quando) }));
  const restante = seed.cartoes.reduce((a, c) => a + n(c.saldo), 0) + seed.outras.reduce((a, o) => a + n(o.saldo), 0);
  return {
    etapas, progresso: etapas.length ? j.progresso : 0,
    valor: { atual: j.pagoCartoes, alvo: j.inicioCartoes, falta: r2(restante), fonte: "confirmado", rotulo: "Quitado dos cartões" },
    previsao: iso(j.fimCartoes) || iso((etapas[etapas.length - 1] || {}).quando),
    extra: { placar: { pagoCartoes: j.pagoCartoes, inicioCartoes: j.inicioCartoes, semanasMeta: j.semanasMeta, fimCartoes: iso(j.fimCartoes) } },
  };
}

function avaliarDinheiro(seed, state, g, disponivel, hoje) {
  const conta = contaDoObjetivo(state, g);
  let atual, fonteAtual = "confirmado", alvo = n(g.alvo), fonteAlvo = "informado";
  if (g.tipo === "patrimonio") {
    // O que tenho (saldo das contas) menos o que devo (cartões e dívidas)
    const ativos = (state.bancos || []).reduce((a, b) => a + Math.max(0, n(saldoAtual(state, b))), 0);
    const passivos = seed.cartoes.reduce((a, c) => a + n(c.saldo), 0) + seed.outras.reduce((a, o) => a + n(o.saldo), 0);
    atual = r2(ativos - passivos);
    if ((state.bancos || []).some((b) => !baseSaldo(state, b))) fonteAtual = "estimativa";
  } else {
    const chave = conta.id;
    const s = baseSaldo(state, conta) ? Math.max(0, n(saldoAtual(state, conta))) : 0;
    if (!baseSaldo(state, conta)) fonteAtual = "pendente";
    // Conta corrente: o saldo também é o dinheiro das contas do dia a dia.
    // Contar tudo como do objetivo seria contar o mesmo dinheiro duas vezes.
    else if (conta.tipo && conta.tipo !== "savings") fonteAtual = "estimativa";
    if (disponivel[chave] == null) disponivel[chave] = s;
    atual = r2(Math.min(disponivel[chave], alvo > 0 ? alvo : disponivel[chave]));
    disponivel[chave] = r2(disponivel[chave] - atual);
  }
  let etapas;
  if (g.tipo === "reserva") {
    const cm = custoMensal(seed);
    if (!alvo && cm > 0) { alvo = r2(cm * 3); fonteAlvo = "estimativa"; }
    // Marcos em meses de contas que cabem no alvo; o último é sempre o alvo
    const meses = cm > 0 ? [1, 3, 6].filter((m) => cm * m <= alvo + 0.005) : [];
    const lista = meses.map((m) => ({ id: `m${m}`, titulo: `${m} ${m === 1 ? "mês" : "meses"} de contas`, desc: `$${Math.round(cm * m).toLocaleString("pt-BR")} guardados`, valor: cm * m }));
    if (lista.length && Math.abs(lista[lista.length - 1].valor - alvo) > 1) lista.push({ id: "alvo", titulo: g.nome || "Reserva completa", desc: `$${Math.round(alvo).toLocaleString("pt-BR")}`, valor: alvo });
    etapas = marcos(lista, atual);
  }
  if (!etapas || !etapas.length) {
    etapas = alvo > 0 ? marcos([0.25, 0.5, 0.75, 1].map((f) => ({ id: `p${f * 100}`, titulo: f === 1 ? (g.nome || "Objetivo alcançado") : `${f * 100}% do valor`, desc: `$${Math.round(alvo * f).toLocaleString("pt-BR")}`, valor: alvo * f })), atual) : [];
  }
  const falta = r2(Math.max(0, alvo - atual));
  const previsao = alvo > 0 ? previsaoNoRitmo(falta, g.semanal, hoje) : null;
  const semanasAte = g.ate ? Math.max(1, Math.ceil((fromISO(g.ate) - hoje) / (7 * 86400000))) : null;
  const precisaSemana = semanasAte && falta > 0 ? r2(falta / semanasAte) : null;
  etapas.forEach((e) => { if (!e.ok && g.semanal > 0) e.quando = previsaoNoRitmo(Math.max(0, e.valor - atual), g.semanal, hoje); });
  return {
    etapas, progresso: alvo > 0 ? Math.max(0, Math.min(1, atual / alvo)) : 0,
    valor: { atual, alvo, falta, fonte: fonteAtual, fonteAlvo, conta: conta.banco, contaMista: !!(conta.tipo && conta.tipo !== "savings") },
    previsao, precisaSemana, noPrazo: !g.ate || !previsao || previsao <= g.ate,
  };
}

// Contínuos: uma lista de cuidados; o progresso é a saúde de agora
function checklist(itens) {
  const etapas = itens.map((x) => ({ ...x, quando: null }));
  return { etapas, progresso: etapas.length ? etapas.filter((e) => e.ok).length / etapas.length : 0, previsao: null };
}

function avaliarOrganizar(seed, state, hoje) {
  const bancos = state.bancos || [];
  const conferido = bancos.length && bancos.every((b) => { const s = baseSaldo(state, b); return s && s.em && hoje - s.em < 14 * 86400000; });
  const atrasados = seed.pontuais.filter((p) => p.atrasado && !feito(state, p.id));
  const fechadas = Object.keys(state.fechadas || {});
  return checklist([
    { id: "bancos", titulo: "Contas bancárias cadastradas", desc: bancos.length ? `${bancos.length} contas` : "Nenhuma ainda", ok: bancos.length > 0 },
    { id: "entradas", titulo: "Entradas cadastradas", desc: "Salário e outras entradas", ok: ((state.config || {}).entradas || []).length > 0 },
    { id: "contas", titulo: "Contas fixas cadastradas", desc: `${seed.mensais.length + seed.semanais.length} contas`, ok: seed.mensais.length + seed.semanais.length > 0 },
    { id: "conferido", titulo: "Saldo conferido nas últimas 2 semanas", desc: "Comparar com o banco", ok: !!conferido },
    { id: "atrasados", titulo: "Nenhuma conta atrasada", desc: atrasados.length ? `${atrasados.length} em atraso` : "Tudo em dia", ok: !atrasados.length },
    { id: "fechada", titulo: "Período fechado", desc: "Fechar o período no fim do ciclo", ok: fechadas.some((d) => hoje - fromISO(d) < 15 * 86400000) },
  ]);
}

function avaliarMoedas(seed, state, hoje) {
  const base = moedaBase(state);
  const itens = ["semanais", "mensais", "parcelas", "pontuais"].flatMap((k) => parte(state, k)).filter((it) => it.moeda && it.moeda !== base && n(it.valorMoeda) > 0);
  const moedas = [...new Set(itens.map((i) => i.moeda))];
  // Cada cotação precisa ter origem (pagamento, manual, mercado) e data
  const info = moedas.map((m) => ({ m, c: cotacao(state, m) }));
  const sem = info.filter((x) => !x.c).map((x) => x.m);
  const velhas = info.filter((x) => x.c && x.c.em && hoje - x.c.em > 30 * 86400000).map((x) => x.m);
  const desc = info.filter((x) => x.c).map((x) => `${x.m}: ${x.c.fonte}${x.c.em ? ` em ${new Date(x.c.em).toLocaleDateString("pt-BR")}` : ""}`).join(" · ");
  return checklist([
    { id: "base", titulo: "Moeda principal definida", desc: (state.config || {}).moeda || "Não definida (usando USD)", ok: !!(state.config || {}).moeda },
    { id: "contas", titulo: "Contas em outra moeda cadastradas", desc: itens.length ? `${itens.length} contas · ${moedas.join(", ")}` : "Nenhuma ainda", ok: itens.length > 0 },
    { id: "cotacao", titulo: "Cotação de cada moeda, com origem e data", desc: sem.length ? `Falta: ${sem.join(", ")}` : desc || "—", ok: itens.length > 0 && !sem.length },
    { id: "recente", titulo: "Cotações do último mês", desc: velhas.length ? `Antigas: ${velhas.join(", ")}` : "Em dia", ok: itens.length > 0 && !sem.length && !velhas.length },
  ]);
}

function avaliarFamilia(seed, state) {
  const comp = parte(state, "compartilhadas");
  const divididas = seed.semanais.filter((s) => s.compartilhado).length + seed.mensais.filter((s) => s.compartilhado).length + comp.length;
  return checklist([
    { id: "divididas", titulo: "Contas divididas cadastradas", desc: divididas ? `${divididas} contas` : "Nenhuma ainda", ok: divididas > 0 },
    { id: "receber", titulo: "Quem me deve, anotado", desc: "Valores a receber", ok: parte(state, "receber").length > 0 || (state.recebimentos || []).length > 0 },
  ]);
}

function avaliarEtapasManuais(g) {
  return checklist(g.etapas.map((e) => ({ id: e.id, titulo: e.nome, desc: "", ok: !!e.feito })));
}

// ----- Avaliação de todos os objetivos ativos -----
export function avaliar(seed, state, hoje = new Date()) {
  const disponivel = {}; // saldo por conta ainda não usado por outro objetivo
  return objetivos(state).map((g) => {
    const t = tipo(g.tipo);
    let r;
    if (g.tipo === "dividas") r = avaliarDividas(seed, state);
    else if (g.tipo === "organizar") r = avaliarOrganizar(seed, state, hoje);
    else if (g.tipo === "moedas") r = avaliarMoedas(seed, state, hoje);
    else if (g.tipo === "familia") r = avaliarFamilia(seed, state);
    else if (g.tipo === "documentos") r = { etapas: [], progresso: 0, previsao: null };
    else if (ehDinheiro(g) || g.tipo === "reserva") r = avaliarDinheiro(seed, state, g, disponivel, hoje);
    else r = avaliarEtapasManuais(g);
    const atual = r.etapas.find((e) => !e.ok) || null;
    const concluido = !t.continuo && r.etapas.length > 0 && !atual;
    return {
      ...g, label: t.label, icone: t.icone, continuo: !!t.continuo, emBreve: !!t.emBreve,
      titulo: g.nome || t.label, ...r, atual,
      status: t.emBreve ? "em breve" : concluido ? "concluido" : g.status,
      faltando: faltando(seed, state, g),
    };
  });
}

// O caminho inteiro: os objetivos em ordem de prioridade, um depois do outro
export function caminho(avaliados) {
  const etapas = avaliados.filter((a) => !a.emBreve && !a.continuo).flatMap((a) => a.etapas.map((e) => ({ ...e, objetivo: a.id, objetivoTitulo: a.titulo })));
  const pesos = avaliados.filter((a) => !a.emBreve && !a.continuo && a.etapas.length);
  const progresso = pesos.length ? pesos.reduce((s, a) => s + a.progresso * a.etapas.length, 0) / pesos.reduce((s, a) => s + a.etapas.length, 0) : 0;
  return { etapas, progresso, atual: etapas.find((e) => !e.ok) || null };
}

// Histórico: uma foto por semana do progresso e da previsão
export function registrarHistorico(state, avaliados, semanaISO) {
  const lista = (state.config || {}).objetivos;
  if (!Array.isArray(lista)) return false;
  let mudou = false;
  const novos = lista.map((g) => {
    const a = avaliados.find((x) => x.id === g.id);
    if (!a) return g;
    const foto = { p: Math.round(a.progresso * 1000) / 1000, prev: a.previsao || null };
    const h = g.historico || {};
    const ant = h[semanaISO];
    if (ant && ant.p === foto.p && ant.prev === foto.prev) return g;
    mudou = true;
    const chaves = Object.keys({ ...h, [semanaISO]: 1 }).sort().slice(-52);
    return { ...g, historico: Object.fromEntries(chaves.map((k) => [k, k === semanaISO ? foto : h[k]])) };
  });
  if (mudou) state.config = { ...state.config, objetivos: novos };
  return mudou;
}

// A previsão melhorou ou piorou desde a última semana registrada?
export function tendencia(a, semanaISO) {
  const h = a.historico || {};
  const ant = Object.keys(h).filter((k) => k < semanaISO).sort().pop();
  if (!ant || !h[ant].prev || !a.previsao) return null;
  const dias = Math.round((fromISO(a.previsao) - fromISO(h[ant].prev)) / 86400000);
  return Math.abs(dias) < 7 ? null : { semanas: Math.round(Math.abs(dias) / 7), melhorou: dias < 0 };
}
