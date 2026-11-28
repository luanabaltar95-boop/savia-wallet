// =========================================================
// JORNADA — fases do jogo a partir dos seus dados reais.
// Cada fase é cumprida por pagamentos marcados / saldos zerados.
// O progresso (0→1) mistura fases cumpridas e dívida quitada.
// =========================================================
import { toISO, fromISO, nextPayday } from "./calendar.js";
import { serieAtaque, projetar, rendaDa, buildWeek, allocate, rendaEfetiva } from "./plan.js";
import { pagamentoSeguinte } from "./calendar.js";
import { simularCartoes } from "./debts.js";

// Algum registro desta conta (ou do que passou para outra semana) foi marcado como feito?
export function feito(state, id) {
  return Object.values(state.pagos || {}).some((sem) =>
    Object.entries(sem).some(([k, v]) => v && (k === id || k.startsWith(id + "@"))));
}

// Etapas de "sair das dívidas" (o Goal Engine usa estas fases)
export function jornada(seed, state) {
  const hoje = new Date();
  const hojeISO = toISO(hoje);
  const from = nextPayday();
  const sim = simularCartoes(seed, serieAtaque(seed, state, from));
  const proj = projetar(seed, state, from, 20);

  const atrasados = seed.pontuais.filter((p) => p.atrasado);
  const atrasadosOk = atrasados.every((p) => feito(state, p.id));
  // Primeira sexta em que todos os atrasados cabem no dinheiro da semana
  let quandoAtrasados = null;
  for (let k = 0, d = from; k < 12 && !quandoAtrasados; k++, d = pagamentoSeguinte(d)) {
    const w = buildWeek(seed, state, d);
    const { cover } = allocate(w, rendaEfetiva(seed, state, w.iso).valor);
    const pend = w.items.some((i) => atrasados.some((a) => i.id === a.id || i.id.startsWith(a.id + "@")) && i.valor - (cover[i.id] || 0) > 0.005);
    if (!pend) quandoAtrasados = d;
  }
  const protegidos = seed.pedidos || [];
  const protegidosOk = protegidos.every((p) => feito(state, p.id));
  const ultimaData = (l) => l.reduce((m, p) => (!m || p.vence > m ? p.vence : m), "");
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  // Fases geradas pelos dados de cada pessoa
  const fases = [
    ...(atrasados.length ? [{ id: "atrasados", titulo: "Apagar os incêndios", desc: `Pagar ${plural(atrasados.length, "conta atrasada", "contas atrasadas")}`, ok: atrasadosOk, quando: quandoAtrasados }] : []),
    ...(protegidos.length ? [{ id: "protegidos", titulo: "Reservas protegidas", desc: protegidos.map((p) => p.nome).join(", "), ok: protegidosOk, quando: fromISO(ultimaData(protegidos)) }] : []),
    { id: "emdia", titulo: "Tudo em dia", desc: "Nenhuma conta passando de um pagamento para outro", ok: atrasadosOk && protegidosOk && proj.emDia && proj.emDia <= from, quando: proj.emDia },
    ...seed.alvos.map((id) => {
      const c = seed.cartoes.find((x) => x.id === id);
      return { id, titulo: `${c.nome} quitado`, desc: `Saldo agora: $${Math.round(c.saldo).toLocaleString("pt-BR")}`, ok: c.saldo <= 0, quando: sim.quitacao[id], cartao: true };
    }),
    // Financiamentos e parcelamentos sem dívida ligada: quitados na última parcela
    ...(seed.parcelas || []).filter((p) => p.ate && p.naJornada !== false && !p.divida).map((p) => ({
      id: p.id, titulo: `${p.nome} quitado`, desc: "Última parcela paga", ok: hojeISO > p.ate, quando: fromISO(p.ate),
    })),
    // Outras dívidas: quitadas quando o saldo zera (previsão = "ate", se tiver)
    ...[...seed.outras].sort((x, y) => (x.ate || "9999").localeCompare(y.ate || "9999")).map((o) => ({
      id: o.id, titulo: o.fase || `${o.nome} quitado`, desc: o.nota || `Saldo agora: $${Math.round(o.saldo).toLocaleString("pt-BR")}`,
      ok: o.saldo <= 0 || (o.ate && hojeISO > o.ate), quando: o.ate ? fromISO(o.ate) : null,
    })),
  ];
  const feitas = fases.filter((f) => f.ok).length;
  const atual = fases.find((f) => !f.ok) || null;

  // Dívida dos cartões: quanto já saiu desde o início
  const inicio = Number(seed.cartoesInicio) || 0; // ponto de partida (quando a carteira começou)
  const agora = seed.cartoes.reduce((a, c) => a + c.saldo, 0);
  const pagoCartoes = Math.max(0, inicio - agora);
  const fracPago = inicio ? pagoCartoes / inicio : 0;

  // Semanas em que a renda bateu a meta
  const semanasMeta = Object.keys(state.renda || {}).filter((iso) => rendaDa(state, iso) >= seed.metas.piso).length;

  const progresso = Math.min(1, 0.6 * (feitas / fases.length) + 0.4 * fracPago);

  return { fases, feitas, atual, progresso, pagoCartoes, inicioCartoes: inicio, agoraCartoes: agora, semanasMeta, fimCartoes: sim.fim };
}
