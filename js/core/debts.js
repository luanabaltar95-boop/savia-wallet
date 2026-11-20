// =========================================================
// DÍVIDAS — totais, juros e simulação de quitação dos cartões.
// Método: cada semana corre juros, paga os mínimos e manda a sobra
// do plano para o alvo da vez (seed.alvos). Cartão quitado libera o
// mínimo dele para o próximo alvo (efeito bola de neve).
// =========================================================

export function totais(seed) {
  const cartoes = seed.cartoes.reduce((a, c) => a + c.saldo, 0);
  const limite = seed.cartoes.reduce((a, c) => a + c.limite, 0);
  const outras = seed.outras.reduce((a, o) => a + o.saldo, 0);
  const jurosMes = seed.cartoes.reduce((a, c) => a + (c.saldo * c.apr) / 1200, 0);
  return { cartoes, limite, outras, total: cartoes + outras, uso: limite ? cartoes / limite : 0, jurosMes };
}

export function simularCartoes(seed, serie) {
  const bal = Object.fromEntries(seed.cartoes.map((c) => [c.id, c.saldo]));
  const byId = Object.fromEntries(seed.cartoes.map((c) => [c.id, c]));
  const quitacao = {};
  let juros = 0;

  for (const { payday, valor, fator: f = 1 } of serie) {
    let extra = valor;
    for (const c of seed.cartoes) {
      if (bal[c.id] <= 0) { extra += ((c.minimo * 12) / 52) * f; continue; }
      const j = ((bal[c.id] * c.apr) / 100 / 52) * f;
      juros += j;
      bal[c.id] += j - ((c.minimo * 12) / 52) * f;
    }
    for (const id of seed.alvos) {
      if (extra <= 0) break;
      if (bal[id] <= 0) continue;
      const pago = Math.min(extra, bal[id]);
      bal[id] -= pago;
      extra -= pago;
    }
    for (const id of seed.alvos) {
      if (bal[id] <= 0.005 && !quitacao[id]) { bal[id] = 0; quitacao[id] = payday; }
    }
    if (seed.alvos.every((id) => quitacao[id])) break;
  }

  const datas = Object.values(quitacao);
  const fim = seed.cartoes.length && datas.length === seed.cartoes.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : null;
  return { quitacao, fim, juros, byId };
}
