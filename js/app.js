// =========================================================
// APP — navegação por abas (hash) e ligação entre páginas e estado.
// =========================================================
import { SEED } from "./config/seed.js";
import { vazioState, save } from "./core/store.js";
import { renderHoje } from "./pages/hoje.js";
import { renderEmBreve } from "./pages/emBreve.js";
import { renderDividas } from "./pages/dividas.js";
import { renderExtra } from "./pages/extra.js";
import { renderContas } from "./pages/contas.js";
import { renderPlanejar } from "./pages/planejar.js";
import { renderDividir } from "./pages/dividir.js";
import { invalidate } from "./core/plan.js";
import { iniciar, agendar } from "./core/sync.js";
import { getSeed } from "./core/config.js";
import { setSimbolo } from "./core/format.js";
import { simboloDe, moedaBase, atualizarMercado } from "./core/cambio.js";
import { setCiclo, semanaAberta } from "./core/calendar.js";
import { dataTexto } from "./components/ui.js";
import { renderAjustes } from "./pages/ajustes.js";
import { renderHome } from "./pages/home.js";
import { renderLogin, renderNovaSenha } from "./pages/login.js";
import { renderNav, PAGINAS } from "./components/nav.js";
import { paginaLiberada } from "./core/modulos.js";
import { renderComecar, precisaComecar } from "./pages/comecar.js";

// Usuário logado (Supabase) e a carteira dele — preenchidos em iniciar()
let ultimo = "";
try { ultimo = localStorage.getItem("savia-wallet-ultimo") || ""; } catch { /* nada */ }
const ctx = { seed: SEED, usuario: null, userId: null, state: vazioState(), payday: null, ultimoUsuario: ultimo };
ctx.persist = () => {
  ctx.state.updatedAt = Date.now();
  save(ctx.state, ctx.usuario);
  invalidate(ctx.state);
  agendar(ctx);
};

const main = document.getElementById("main");
const nav = document.getElementById("nav");

function current() {
  const h = location.hash.slice(1);
  if (h === "compartilhado") return "dividir"; // nomes antigos
  if (h === "lyft") return "extra-lyft";
  if (h === "gastos") return "contas"; // Gastos agora fica em Minhas contas
  if (/^extra-[a-z0-9-]+$/.test(h)) return h;
  return PAGINAS.includes(h) ? h : "home";
}

function render(opts = {}) {
  // Cadeado: carregando a conta → espera; sem usuário → criar; sem sessão → entrar
  if (ctx.recuperar) { nav.hidden = true; return renderNovaSenha(main, ctx); }
  if (!ctx.usuario) {
    nav.hidden = true;
    if (ctx.sync === "loading") { main.innerHTML = `<p class="foot">Carregando…</p>`; return; }
    return renderLogin(main, ctx);
  }
  nav.hidden = false;
  let page = current();
  // Página de um módulo desligado: volta para a Home
  if (!paginaLiberada(ctx.state, page.startsWith("extra-") ? "extra" : page)) page = "home";
  setSimbolo(simboloDe(moedaBase(ctx.state)));
  ctx.seed = getSeed(ctx.state);
  atualizarMercado(ctx);
  // Ciclo de pagamento: se mudou, volta para o próximo pagamento
  const assinatura = JSON.stringify(ctx.seed.ciclo);
  if (assinatura !== ctx.cicloAtual) {
    setCiclo(ctx.seed.ciclo);
    if (ctx.cicloAtual) ctx.payday = semanaAberta(ctx.state);
    ctx.cicloAtual = assinatura;
  }
  if (!ctx.payday) ctx.payday = semanaAberta(ctx.state);
  renderNav(nav, page, ctx.menuAberto, ctx.state);

  // Primeira vez: monto o app com poucas perguntas
  if (page === "home" && precisaComecar(ctx)) { nav.hidden = true; renderComecar(main, ctx); }
  else if (page === "home") renderHome(main, ctx);
  else if (page === "hoje") renderHoje(main, ctx);
  else if (page === "dividas") renderDividas(main, ctx);
  else if (page === "extra" || page.startsWith("extra-")) renderExtra(main, ctx, page);
  else if (page === "planejar") renderPlanejar(main, ctx);
  else if (page === "contas") renderContas(main, ctx);
  else if (page === "dividir") renderDividir(main, ctx);
  else if (page === "ajustes") renderAjustes(main, ctx);
  else renderEmBreve(main, page);

  if (opts.focus) {
    const el = document.getElementById(opts.focus);
    if (el) { el.focus(); const v = el.value; el.value = ""; el.value = v; }
  }
}

ctx.rerender = render;

// Campos de data: atualiza o texto exibido e abre o seletor ao tocar
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.matches && el.matches('input[type="date"]')) {
    const d = el.closest(".date-wrap")?.querySelector(".date-display");
    if (d) d.textContent = dataTexto(el.value);
  }
});
document.addEventListener("click", (e) => {
  const el = e.target;
  if (el.matches && el.matches('.date-wrap input[type="date"]')) { try { el.showPicker(); } catch { /* sem suporte */ } }
});
window.addEventListener("hashchange", () => { ctx.menuAberto = false; render(); window.scrollTo(0, 0); });

// Menu "+": abre/fecha sem redesenhar a página
nav.addEventListener("click", (e) => {
  // não deixa o clique chegar ao "fechar ao tocar fora" (o botão é redesenhado)
  if (e.target.closest("#plus") || e.target.closest("[data-close]")) e.stopPropagation();
  if (e.target.closest("#plus")) { ctx.menuAberto = !ctx.menuAberto; renderNav(nav, current(), ctx.menuAberto, ctx.state); }
  else if (e.target.closest("[data-close]")) { ctx.menuAberto = false; renderNav(nav, current(), false, ctx.state); }
});
document.addEventListener("click", (e) => {
  if (ctx.menuAberto && !e.target.closest("#nav")) { ctx.menuAberto = false; renderNav(nav, current(), false, ctx.state); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ctx.menuAberto) { ctx.menuAberto = false; renderNav(nav, current(), false, ctx.state); } });
render();
iniciar(ctx);
