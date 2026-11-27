// =========================================================
// PLANO DA SEMANA — monta as missões, distribui o dinheiro
// e passa o que não coube para a semana seguinte.
// Ordem: atrasados → vindos da semana passada → contas → mínimos
//        → vida → pedidos → colchão → (sobra) ataque à dívida.
// =========================================================
import { toISO, fromISO, addDays, dueInWeek, fator, pagamentoAnterior, pagamentoSeguinte } from "./calendar.js";
import { turnosDaSemana, liquido, gasDaSemana, custoGas } from "./lyft.js";
import { simplesDaSemana, simplesLiquido } from "./extra.js";
import { ajudaDa } from "./juntas.js";
import { recebidoValor } from "./receber.js";
import { parte } from "./config.js";
import { usaEntradas, entradasDaSemana, totalEntradas, calcsUsadas, lista as listaEntradas, totalAvulsas } from "./entradas.js";
import { liquidoFonte } from "./extra.js";

// O plano começa em seed.inicio (primeiro pagamento depois de montar a carteira)

export const GROUPS = [
  { id: "vida", label: "Vida da semana", hint: "" },
  { id: "contas", label: "Contas do mês", hint: "" },
  { id: "investimento", label: "Investimentos", hint: "" },
  { id: "minimos", label: "Mínimos das dívidas", hint: "" },
  { id: "pedidos", label: "Pedidos e ocasiões", hint: "" },
  { id: "colchao", label: "Poupança", hint: "" },
];

// Grupos cujo valor que faltou passa para a próxima semana
const CARRY_GROUPS = ["contas", "investimento", "minimos", "pedidos"];

// Extra Money da semana (todas as calculadoras): turnos − gasolina do cashout + entradas simples.
// Sem registros, o valor digitado à mão.
export function lyftDa(state, iso) {
  const turnos = turnosDaSemana(state, iso);
  const gas = custoGas(gasDaSemana(state, iso));
  const simples = simplesDaSemana(state, iso);
  if (turnos.length || gas || simples.length) {
    const valor = turnos.reduce((a, t) => a + liquido(t), 0) - gas + simples.reduce((a, e) => a + simplesLiquido(e), 0);
    return { valor, turnos: turnos.length + simples.length, gas };
  }
  return { valor: Number((state.renda[iso] || {}).lyft) || 0, turnos: 0, gas: 0 };
}

// Conta compartilhada na semana: "dividido" (padrão) ou "sozinha"
export const divisao = (state, iso, id) => ((state.compart || {})[iso] || {})[id] || "dividido";

// Extra Money que não está ligado a nenhuma entrada cadastrada
function extraSolto(state, iso) {
  const ligadas = calcsUsadas(state);
  const fontes = parte(state, "fontes");
  const ligado = fontes.filter((f) => ligadas.includes(f.id)).reduce((a, f) => a + liquidoFonte(state, f, iso), 0);
  return lyftDa(state, iso).valor - ligado;
}

export function rendaDa(state, iso) {
  const r = state.renda[iso] || {};
  if (usaEntradas(state, iso)) {
    const ent = totalEntradas(entradasDaSemana({ fontes: parte(state, "fontes") }, state, iso));
    return ent + extraSolto(state, iso) + (Number(r.extras) || 0) + totalAvulsas(state, iso) + ajudaDa(state, iso) + recebidoValor(state, iso);
  }
  return (Number(r.salario) || 0) + (Number(r.extras) || 0) + totalAvulsas(state, iso) + lyftDa(state, iso).valor + ajudaDa(state, iso) + recebidoValor(state, iso);
}

// Renda usada no plano: a digitada; se ainda não tem, a meta semanal (previsão)
export function rendaEfetiva(seed, state, iso) {
  if (usaEntradas(state, iso)) {
    // Entradas cadastradas: o fixo já é certo; variáveis entram com o previsto
    const temFixo = listaEntradas(state).some((e) => e.tipo === "fixo");
    const base = rendaDa(state, iso) + (temFixo ? 0 : seed.metas.meta);
    return { valor: Math.max(0, base - jurosDa(state, iso)), previsao: !temFixo };
  }
  const salario = Number((state.renda[iso] || {}).salario) || 0;
  const extras = rendaDa(state, iso) - salario; // Lyft, ajudas, recebimentos
  // Sem salário digitado: usa a meta como previsão do salário e soma os extras já registrados
  const base = salario > 0 ? salario + extras : seed.metas.meta + extras;
  // Juros e multas pagos na semana saem do dinheiro disponível
  return { valor: Math.max(0, base - jurosDa(state, iso)), previsao: !(salario > 0) };
}

// Pagamento registrado: true (antigo) ou { valor, juros, data }
export function pagamento(state, iso, id) {
  const p = (state.pagos[iso] || {})[id];
  return p ? (typeof p === "object" ? p : { valor: null, juros: 0 }) : null;
}

export function jurosDa(state, iso) {
  return Object.values(state.pagos[iso] || {}).reduce((a, p) => a + (p && typeof p === "object" ? Number(p.juros) || 0 : 0), 0);
}

// Quanto ainda falta de um item (considera pagamento parcial registrado)
export function restante(state, iso, item, coberto) {
  const p = pagamento(state, iso, item.id);
  // "Paguei tudo" (ex.: câmbio deixou o valor diferente) não deixa resto
  if (p) return p.valor == null || p.quitado ? 0 : Math.max(0, item.valor - p.valor);
  return Math.max(0, item.valor - (coberto || 0));
}

export const FREQS = [
  { id: "mensal", label: "Todo mês" }, { id: "bimestral", label: "A cada 2 meses" },
  { id: "trimestral", label: "A cada 3 meses" }, { id: "semestral", label: "A cada 6 meses" }, { id: "anual", label: "Uma vez por ano" },
];
const MESES_FREQ = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };

// Item vale nesta semana? (respeita desde / ate)
const ativo = (it, iso) => (!it.desde || iso >= it.desde) && (!it.ate || iso <= it.ate);

function baseItems(seed, state, payday) {
  const iso = toISO(payday);
  const items = [];
  const add = (it) => items.push({ acao: "guardar", ...it });
  const f = fator(payday); // semanas no período (1 = semanal)
  const r2 = (n) => Math.round(n * 100) / 100;

  seed.semanais.filter((s) => ativo(s, iso)).forEach((s) => {
    const total = r2(s.valor * f);
    const it = { ...s, valor: total, acao: s.grupo === "vida" ? "usar" : "guardar" };
    if (s.compartilhado) {
      const sozinha = divisao(state, iso, s.id) === "sozinha";
      it.valor = sozinha ? total : r2(total / 2);
      it.detalhe = sozinha ? "paguei sozinha" : `minha parte · total ${total.toFixed(2).replace(".", ",")}`;
    }
    if (s.valorMoeda && total) it.valorMoeda = r2(s.valorMoeda * f * (it.valor / total));
    add(it);
  });

  const r = seed.reservasMensais;
  const its = (r.itens || []).filter((i) => ativo(i, iso));
  if (its.length) {
    const mensal = its.reduce((a, b) => a + b.valor, 0);
    add({ id: r.id, nome: r.nome, detalhe: its.map((i) => i.nome).join(", "), valor: r2(((mensal * 12) / 52) * f), grupo: r.grupo });
  }

  // Vale pela data de vencimento (não pela sexta), para respeitar desde/até
  // frequência: mensal, bimestral, trimestral, semestral ou anual (conta a partir de "desde")
  [...seed.mensais, ...(seed.parcelas || [])].forEach((m) => {
    const d = dueInWeek(m.dia, payday);
    if (!d || !ativo(m, toISO(d))) return;
    const n = MESES_FREQ[m.freq] || 1;
    if (n > 1) {
      const ref = fromISO(m.desde || seed.inicio);
      const dif = (d.getFullYear() - ref.getFullYear()) * 12 + d.getMonth() - ref.getMonth();
      if (((dif % n) + n) % n !== 0) return;
    }
    add({ ...m, vence: d, acao: "pagar", estimativa: m.estimativa || m.diaConfirmar });
  });

  seed.cartoes.forEach((c) => {
    const d = dueInWeek(c.dia, payday);
    if (d) add({ id: `min-${c.id}`, nome: `${c.nome} — mínimo`, valor: c.minimo, vence: d, grupo: "minimos", estimativa: !c.confirmado, acao: "pagar", cartao: c.id });
  });

  // Conta em atraso herda "só valor inteiro" da conta de origem (ex.: seguro1 → seguro1-atraso)
  const inteiro = (p) => p.semParcial || [...seed.mensais, ...(seed.parcelas || [])].some((m) => m.semParcial && String(p.id).startsWith(`${m.id}-`));
  seed.pontuais.filter((p) => p.semana === iso).forEach((p) => add({ ...p, acao: "pagar", semParcial: inteiro(p) }));

  seed.reservasPrazo.forEach((rp) => {
    if (rp.semanas.includes(iso)) add({ id: rp.id, nome: rp.nome, valor: rp.total / rp.semanas.length, grupo: rp.grupo });
  });

  seed.pedidos.forEach((p) => {
    const v = p.parcelas[iso];
    if (v) add({ id: p.id, nome: p.nome, valor: v, vence: fromISO(p.vence), grupo: "pedidos", protegido: true });
  });

  (state.pedidos || []).forEach((p) => {
    const v = p.parcelas[iso];
    if (v) add({ id: p.id, nome: p.nome, valor: v, vence: fromISO(p.data), grupo: "pedidos" });
  });

  add({ id: "colchao", nome: "Poupança", valor: r2(seed.colchaoSemanal * f), grupo: "colchao" });
  return items;
}

// Ordem de prioridade final, em camadas:
// 0 vida (comida, gasolina, cachorros) · 1 atrasados · 2 contas a pagar na semana (por data)
// 3 reservas (vindas da semana passada antes) · 4 pedidos protegidos · 5 colchão
function tier(i) {
  if (i.grupo === "vida") return 0;
  if (i.atrasado) return 1;
  if (i.acao === "pagar") return 2;
  if (i.grupo === "pedidos") return i.protegido ? 2.5 : 4;
  if (i.grupo === "colchao") return 5;
  return 3;
}
export function priorityOrder(items) {
  const t = (d) => (d ? d.getTime() : Infinity);
  return [...items].sort((a, b) =>
    tier(a) - tier(b) || (b.veioDe ? 1 : 0) - (a.veioDe ? 1 : 0) || t(a.vence) - t(b.vence));
}

export function allocate(week, renda) {
  let rest = renda;
  const cover = {};
  week.ordem.forEach((i) => {
    // Só aceita o valor inteiro: ou cobre tudo, ou fica para depois (o dinheiro segue para a próxima)
    if (i.semParcial && rest < i.valor - 0.005) { cover[i.id] = 0; return; }
    const c = Math.max(0, Math.min(i.valor, rest));
    cover[i.id] = c;
    rest -= c;
  });
  return { cover, ataque: Math.max(0, rest) };
}

// Semana completa, já com o que veio da semana anterior
// cache por estado: evita recalcular a cadeia de semanas
const caches = new WeakMap();
export function invalidate(state) { caches.delete(state); }

export function buildWeek(seed, state, payday) {
  const iso = toISO(payday);
  let cache = caches.get(state);
  if (!cache) caches.set(state, (cache = new Map()));
  if (cache.has(iso)) return cache.get(iso);
  const w = buildWeekRaw(seed, state, payday, iso);
  cache.set(iso, w);
  return w;
}

function buildWeekRaw(seed, state, payday, iso) {
  let carry = [];

  if (iso > seed.inicio) {
    const prev = buildWeek(seed, state, pagamentoAnterior(payday));
    const prevRenda = rendaEfetiva(seed, state, prev.iso).valor;
    {
      const { cover } = allocate(prev, prevRenda);
      carry = prev.items
        .filter((i) => CARRY_GROUPS.includes(i.grupo) && restante(state, prev.iso, i, cover[i.id]) > 0.005)
        .map((i) => ({
          ...i,
          id: i.veioDe ? i.id : `${i.id}@${prev.iso}`,
          valor: restante(state, prev.iso, i, cover[i.id]),
          veioDe: i.veioDe || prev.iso,
          atrasado: i.atrasado || (i.vence && i.vence < payday),
        }));
    }
  }

  const items = [...carry, ...baseItems(seed, state, payday)];
  const sum = (g) => items.filter((i) => g.includes(i.grupo)).reduce((a, b) => a + b.valor, 0);
  const precisa = sum(["contas", "investimento", "minimos", "vida", "pedidos"]);

  return {
    iso,
    items,
    ordem: priorityOrder(items),
    precisa,
    piso: seed.metas.piso,
    meta: seed.metas.meta,
    turbo: seed.metas.turbo,
  };
}

// Simula as próximas semanas com a renda digitada (ou a meta) e responde:
// quando tudo fica em dia, quando começa o ataque à dívida e o que não fecha no prazo.
export function projetar(seed, state, from, max = 30) {
  let emDia = null, ataqueDesde = null;
  const alertas = new Map();
  let payday = from;
  for (let k = 0; k < max && !(emDia && ataqueDesde); k++, payday = pagamentoSeguinte(payday)) {
    const w = buildWeek(seed, state, payday);
    const { cover, ataque } = allocate(w, rendaEfetiva(seed, state, w.iso).valor);
    w.items.filter((i) => i.grupo === "pedidos" && i.atrasado && !alertas.has(i.nome))
      .forEach((i) => alertas.set(i.nome, i.vence));
    const pendente = w.items.some((i) => ["contas", "minimos", "pedidos"].includes(i.grupo) && i.valor - (cover[i.id] || 0) > 0.005);
    if (!emDia && !pendente) emDia = payday;
    if (!ataqueDesde && ataque > 0) ataqueDesde = payday;
  }
  return { emDia, ataqueDesde, alertas: [...alertas].map(([nome, vence]) => ({ nome, vence })) };
}

// Quanto sobra para a dívida em cada semana (para simular a quitação)
export function serieAtaque(seed, state, from, semanas = 156) {
  const out = [];
  let payday = from;
  for (let k = 0; k < semanas; k++, payday = pagamentoSeguinte(payday)) {
    const w = buildWeek(seed, state, payday);
    out.push({ payday, fator: fator(payday), valor: allocate(w, rendaEfetiva(seed, state, w.iso).valor).ataque });
  }
  return out;
}
