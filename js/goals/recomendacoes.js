// =========================================================
// RECOMENDAÇÕES — a carteira como guia: o que fazer agora, com
// a origem de cada número (confirmado, projeção, estimativa, pendente).
// Só regras fixas sobre os dados; sem dado, diz o que falta.
// =========================================================
import { toISO, fromISO, semanaAberta, addDays } from "../core/calendar.js";
import { rendaEfetiva } from "../core/plan.js";
import { caixaDaSemana } from "../core/caixa.js";
import { feito } from "../core/jornada.js";
import { money, shortDate } from "../core/format.js";
import { tendencia } from "./engine.js";

const n = (v) => Number(v) || 0;
const data = (iso) => shortDate(fromISO(iso));

// avaliados: saída de avaliar(); foco: id do objetivo em vista (ou null = todos)
export function recomendacoes(seed, state, avaliados, foco = null, hoje = new Date()) {
  const out = [];
  const emVista = foco ? avaliados.filter((a) => a.id === foco) : avaliados;
  const tem = (t) => emVista.some((a) => a.tipo === t);
  const semana = toISO(semanaAberta(state, hoje));

  // 1. O que pagar primeiro: atrasados pendentes
  const atrasados = seed.pontuais.filter((p) => p.atrasado && !feito(state, p.id));
  if (atrasados.length && (tem("dividas") || tem("organizar") || !foco)) {
    const p = [...atrasados].sort((a, b) => (a.semana || "").localeCompare(b.semana || ""))[0];
    out.push({ id: "atrasado", tipo: "confirmado", texto: `Pagar primeiro: ${p.nome} (${money(n(p.valor), true)})${atrasados.length > 1 ? ` e mais ${atrasados.length - 1} em atraso` : ""}`, href: "#hoje" });
  }

  // 2. Quanto está disponível nesta semana
  if (Object.keys((state.config || {}).entradas || {}).length || Object.keys(state.renda || {}).length) {
    const ef = rendaEfetiva(seed, state, semana);
    const cx = caixaDaSemana(state, semana, ef.valor);
    out.push({ id: "disponivel", tipo: ef.previsao ? "projecao" : "confirmado", texto: `Disponível nesta semana: ${money(cx.total.disponivel, true)}`, href: "#hoje" });
  }

  // 3. A dívida que mais custa
  if (tem("dividas") || tem("patrimonio")) {
    const comSaldo = seed.cartoes.filter((c) => n(c.saldo) > 0);
    const caro = comSaldo.filter((c) => n(c.apr) > 0).sort((a, b) => n(b.apr) - n(a.apr))[0];
    if (caro) out.push({ id: "caro", tipo: "confirmado", texto: `Maior custo: ${caro.nome} (${n(caro.apr)}% ao ano) — o extra vai para ele` });
    const semApr = comSaldo.filter((c) => !n(c.apr)).length;
    if (semApr) out.push({ id: "apr", tipo: "pendente", texto: `Falta o juros de ${semApr} ${semApr === 1 ? "cartão" : "cartões"} para ordenar certo`, sec: "cartoes" });
  }

  // 4. Objetivos em dinheiro fora do ritmo / tendência da previsão
  emVista.forEach((a) => {
    if (a.precisaSemana && !a.noPrazo) {
      out.push({ id: `ritmo-${a.id}`, tipo: "projecao", texto: `${a.titulo}: para chegar até ${data(a.ate)} preciso de ${money(a.precisaSemana, true)}/semana (hoje ${money(a.semanal, true)})`, sec: "objetivo" });
    }
    const t = tendencia(a, semana);
    if (t) out.push({ id: `tend-${a.id}`, tipo: "projecao", texto: `${a.titulo}: previsão ${t.melhorou ? "adiantou" : "atrasou"} ${t.semanas} ${t.semanas === 1 ? "semana" : "semanas"}` });
  });

  // 5. Compromissos com data chegando (Futuras)
  const limite = toISO(addDays(hoje, 21));
  // valor = soma das partes (cada parte cai num pagamento até a data)
  const totalDe = (p) => n(p.valor) || Object.values(p.parcelas || {}).reduce((a, v) => a + n(v), 0);
  (seed.pedidos || []).filter((p) => p.vence && p.vence <= limite && !feito(state, p.id) && totalDe(p) > 0).slice(0, 2).forEach((p) => {
    out.push({ id: `fut-${p.id}`, tipo: "projecao", texto: `${p.nome}: ${money(totalDe(p), true)} até ${data(p.vence)}`, href: "#hoje" });
  });

  // 6. O que falta informar (uma vez cada)
  const vistos = new Set();
  emVista.flatMap((a) => a.faltando).forEach((f) => {
    if (vistos.has(f.id)) return;
    vistos.add(f.id);
    out.push({ id: `falta-${f.id}`, tipo: "pendente", texto: `Falta: ${f.label}`, ...(f.onde.sec ? { sec: f.onde.sec } : { href: f.onde.href }) });
  });
  return out;
}

export const ROTULO_FONTE = { confirmado: "confirmado", projecao: "projeção", estimativa: "estimativa", pendente: "falta dado" };
