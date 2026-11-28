// =========================================================
// CÂMBIO — moeda principal da carteira e contas em outras moedas.
//   state.config.moeda   moeda principal (padrão USD)
//   conta.moeda / conta.valorMoeda   conta em outra moeda (ex.: ARS)
//   state.cotacoes[ARS]  { taxa, fonte: "pagamento" | "manual", em }
//                        taxa = quantos ARS por 1 da moeda principal
//   state.mercado        { base, em, rates } cotação do dia (internet)
// A cotação que vale: a do meu último pagamento (já com taxas do banco/Wise)
// ou a que eu digitei; sem nenhuma, a do mercado.
// =========================================================
export const MOEDAS = [
  { id: "USD", label: "Dólar (USD)", simbolo: "$" },
  { id: "BRL", label: "Real (BRL)", simbolo: "R$" },
  { id: "ARS", label: "Peso argentino (ARS)", simbolo: "AR$" },
  { id: "EUR", label: "Euro (EUR)", simbolo: "€" },
  { id: "GBP", label: "Libra (GBP)", simbolo: "£" },
  { id: "CAD", label: "Dólar canadense (CAD)", simbolo: "CA$" },
  { id: "MXN", label: "Peso mexicano (MXN)", simbolo: "MX$" },
  { id: "CLP", label: "Peso chileno (CLP)", simbolo: "CLP$" },
  { id: "COP", label: "Peso colombiano (COP)", simbolo: "COL$" },
];
export const simboloDe = (id) => (MOEDAS.find((m) => m.id === id) || { simbolo: id + " " }).simbolo;
export const moedaBase = (state) => ((state && state.config) || {}).moeda || "USD";
export const emOutraMoeda = (state, it) => !!(it && it.moeda && it.moeda !== moedaBase(state) && Number(it.valorMoeda) > 0);

const r2 = (n) => Math.round(n * 100) / 100;

// Quantas unidades da moeda valem 1 da moeda principal
export function cotacao(state, moeda) {
  if (!moeda || moeda === moedaBase(state)) return { taxa: 1, fonte: "base" };
  const c = (state.cotacoes || {})[moeda];
  if (c && c.taxa > 0) return c;
  const m = state.mercado;
  if (m && m.base === moedaBase(state) && m.rates && m.rates[moeda]) return { taxa: m.rates[moeda], fonte: "mercado", em: m.em };
  return null;
}

// Valor na moeda principal (null se ainda não tenho cotação)
export function converter(state, valorMoeda, moeda) {
  const c = cotacao(state, moeda);
  return c ? r2(Number(valorMoeda) / c.taxa) : null;
}

// Contas em outra moeda ganham o valor convertido (o resto do app usa "valor")
export function converterItens(state, lista) {
  return (lista || []).map((it) => {
    if (!emOutraMoeda(state, it)) return it;
    const c = cotacao(state, it.moeda);
    // Sem cotação: o valor fica como estava e o item é marcado (o app avisa que falta dado)
    if (!c) return { ...it, semCotacao: true };
    return { ...it, valor: r2(Number(it.valorMoeda) / c.taxa), cotacao: { taxa: c.taxa, fonte: c.fonte, em: c.em || null } };
  });
}

// Paguei X na moeda e saiu Y da minha conta: essa é a cotação real
export function aprender(state, moeda, valorMoeda, valorBase) {
  if (!(valorMoeda > 0) || !(valorBase > 0) || moeda === moedaBase(state)) return;
  state.cotacoes = { ...(state.cotacoes || {}), [moeda]: { taxa: Math.round((valorMoeda / valorBase) * 10000) / 10000, fonte: "pagamento", em: Date.now() } };
}

export function definirCotacao(state, moeda, taxa) {
  const c = { ...(state.cotacoes || {}) };
  if (taxa > 0) c[moeda] = { taxa, fonte: "manual", em: Date.now() };
  else delete c[moeda];
  state.cotacoes = c;
}

// Moedas usadas nas minhas contas
export function moedasUsadas(state) {
  const c = state.config || {};
  const s = new Set();
  ["semanais", "mensais", "parcelas", "pontuais", "compartilhadas"].forEach((k) => (c[k] || []).forEach((it) => { if (emOutraMoeda(state, it)) s.add(it.moeda); }));
  Object.keys(state.cotacoes || {}).forEach((m) => { if (m !== moedaBase(state)) s.add(m); });
  return [...s];
}

// Cotação do dia pela internet (no máximo a cada 12h)
let buscando = false;
export async function atualizarMercado(ctx) {
  const st = ctx.state, base = moedaBase(st);
  const m = st.mercado;
  if (buscando || !moedasUsadas(st).length) return;
  if (m && m.base === base && Date.now() - m.em < 12 * 3600 * 1000) return;
  buscando = true;
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const j = await r.json();
    if (j && j.rates) { st.mercado = { base, em: Date.now(), rates: j.rates }; ctx.persist(); ctx.rerender(); }
  } catch { /* sem internet: fica a última cotação */ }
  buscando = false;
}

export const fmtMoeda = (valor, moeda) => `${simboloDe(moeda)}${Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
