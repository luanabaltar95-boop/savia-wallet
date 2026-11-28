// =========================================================
// NECESSIDADES — o que cada objetivo precisa saber, e onde isso
// já está na carteira. Fonte única: nada é perguntado de novo se
// já existe; só o que falta ou está incompleto vira pedido.
//   ok(seed, state, g)  → já tenho essa informação?
//   pendencias(...)     → detalhes incompletos (ex.: cartão sem juros)
//   onde                → seção de Ajustes ({ sec }) ou página ({ href })
// =========================================================
import { parte } from "../core/config.js";
import { moedasUsadas, moedaBase } from "../core/cambio.js";
import { tipo } from "./tipos.js";

const n = (v) => Number(v) || 0;
const temEntradas = (state) => ((state.config || {}).entradas || []).length > 0 || Object.keys(state.renda || {}).length > 0;

export const NECESSIDADES = {
  pagamento: { label: "Quando e quanto recebo", onde: { sec: "ciclo" },
    ok: (seed, state) => temEntradas(state) },
  bancos: { label: "Minhas contas bancárias", onde: { sec: "bancos" },
    ok: (seed, state) => (state.bancos || []).length > 0 },
  contas: { label: "Contas que pago (fixas e da semana)", onde: { sec: "contas" },
    ok: (seed) => seed.mensais.length + seed.semanais.length > 0 },
  dividas: { label: "Cartões e dívidas", onde: { sec: "cartoes" },
    ok: (seed) => seed.cartoes.length + seed.outras.length + seed.parcelas.length + seed.pontuais.filter((p) => p.atrasado).length > 0,
    pendencias: (seed) => {
      const semJuros = seed.cartoes.filter((c) => n(c.saldo) > 0 && !n(c.apr)).length;
      const semMinimo = seed.cartoes.filter((c) => n(c.saldo) > 0 && !n(c.minimo)).length;
      return [
        semJuros ? { id: "apr", label: `Juros (APR) de ${semJuros} ${semJuros === 1 ? "cartão" : "cartões"}`, onde: { sec: "cartoes" } } : null,
        semMinimo ? { id: "minimo", label: `Pagamento mínimo de ${semMinimo} ${semMinimo === 1 ? "cartão" : "cartões"}`, onde: { sec: "cartoes" } } : null,
      ].filter(Boolean);
    } },
  valor: { label: "Quanto quero alcançar", onde: { sec: "objetivo" },
    // Reserva sem valor usa meses de contas (estimativa); personalizado pode ser por etapas
    ok: (seed, state, g) => !g || n(g.alvo) > 0 || g.tipo === "reserva" || (g.tipo === "personalizado" && g.etapas.length > 0),
    pendencias: (seed, state, g) => (g && tipo(g.tipo).dinheiro && !n(g.semanal) && (n(g.alvo) > 0 || g.tipo === "reserva")
      ? [{ id: "semanal", label: "Quanto guardar por semana", onde: { sec: "objetivo" } }] : []) },
  moedas: { label: "Moedas que uso", onde: { href: "#cambio" },
    ok: (seed, state) => !!(state.config || {}).moeda && (moedasUsadas(state).some((m) => m !== moedaBase(state)) || (state.bancos || []).some((b) => b.moeda && b.moeda !== moedaBase(state))) },
  familia: { label: "Contas divididas com a família", onde: { href: "#dividir" },
    ok: (seed, state) => parte(state, "compartilhadas").length > 0 || seed.semanais.some((s) => s.compartilhado) || seed.mensais.some((s) => s.compartilhado) },
};

// O que falta para um objetivo (sem repetir o que já existe)
export function faltando(seed, state, g) {
  const out = [];
  tipo(g.tipo).precisa.forEach((id) => {
    const nec = NECESSIDADES[id];
    if (!nec) return;
    if (!nec.ok(seed, state, g)) out.push({ id, label: nec.label, onde: nec.onde });
    else if (nec.pendencias) out.push(...nec.pendencias(seed, state, g));
  });
  return out;
}

// União das necessidades de vários tipos, cada uma uma vez só
export function necessidadesDe(tipos) {
  return [...new Set(tipos.flatMap((t) => tipo(t).precisa))];
}
