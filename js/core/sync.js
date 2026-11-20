// =========================================================
// SINCRONIZAÇÃO — guarda na conta (área privada só sua), para abrir
// igual no computador e no celular. O navegador guarda uma cópia local
// e o app funciona mesmo sem a conta. Vale a versão mais recente (updatedAt).
//   data/users/<id>/perfis      → usuários da conta + sessão
//   data/users/<id>/<doc>       → a carteira de cada usuário
// =========================================================
import { save, saveReg, load } from "./store.js";

const DEBOUNCE = 800;
let db = null, uid = null, ref = null, idxRef = null, desligar = null;
let writing = false, again = false, timer = null;

function normalizar(s) {
  return { renda: {}, pagos: {}, lyft: [], pedidos: [], juntas: [], config: {}, movs: [], recebimentos: [], gasolina: [], compart: {}, entradasExtra: [], gastos: [], bancos: [], updatedAt: 0, ...(s || {}) };
}

function aplicarRemoto(ctx, data) {
  try {
    const remoto = normalizar(JSON.parse(data.json));
    if ((remoto.updatedAt || 0) > (ctx.state.updatedAt || 0)) {
      ctx.state = remoto;
      save(remoto, ctx.doc);
      ctx.rerender();
    }
  } catch { /* documento inválido: ignora */ }
}

async function escrever(ctx) {
  if (!ref) return;
  if (writing) { again = true; return; }
  writing = true;
  try {
    await ref.set({ json: JSON.stringify(ctx.state), updatedAt: ctx.state.updatedAt || Date.now() });
    setStatus(ctx, "cloud");
  } catch (e) {
    setStatus(ctx, e && e.code === "unavailable" ? "cloud" : "error");
  } finally {
    writing = false;
    if (again) { again = false; escrever(ctx); }
  }
}

function setStatus(ctx, s) {
  if (ctx.sync === s) return;
  const carregava = ctx.sync === "loading";
  ctx.sync = s;
  if (carregava) return ctx.rerender(); // terminou de carregar: libera a tela de entrada
  const el = document.getElementById("sync-note");
  if (el) el.outerHTML = syncNote(ctx);
}

export function agendar(ctx) {
  if (!ref) return;
  clearTimeout(timer);
  timer = setTimeout(() => escrever(ctx), DEBOUNCE);
}

// Registro de usuários e sessão: local + conta
export async function salvarReg(ctx) {
  ctx.reg.updatedAt = Date.now();
  saveReg(ctx.reg);
  if (idxRef) { try { await idxRef.set({ json: JSON.stringify(ctx.reg), updatedAt: ctx.reg.updatedAt }); } catch { /* fica local */ } }
}

// Abre a carteira de um usuário (troca de doc)
export async function abrirCarteira(ctx, doc) {
  if (timer) { clearTimeout(timer); timer = null; await escrever(ctx); }
  if (desligar) { desligar(); desligar = null; }
  ctx.doc = doc;
  ctx.state = load(doc);
  ctx.payday = null;
  ref = db && uid ? db.doc(`data/users/${uid}/${doc}`) : null;
  if (!ref) return ctx.rerender();
  try {
    const snap = await ref.get();
    if (snap.exists) aplicarRemoto(ctx, snap.data());
    const remotoAt = snap.exists ? snap.data().updatedAt || 0 : 0;
    if ((ctx.state.updatedAt || 0) > remotoAt) await escrever(ctx);
    desligar = ref.onSnapshot((s) => { if (s.exists && !writing && !s.metadata.hasPendingWrites) aplicarRemoto(ctx, s.data()); }, () => {});
  } catch { /* segue local */ }
  ctx.rerender();
}

export async function iniciar(ctx) {
  ctx.sync = "loading";
  const use = window.claude && window.claude.use;
  if (!use) return setStatus(ctx, "local");

  const limite = setTimeout(() => setStatus(ctx, "local"), 10000);
  try {
    const [d, user] = await Promise.all([use("db"), use("user")]);
    uid = d && user ? await user.id() : null;
    if (!uid) { clearTimeout(limite); return setStatus(ctx, "local"); }
    db = d;

    // Usuários e sessão da conta
    idxRef = db.doc(`data/users/${uid}/perfis`);
    const idx = await idxRef.get();
    let remoto = null;
    try { remoto = idx.exists ? JSON.parse(idx.data().json) : null; } catch { /* inválido */ }
    if (!remoto || !(remoto.perfis || []).length) {
      // Conta antiga: usuário guardado dentro da carteira principal
      const leg = await db.doc(`data/users/${uid}/carteira`).get();
      let perfil = null;
      try { perfil = leg.exists ? JSON.parse(leg.data().json).perfil : null; } catch { /* nada */ }
      if (perfil && !ctx.reg.perfis.some((p) => p.usuario === perfil.usuario)) ctx.reg.perfis = [{ ...perfil, doc: "carteira" }, ...ctx.reg.perfis];
      if (ctx.reg.perfis.length) await salvarReg(ctx);
    } else if ((remoto.updatedAt || 0) >= (ctx.reg.updatedAt || 0)) {
      ctx.reg = { perfis: [], sessao: null, ...remoto };
      saveReg(ctx.reg);
    } else {
      await salvarReg(ctx);
    }
    clearTimeout(limite);

    // Abre a carteira de quem está logado
    const ativo = ctx.reg.sessao && ctx.reg.perfis.find((p) => p.usuario === ctx.reg.sessao);
    if (ativo) await abrirCarteira(ctx, ativo.doc);
    setStatus(ctx, "cloud");

    // Login/sair feito em outro aparelho chega aqui
    idxRef.onSnapshot((s) => {
      try {
        const r = JSON.parse(s.data().json);
        if ((r.updatedAt || 0) > (ctx.reg.updatedAt || 0)) { ctx.reg = r; saveReg(r); ctx.rerender(); }
      } catch { /* nada */ }
    }, () => {});
  } catch {
    clearTimeout(limite);
    ref = null; idxRef = null;
    setStatus(ctx, "local");
  }
}

// Só aparece quando há problema para salvar na conta
export function syncNote(ctx) {
  if (ctx.sync === "error") return `<p class="foot" id="sync-note">Não consegui salvar na conta agora. Está salvo neste navegador.</p>`;
  return `<span id="sync-note" hidden></span>`;
}
