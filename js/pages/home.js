// =========================================================
// PÁGINA HOME — minha trajetória como um jogo: o cenário melhora
// a cada fase cumprida e a cada dólar que sai dos cartões.
// =========================================================
import { syncNote } from "../core/sync.js";
import { MARCA } from "../config/marca.js";
import { jornada } from "../core/jornada.js";
import { money, monthYear, dayLabel } from "../core/format.js";
import { card, stats, esc } from "../components/ui.js";
import { scene, montarCena } from "../components/scene.js";
import { ativo } from "../core/modulos.js";
import { rendaEfetiva } from "../core/plan.js";
import { caixaDaSemana, contasCorrentes } from "../core/caixa.js";
import { saldoAtual } from "../core/saldo.js";
import { toISO, semanaAberta } from "../core/calendar.js";

const GEAR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`;

const FRASES = [
  "O primeiro passo é o mais difícil — e eu já comecei.",
  "Cada conta em dia limpa um pouco o céu.",
  "O sol já está aparecendo.",
  "O caminho está mais leve a cada semana.",
  "Quase lá: a casa já está com a luz acesa.",
  "Cheguei. Céu limpo.",
];

// Carteira nova: os 5 passos de Ajustes
const PASSOS = [
  { id: "ciclo", titulo: "Meu pagamento", desc: "Quando recebo e quanto", feito: (s, st) => !!(st.config || {}).ciclo || (s.metas.meta > 0) },
  { id: "contas", titulo: "Minhas contas", desc: "Fixas, da semana e em atraso", feito: (s) => s.mensais.length + s.semanais.length + s.pontuais.length > 0 },
  { id: "cartoes", titulo: "Cartões", desc: "Saldo, mínimo, juros e vencimento", feito: (s) => s.cartoes.length > 0 },
  { id: "dividas", titulo: "Dívidas", desc: "Empréstimos e o que não é cartão", feito: (s) => s.outras.length > 0 },
  { id: "financiamentos", titulo: "Financiamentos", desc: "Carro, Affirm, parcelados", feito: (s) => s.parcelas.length > 0 },
];
export const carteiraVazia = (s) => !s.cartoes.length && !s.mensais.length && !s.semanais.length && !s.outras.length && !s.parcelas.length && !s.pontuais.length;

function boasVindas(root, ctx) {
  const { seed, state } = ctx;
  const lista = PASSOS.map((p, i) => {
    const ok = p.feito(seed, state);
    return `<li class="fase ${ok ? "ok" : i === 0 ? "atual" : ""}">
      <span class="fase-n">${ok ? "✓" : i + 1}</span>
      <a href="#ajustes" data-passo="${p.id}"><div class="name">${p.titulo}</div><div class="hint">${p.desc}</div></a>
    </li>`;
  }).join("");
  root.innerHTML = `
    <header class="page-head home-head">
      <div class="brand">
        <img class="brand-logo" src="icons/icon-192.png" alt="" width="44" height="44">
        <div><p class="eyebrow">${MARCA}</p><h1>Minha carteira</h1></div>
      </div>
    </header>
    <section class="card scene-card">
      ${scene(0)}
      <div class="scene-foot"><p class="scene-msg">Vou montar minha carteira em 5 passos. Depois ela me diz, a cada pagamento, o que pagar, o que guardar e quando fico livre das dívidas.</p></div>
    </section>
    ${card({ title: "Montar minha carteira", body: `<ol class="trilha">${lista}</ol><a class="btn primary" href="#ajustes" data-passo="ciclo">Começar</a>` })}
    ${syncNote(ctx)}`;
  root.querySelectorAll("[data-passo]").forEach((a) => a.addEventListener("click", () => { ctx.openSec = a.dataset.passo; }));
}

// Sem o módulo de dívidas: a Home é o resumo da semana e das contas
function homeSimples(root, ctx) {
  const { seed, state } = ctx;
  const iso = toISO(semanaAberta(state));
  const cx = caixaDaSemana(state, iso, rendaEfetiva(seed, state, iso).valor);
  const contas = contasCorrentes(state).map((b) => ({ b, s: saldoAtual(state, b) }));
  root.innerHTML = `
    <header class="page-head home-head">
      <div class="brand"><img class="brand-logo" src="icons/icon-192.png" alt="" width="44" height="44">
        <div><p class="eyebrow">${MARCA}</p><h1>Minha carteira</h1></div></div>
      <a class="btn icon" href="#ajustes" aria-label="Ajustes">${GEAR}</a>
    </header>
    ${card({ title: "Esta semana", body: `${stats([
        { label: "Entra", valor: money(cx.total.entra) },
        { label: "Já saiu", valor: money(cx.total.paguei + cx.total.ajuste) },
        { label: "Disponível", valor: money(cx.total.disponivel) },
      ])}<a class="btn primary" href="#hoje">Ver o que pagar</a>` })}
    ${card({ title: "Nas minhas contas", body: `<ul class="resumo-lista">${contas.map(({ b, s }) => `<li><div class="rs-nome"><span>${esc(b.banco)}</span></div><b>${s == null ? "—" : money(s, true)}</b></li>`).join("")}</ul><a class="link" href="#contas">ver contas</a>` })}
    ${syncNote(ctx)}`;
}

export function renderHome(root, ctx) {
  const { seed, state } = ctx;
  if (!ativo(state, "dividas")) return homeSimples(root, ctx);
  if (carteiraVazia(seed)) return boasVindas(root, ctx);
  const j = jornada(seed, state);
  const n = j.fases.length;
  const frase = FRASES[Math.min(FRASES.length - 1, Math.floor(j.progresso * (FRASES.length - 1) + 0.0001))];

  const trilha = j.fases.map((f, i) => {
    const estado = f.ok ? "ok" : f === j.atual ? "atual" : "trancada";
    const quando = f.ok ? "cumprida" : f.quando ? `previsão: ${i < 3 ? dayLabel(f.quando) : monthYear(f.quando)}` : "depois dos cartões";
    return `<li class="fase ${estado}">
      <span class="fase-n">${f.ok ? "✓" : i + 1}</span>
      <div><div class="name">${esc(f.titulo)}</div><div class="hint">${esc(f.desc)} · ${quando}</div></div>
    </li>`;
  }).join("");

  root.innerHTML = `
    <header class="page-head home-head">
      <div class="brand">
        <img class="brand-logo" src="icons/icon-192.png" alt="" width="44" height="44">
        <div>
        <p class="eyebrow">${MARCA} · minha jornada</p>
        <h1>Nível ${j.feitas} de ${n}</h1>
        </div>
      </div>
      <a class="btn icon" href="#ajustes" aria-label="Ajustes">${GEAR}</a>
    </header>

    <section class="card scene-card">
      ${scene(j.progresso)}
      <div class="scene-foot">
        <p class="scene-msg">${frase}</p>
        <div class="track" role="progressbar" aria-valuenow="${Math.round(j.progresso * 100)}" aria-valuemin="0" aria-valuemax="100"><div class="fill" style="width:${Math.max(2, j.progresso * 100)}%"></div></div>
        <p class="hint">${Math.round(j.progresso * 100)}% do caminho até ficar livre das dívidas</p>
      </div>
    </section>

    ${j.atual ? card({
      title: "Próxima fase",
      cls: "next",
      body: `<div class="name big-sm">${esc(j.atual.titulo)}</div>
        <p class="hint">${esc(j.atual.desc)}${j.atual.quando ? ` · previsão ${j.fases.indexOf(j.atual) < 3 ? dayLabel(j.atual.quando) : monthYear(j.atual.quando)}` : ""}</p>
        <a class="btn primary" href="#hoje">Ver a lista desta sexta</a>`,
    }) : ""}

    ${card({
      title: "Placar",
      body: stats([
        { label: "Já saiu dos cartões", valor: money(j.pagoCartoes), sub: `de ${money(j.inicioCartoes)}` },
        { label: "Semanas no piso", valor: String(j.semanasMeta), sub: `≥ ${money(seed.metas.piso)}` },
        { label: "Cartões livres", valor: j.fimCartoes ? monthYear(j.fimCartoes) : "—", sub: "previsão" },
      ]),
    })}

    ${card({ title: "A trilha", body: `<ol class="trilha">${trilha}</ol>` })}

    ${syncNote(ctx)}
  `;

  montarCena(root, j.fases);
}
