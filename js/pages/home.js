// =========================================================
// PÁGINA HOME — a trajetória dos MEUS objetivos (Goal Engine).
// O cenário melhora a cada etapa cumprida; alterno entre o caminho
// inteiro e cada objetivo. A etapa da vez fica logo abaixo do desenho.
// =========================================================
import { syncNote } from "../core/sync.js";
import { MARCA } from "../config/marca.js";
import { money, monthYear } from "../core/format.js";
import { card, stats, esc } from "../components/ui.js";
import { scene, montarCena } from "../components/scene.js";
import { avaliar, caminho, registrarHistorico } from "../goals/engine.js";
import { migrarSePreciso } from "../goals/modelo.js";
import { toISO, semanaAberta } from "../core/calendar.js";
import { recomendacoes } from "../goals/recomendacoes.js";
import { recursos } from "../goals/recursos.js";
import { etapaHtml, quandoTexto, fonteTag } from "../components/objetivos.js";

const GEAR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`;

const FRASES = [
  "O primeiro passo é o mais difícil — e eu já comecei.",
  "Cada conta em dia limpa um pouco o céu.",
  "O sol já está aparecendo.",
  "O caminho está mais leve a cada semana.",
  "Quase lá: a casa já está com a luz acesa.",
  "Cheguei. Céu limpo.",
];

// Carteira sem nada cadastrado (a Hoje usa para o estado vazio)
export const carteiraVazia = (s) => !s.cartoes.length && !s.mensais.length && !s.semanais.length && !s.outras.length && !s.parcelas.length && !s.pontuais.length;

// Sem objetivos ainda: convite para escolher
function semObjetivos(root, ctx) {
  root.innerHTML = `
    <header class="page-head home-head">
      <div class="brand"><img class="brand-logo" src="icons/icon-192.png" alt="" width="44" height="44">
        <div><p class="eyebrow">${MARCA}</p><h1>Meu caminho</h1></div></div>
      <a class="btn icon" href="#ajustes" aria-label="Ajustes">${GEAR}</a>
    </header>
    <section class="card scene-card">${scene(0)}
      <div class="scene-foot"><p class="scene-msg">O que eu quero alcançar? Escolho meus objetivos e a carteira monta o caminho com os meus dados.</p>
      <a class="btn primary" href="#ajustes" id="home-escolher">Escolher meus objetivos</a></div>
    </section>
    ${syncNote(ctx)}`;
  root.querySelector("#home-escolher").onclick = () => { ctx.openSec = "objetivo"; ctx.obNovo = true; };
}

// Para onde vai o dinheiro desta semana (mesmo plano da Hoje)
function dinheiroSemana(seed, state) {
  if (!Object.keys((state.config || {}).entradas || {}).length && !Object.keys(state.renda || {}).length) return "";
  const r = recursos(seed, state, semanaAberta(state));
  const linha = (label, v, f, cls = "") => `<li class="${cls}"><span>${esc(label)}</span><b class="num">${money(v, true)}</b>${f ? fonteTag(f) : ""}</li>`;
  return `<details class="card recursos-card"><summary class="card-head"><h2>Dinheiro deste período</h2><span class="total num">${money(r.potencialObjetivos, true)} para objetivos</span></summary>
    <ul class="recursos">
      ${linha("Entra", r.entra, r.entraFonte, "forte")}
      ${r.baldes.filter((b) => !["objetivos", "pedidos"].includes(b.id) && b.precisa > 0).map((b) => linha(`− ${b.label}`, b.precisa, "")).join("")}
      ${linha(r.faltaParaObrigacoes > 0 ? "Falta para as contas" : "= Sobra para objetivos", r.faltaParaObrigacoes || r.potencialObjetivos, "", "forte")}
      ${r.objetivos.map((o) => linha(`− ${o.nome}${o.recebe < o.pede - 0.005 ? ` (pede ${money(o.pede, true)})` : ""}`, o.recebe, "")).join("")}
      ${r.baldes.find((b) => b.id === "pedidos").precisa > 0 ? linha("− Pedidos e ocasiões", r.baldes.find((b) => b.id === "pedidos").coberto, "") : ""}
      ${linha("= Livre (vai para a dívida que mais custa)", r.livre, "projecao", "forte")}
      ${linha("Já paguei neste período", r.jaPago, "confirmado", "sub")}
      ${r.saldoFonte !== "pendente" ? linha("Nas minhas contas agora", r.saldo, r.saldoFonte, "sub") : ""}
    </ul></details>`;
}

const rotuloFase = (i, n) => `Etapa ${Math.min(i + 1, n)} de ${n}`;

export function renderHome(root, ctx) {
  const { seed, state } = ctx;
  // Carteira antiga: grava os objetivos derivados (sem apagar nada) e
  // tira a foto da semana para o histórico (previsão melhorou/piorou)
  const migrou = migrarSePreciso(state);
  const todos = avaliar(seed, state);
  if (registrarHistorico(state, todos, toISO(semanaAberta(state))) || migrou) ctx.persist();
  const av = todos.filter((a) => !a.emBreve);
  if (!av.length) return semObjetivos(root, ctx);

  // O que está em vista: o caminho todo ou um objetivo
  const vista = av.length > 1 && (ctx.homeVista === "caminho" || !av.some((a) => a.id === ctx.homeVista)) ? "caminho" : ctx.homeVista && av.some((a) => a.id === ctx.homeVista) ? ctx.homeVista : av.length > 1 ? "caminho" : av[0].id;
  const um = vista === "caminho" ? null : av.find((a) => a.id === vista);
  const c = um ? { etapas: um.etapas, progresso: um.progresso, atual: um.atual } : caminho(av);
  const etapas = c.etapas;
  const feitas = etapas.filter((e) => e.ok).length;
  const continuo = um && um.continuo;
  const p = c.progresso;
  const frase = continuo ? (p >= 1 ? "Tudo em dia. Céu limpo." : "Cada cuidado em dia limpa um pouco o céu.")
    : FRASES[Math.min(FRASES.length - 1, Math.floor(p * (FRASES.length - 1) + 0.0001))];
  const titulo = continuo ? `${feitas} de ${etapas.length} em dia` : etapas.length ? (c.atual ? rotuloFase(feitas, etapas.length) : "Cheguei!") : (um ? um.titulo : "Meu caminho");
  const rodape = continuo ? `${feitas} de ${etapas.length} cuidados em dia` : um ? `${Math.round(p * 100)}% de ${um.titulo}` : `${Math.round(p * 100)}% do meu caminho`;

  const recs = recomendacoes(seed, state, av, um ? um.id : null).slice(0, 4);
  const recHtml = recs.length ? `<ul class="recs">${recs.map((r) => `<li>${r.href ? `<a href="${r.href}">` : r.sec ? `<a href="#ajustes" data-abrir-sec="${r.sec}">` : "<span>"}${esc(r.texto)}${r.href || r.sec ? "</a>" : "</span>"} ${fonteTag(r.tipo)}</li>`).join("")}</ul>` : "";
  const dinheiro = um && um.valor && um.valor.alvo > 0
    ? `<p class="hint">${um.tipo === "dividas" ? "Já quitei" : "Tenho"} ${money(um.valor.atual)} de ${money(um.valor.alvo)} ${fonteTag(um.valor.fonte)}${um.valor.fonteAlvo === "estimativa" ? ` · alvo ${fonteTag("estimativa")}` : ""}</p>` : "";
  const atual = c.atual;
  const agora = atual
    ? `<p class="eyebrow">${continuo ? "Para ficar em dia" : "Etapa da vez"}${!um && atual.objetivoTitulo ? ` · ${esc(atual.objetivoTitulo)}` : ""}</p>
       <div class="name big-sm">${esc(atual.titulo)}</div>
       <p class="hint">${esc(atual.desc || "")}${atual.quando ? ` · previsão ${quandoTexto(atual.quando)}` : ""}</p>`
    : `<div class="name big-sm">${etapas.length ? (continuo ? "Tudo em dia ✓" : "Objetivo alcançado 🎉") : "Sem etapas ainda"}</div>
       ${!etapas.length ? `<p class="hint">Faltam dados para montar as etapas.</p>` : ""}`;
  const placar = (um ? um.tipo === "dividas" && um : av.find((a) => a.tipo === "dividas")) || null;

  root.innerHTML = `
    <header class="page-head home-head">
      <div class="brand">
        <img class="brand-logo" src="icons/icon-192.png" alt="" width="44" height="44">
        <div><p class="eyebrow">${MARCA} · ${um ? esc(um.label.toLowerCase()) : "meu caminho"}</p><h1>${esc(titulo)}</h1></div>
      </div>
      <a class="btn icon" href="#ajustes" aria-label="Ajustes">${GEAR}</a>
    </header>
    ${av.length > 1 ? `<nav class="ob-chips" aria-label="Meus objetivos">
      <button type="button" class="ob-chip ${vista === "caminho" ? "on" : ""}" data-vista="caminho">Meu caminho</button>
      ${av.map((a) => `<button type="button" class="ob-chip ${vista === a.id ? "on" : ""}" data-vista="${a.id}">${a.icone} ${esc(a.titulo)}</button>`).join("")}
    </nav>` : ""}

    <section class="card scene-card">
      ${scene(p)}
      <div class="scene-foot">
        <p class="scene-msg">${frase}</p>
        <div class="track" role="progressbar" aria-valuenow="${Math.round(p * 100)}" aria-valuemin="0" aria-valuemax="100"><div class="fill" style="width:${p * 100}%"></div></div>
        <p class="hint">${esc(rodape)}</p>
      </div>
    </section>

    <section class="card next agora-card">
      ${agora}
      ${dinheiro}
      ${recHtml}
      <a class="btn primary" href="#hoje">Ver meu plano</a>
    </section>

    ${dinheiroSemana(seed, state)}

    ${placar && placar.extra ? card({
      title: "Placar",
      body: stats([
        { label: "Já saiu dos cartões", valor: money(placar.extra.placar.pagoCartoes), sub: `de ${money(placar.extra.placar.inicioCartoes)}` },
        { label: "Semanas no piso", valor: String(placar.extra.placar.semanasMeta), sub: `≥ ${money(seed.metas.piso)}` },
        { label: "Cartões livres", valor: placar.extra.placar.fimCartoes ? monthYear(new Date(placar.extra.placar.fimCartoes + "T12:00")) : "—", sub: "previsão" },
      ]),
    }) : ""}

    ${etapas.length ? `<details class="card trilha-card"><summary class="card-head"><h2>Todas as etapas</h2><span class="total">${feitas}/${etapas.length}</span></summary>
      <ol class="cam-lista">${etapas.map((e, i) => etapaHtml(e, i, atual)).join("")}</ol></details>` : ""}

    ${syncNote(ctx)}
  `;

  montarCena(root, etapas);
  root.querySelectorAll("[data-vista]").forEach((b) => (b.onclick = () => { ctx.homeVista = b.dataset.vista; ctx.rerender(); }));
  root.querySelectorAll("[data-abrir-sec]").forEach((a) => (a.onclick = () => { ctx.openSec = a.dataset.abrirSec; }));
}
