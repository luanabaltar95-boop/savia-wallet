// =========================================================
// BACKEND — login e dados no Supabase.
// Tabelas: wallet_perfis (@usuario) e wallet_carteiras (dados da carteira),
// protegidas por RLS: cada pessoa só lê e grava a própria linha.
// Com ?mock na URL usa um backend falso no navegador (para testes).
// =========================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL_DOMINIO } from "../config/backend.js";

const emailDe = (usuario) => `${usuario}@${EMAIL_DOMINIO}`;
const usuarioDe = (user) => (user && (user.user_metadata?.usuario || String(user.email || "").split("@")[0])) || null;

let sb = null;
async function cliente() {
  if (sb) return sb;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "savia-wallet-auth" } });
  return sb;
}

const real = {
  async sessao() {
    const c = await cliente();
    const { data } = await c.auth.getSession();
    return data.session ? { usuario: usuarioDe(data.session.user), id: data.session.user.id } : null;
  },
  async entrar(usuario, senha) {
    const c = await cliente();
    const { data, error } = await c.auth.signInWithPassword({ email: emailDe(usuario), password: senha });
    if (error) throw new Error("Usuário ou senha incorretos.");
    return { usuario: usuarioDe(data.user), id: data.user.id };
  },
  async criar(usuario, senha) {
    const c = await cliente();
    const livre = await c.rpc("wallet_usuario_livre", { p_usuario: usuario });
    if (livre.error) throw new Error("Não consegui verificar o usuário agora.");
    if (!livre.data) throw new Error("Esse usuário já existe.");
    const { data, error } = await c.auth.signUp({ email: emailDe(usuario), password: senha, options: { data: { usuario } } });
    if (error || !data.user) throw new Error("Não consegui criar o usuário.");
    if (!data.session) throw new Error("Usuário criado. Peça para desligar 'Confirm email' no Supabase.");
    await c.from("wallet_perfis").insert({ user_id: data.user.id, usuario });
    return { usuario, id: data.user.id };
  },
  async sair() { const c = await cliente(); await c.auth.signOut(); },
  async trocarSenha(nova) {
    const c = await cliente();
    const { error } = await c.auth.updateUser({ password: nova });
    if (error) throw new Error("Não consegui trocar a senha.");
  },
  async carregar() {
    const c = await cliente();
    const { data, error } = await c.from("wallet_carteiras").select("dados").maybeSingle();
    if (error) throw error;
    return data ? data.dados : null;
  },
  async salvar(id, dados) {
    const c = await cliente();
    const { error } = await c.from("wallet_carteiras").upsert({ user_id: id, dados, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
};

// Backend falso (localStorage) — só para testar telas sem internet
const MK = "savia-wallet-mock";
const mdb = () => { try { return JSON.parse(localStorage.getItem(MK)) || { users: {}, sessao: null, dados: {} }; } catch { return { users: {}, sessao: null, dados: {} }; } };
const mput = (d) => localStorage.setItem(MK, JSON.stringify(d));
const mock = {
  async sessao() { const d = mdb(); return d.sessao ? { usuario: d.sessao, id: d.sessao } : null; },
  async entrar(u, s) { const d = mdb(); if (!d.users[u] || d.users[u] !== s) throw new Error("Usuário ou senha incorretos."); d.sessao = u; mput(d); return { usuario: u, id: u }; },
  async criar(u, s) { const d = mdb(); if (d.users[u]) throw new Error("Esse usuário já existe."); d.users[u] = s; d.sessao = u; mput(d); return { usuario: u, id: u }; },
  async sair() { const d = mdb(); d.sessao = null; mput(d); },
  async trocarSenha(n) { const d = mdb(); d.users[d.sessao] = n; mput(d); },
  async carregar() { const d = mdb(); return d.dados[d.sessao] || null; },
  async salvar(id, dados) { const d = mdb(); d.dados[id] = dados; mput(d); },
};

export const usandoMock = () => new URLSearchParams(location.search).has("mock");
export const configurado = () => usandoMock() || !!SUPABASE_ANON_KEY;
export const backend = usandoMock() ? mock : real;
