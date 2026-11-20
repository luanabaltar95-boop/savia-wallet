// =========================================================
// SINCRONIZAÇÃO — carrega e salva a carteira no Supabase.
// Vale a versão mais recente (updatedAt). Cópia local para abrir rápido.
// =========================================================
import { backend, configurado } from "./backend.js";
import { load, save } from "./store.js";

const DEBOUNCE = 800;
let timer = null, writing = false, again = false;

function setStatus(ctx, s) {
  if (ctx.sync === s) return;
  const carregava = ctx.sync === "loading";
  ctx.sync = s;
  if (carregava) return ctx.rerender();
  const el = document.getElementById("sync-note");
  if (el) el.outerHTML = syncNote(ctx);
}

async function escrever(ctx) {
  if (!ctx.userId) return;
  if (writing) { again = true; return; }
  writing = true;
  try { await backend.salvar(ctx.userId, ctx.state); setStatus(ctx, "cloud"); }
  catch (err) { console.error("salvar", err); ctx.erro = err && err.message; setStatus(ctx, "error"); }
  finally { writing = false; if (again) { again = false; escrever(ctx); } }
}

export function agendar(ctx) {
  clearTimeout(timer);
  timer = setTimeout(() => escrever(ctx), DEBOUNCE);
}

// Depois do login: carrega a carteira da pessoa
export async function abrirCarteira(ctx, sessao) {
  ctx.usuario = sessao.usuario;
  ctx.userId = sessao.id;
  ctx.state = load(sessao.usuario);
  ctx.payday = null;
  try {
    await backend.reivindicar();
    const remoto = await backend.carregar();
    if (remoto && (remoto.updatedAt || 0) >= (ctx.state.updatedAt || 0)) { ctx.state = { ...ctx.state, ...remoto }; save(ctx.state, ctx.usuario); }
    else if ((ctx.state.updatedAt || 0) > ((remoto && remoto.updatedAt) || 0)) await escrever(ctx);
    setStatus(ctx, "cloud");
  } catch (err) { console.error("carregar", err); ctx.erro = err && err.message; setStatus(ctx, "error"); }
  ctx.rerender();
}

export async function sairDaConta(ctx) {
  if (timer) { clearTimeout(timer); timer = null; await escrever(ctx); }
  await backend.sair();
  ctx.usuario = null; ctx.userId = null;
}

export async function iniciar(ctx) {
  ctx.sync = "loading";
  if (!configurado()) return setStatus(ctx, "config");
  // Chegou pelo link "esqueci minha senha": mostra a tela de nova senha
  backend.aoRecuperar(() => { ctx.recuperar = true; ctx.rerender(); });
  try {
    const s = await backend.sessao();
    if (s) await abrirCarteira(ctx, s);
    setStatus(ctx, "cloud");
  } catch { setStatus(ctx, "error"); }
  ctx.rerender();
}

export function syncNote(ctx) {
  if (ctx.sync === "error") return `<p class="foot" id="sync-note">Não consegui falar com o servidor agora. Está salvo neste aparelho.${ctx.erro ? `<br><small>${String(ctx.erro).replace(/[<>&]/g, "")}</small>` : ""}</p>`;
  return `<span id="sync-note" hidden></span>`;
}
