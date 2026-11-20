import { syncNote } from "../core/sync.js";
// =========================================================
// PÁGINA DÍVIDAS — quanto deve, ordem de ataque dos cartões
// e quando cada um fica quitado, usando a sobra do plano semanal.
// =========================================================
import { totais, simularCartoes } from "../core/debts.js";
import { serieAtaque } from "../core/plan.js";
import { nextPayday } from "../core/calendar.js";
import { money, monthYear } from "../core/format.js";
import { card, chip, debtRow, stats, esc } from "../components/ui.js";
import { movsDoCartao } from "../core/config.js";
import { toISO, fromISO } from "../core/calendar.js";
import { shortDate } from "../core/format.js";


export function renderDividas(root, ctx) {
  const { seed, state } = ctx;
  if (!seed.cartoes.length && !seed.outras.length) {
    root.innerHTML = `<header class="page-head"><p class="eyebrow">Dívidas</p><h1>Nenhuma dívida cadastrada</h1></header>
      ${card({ title: "Cartões e outras dívidas", body: `<p>Nada cadastrado ainda.</p><a class="btn primary" href="#ajustes">Ir para Ajustes</a>` })}`;
    return;
  }
  const t = totais(seed);
  const sim = simularCartoes(seed, serieAtaque(seed, state, nextPayday()));

  const titulo = !seed.cartoes.length ? "Minhas dívidas"
    : sim.fim ? `Cartões quitados em ${monthYear(sim.fim)}`
    : "Cartões: quitação depois de 3 anos no ritmo atual";

  const cartoes = seed.alvos.map((id, k) => {
    const c = sim.byId[id];
    const uso = c.saldo / c.limite;
    const tags = [chip(`${c.apr.toFixed(2).replace(".", ",")}% ao ano`, c.apr >= 29 ? "miss" : "part")];
    if (c.limite && c.saldo > c.limite) tags.push(chip("acima do limite", "miss"));
    const movs = movsDoCartao(state, c);
    const compras = movs.filter((m) => m.tipo === "compra").reduce((a, m) => a + Number(m.valor), 0);
    const pagos = movs.filter((m) => m.tipo === "pagamento").reduce((a, m) => a + Number(m.valor), 0);
    if (c.saldo <= 0) tags.push(chip("quitado ✓", "ok"));
    else if (sim.quitacao[id]) tags.push(chip(`quitado ${monthYear(sim.quitacao[id])}`, "ok"));
    if (compras) tags.push(chip(`+${money(compras)} em compras novas`, "miss"));
    if (pagos) tags.push(chip(`−${money(pagos)} pago`, "ok"));
    return debtRow({
      rank: k + 1,
      nome: c.nome,
      saldo: c.saldo,
      tags,
      uso,
      sub: `${Math.round(uso * 100)}% do limite de ${money(c.limite)} · mínimo ≈ ${money(c.minimo)} · vence dia ${c.dia}`,
    });
  }).join("");

  const outras = seed.outras.map((o) => debtRow({
    nome: o.nome,
    saldo: o.saldo,
    tags: o.pago ? [chip(`−${money(o.pago, true)} pagos`, "ok")] : [],
    sub: `${o.parcela ? `${money(o.parcela, true)}/mês · ` : ""}${o.nota}`,
  })).join("");


  root.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">Dívidas</p>
      <h1>${titulo}</h1>
    </header>

    ${card({
      title: "Quanto devo hoje",
      body: `<div class="big">${money(t.total)}</div>
        ${stats([
          { label: "Cartões", valor: money(t.cartoes), sub: `${Math.round(t.uso * 100)}% do limite` },
          { label: "Outras", valor: money(t.outras), sub: `${seed.outras.length} dívidas` },
          { label: "Juros dos cartões", valor: `≈ ${money(t.jurosMes)}`, sub: "por mês" },
        ])}`,
    })}

    ${card({
      title: "Ordem de ataque — cartões",
      hint: "Juros mais altos primeiro",
      body: `<ul class="debts">${cartoes}</ul>`,
    })}



    ${card({
      title: "Outras dívidas",
      hint: "",
      body: `<ul class="debts">${outras}</ul>`,
    })}

    <p class="foot">Previsão aproximada: juros estimados em alguns cartões e mínimos a confirmar nas faturas. Juros totais até quitar ≈ ${money(sim.juros)}.</p>
      ${syncNote(ctx)}
  `;

}
