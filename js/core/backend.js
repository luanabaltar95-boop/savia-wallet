// =========================================================
// BACKEND — login e dados no Supabase.
// Tabelas: wallet_perfis (@usuario) e wallet_carteiras (dados da carteira),
// protegidas por RLS: cada pessoa só lê e grava a própria linha.
// Em demonstração (preview sem banco de teste, computador local ou ?mock)
// usa um backend falso no navegador, com perfis fictícios.
// =========================================================
import { AMBIENTE, ehDemo } from "../config/ambiente.js";
import { perfisDemo, SENHA_DEMO } from "../demo/perfis.js";

const ehEmail = (t) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
const usuarioDe = (user) => (user && (user.user_metadata?.usuario || String(user.email || "").split("@")[0])) || null;
const voltarPara = () => location.origin + location.pathname;

// @usuario ou e-mail → e-mail
async function emailDoLogin(c, login) {
  const t = String(login || "").trim();
  if (ehEmail(t)) return t.toLowerCase();
  const { data } = await c.rpc("wallet_email_do_usuario", { p_usuario: t.replace(/^@+/, "").toLowerCase() });
  return data || null;
}

let sb = null;
// Meu id pela sessão salva (não depende de rede)
async function meuId(c) {
  const { data } = await c.auth.getSession();
  return data.session?.user?.id || null;
}

async function cliente() {
  if (sb) return sb;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  sb = createClient(AMBIENTE.url, AMBIENTE.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "savia-wallet-auth" } });
  return sb;
}

const real = {
  async sessao() {
    const c = await cliente();
    const { data } = await c.auth.getSession();
    return data.session ? { usuario: usuarioDe(data.session.user), id: data.session.user.id } : null;
  },
  async entrar(login, senha) {
    const c = await cliente();
    const email = await emailDoLogin(c, login);
    if (!email) throw new Error("Usuário ou senha incorretos.");
    const { data, error } = await c.auth.signInWithPassword({ email, password: senha });
    if (error) { console.error("signIn", error); throw new Error(/invalid/i.test(error.message) ? "Usuário ou senha incorretos." : `Não consegui entrar (${error.status || ""} ${error.message}).`); }
    return { usuario: usuarioDe(data.user), id: data.user.id };
  },
  async criar(usuario, email, senha) {
    const c = await cliente();
    const livre = await c.rpc("wallet_usuario_livre", { p_usuario: usuario });
    if (livre.error) throw new Error("Não consegui verificar o usuário agora.");
    if (!livre.data) throw new Error("Esse usuário já existe.");
    const { data, error } = await c.auth.signUp({ email, password: senha, options: { data: { usuario }, emailRedirectTo: voltarPara() } });
    if (error) {
      console.error("signUp", error);
      if (/registered|exists/i.test(error.message)) throw new Error("Esse e-mail já tem usuário. Toque em Entrar.");
      throw new Error(`Não consegui criar o usuário (${error.status || ""} ${error.message}).`);
    }
    if (!data.user) throw new Error("Não consegui criar o usuário.");
    if (!data.session) throw new Error("Usuário criado. Peça para desligar 'Confirm email' no Supabase.");
    await c.from("wallet_perfis").insert({ user_id: data.user.id, usuario });
    return { usuario, id: data.user.id };
  },
  // Carteira importada esperando este @ (vira minha)
  async reivindicar() { const c = await cliente(); try { await c.rpc("wallet_reivindicar"); } catch { /* nada */ } },
  async esqueci(login) {
    const c = await cliente();
    const email = await emailDoLogin(c, login);
    if (email) await c.auth.resetPasswordForEmail(email, { redirectTo: voltarPara() });
  },
  // Avisa quando a pessoa chega pelo link de recuperação do e-mail
  async aoRecuperar(fn) {
    const c = await cliente();
    c.auth.onAuthStateChange((evento) => { if (evento === "PASSWORD_RECOVERY") fn(); });
  },
  async email() { const c = await cliente(); const { data } = await c.auth.getUser(); return data.user ? data.user.email : ""; },

  // ---- Conexões ---- (de/dono vêm do banco: default auth.uid())
  async conexoes() {
    const c = await cliente();
    const { data, error } = await c.rpc("wallet_minhas_conexoes");
    if (error) throw error;
    return data || [];
  },
  async conectar(usuario) {
    const c = await cliente();
    const { data, error } = await c.rpc("wallet_buscar_usuario", { p_usuario: usuario });
    if (error) throw new Error("Não consegui procurar agora.");
    const alvo = (data || [])[0];
    if (!alvo) throw new Error(`Não achei @${usuario}.`);
    const eu = await meuId(c);
    if (eu && alvo.user_id === eu) throw new Error("Esse é você.");
    const r = await c.from("wallet_conexoes").insert({ para: alvo.user_id });
    if (r.error) throw new Error(/duplicate/i.test(r.error.message) ? "Vocês já estão conectados ou o pedido já foi enviado." : "Não consegui enviar o pedido.");
  },
  async aceitar(id) { const c = await cliente(); const r = await c.from("wallet_conexoes").update({ status: "aceita" }).eq("id", id); if (r.error) throw r.error; },
  async desconectar(id) { const c = await cliente(); const r = await c.from("wallet_conexoes").delete().eq("id", id); if (r.error) throw r.error; },

  // ---- Compartilhados (contas divididas e dívidas entre duas pessoas) ----
  async compartilhados() {
    const c = await cliente();
    const { data, error } = await c.from("wallet_compartilhados").select("*").order("criado_em");
    if (error) throw error;
    return data || [];
  },
  async compartilhar(item) {
    const c = await cliente();
    const { data, error } = await c.from("wallet_compartilhados").insert(item).select().single();
    if (error) throw new Error("Não consegui compartilhar. A conexão foi aceita?");
    return data;
  },
  async atualizarCompartilhado(id, campos) {
    const c = await cliente();
    const r = await c.from("wallet_compartilhados").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", id);
    if (r.error) throw r.error;
  },
  async apagarCompartilhado(id) { const c = await cliente(); const r = await c.from("wallet_compartilhados").delete().eq("id", id); if (r.error) throw r.error; },
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
const mdb = () => {
  let d;
  try { d = JSON.parse(localStorage.getItem(MK)); } catch { d = null; }
  // Primeira vez em demonstração: cria os perfis fictícios
  if (!d || !Object.keys(d.users || {}).length) {
    const perfis = perfisDemo();
    d = { users: Object.fromEntries(Object.keys(perfis).map((u) => [u, SENHA_DEMO])), sessao: null, dados: perfis, ...(d && d.sessao ? { sessao: d.sessao } : {}) };
    try { localStorage.setItem(MK, JSON.stringify(d)); } catch { /* nada */ }
  }
  return d;
};
const mput = (d) => localStorage.setItem(MK, JSON.stringify(d));
const mock = {
  async sessao() { const d = mdb(); return d.sessao ? { usuario: d.sessao, id: d.sessao } : null; },
  async entrar(u, s) { u = String(u).trim().replace(/^@+/, "").toLowerCase(); const d = mdb(); if (!d.users[u] || d.users[u] !== s) throw new Error("Usuário ou senha incorretos."); d.sessao = u; mput(d); return { usuario: u, id: u }; },
  async criar(u, e, s) { const d = mdb(); if (d.users[u]) throw new Error("Esse usuário já existe."); d.users[u] = s; d.sessao = u; mput(d); return { usuario: u, id: u }; },
  async reivindicar() {},
  async esqueci() {},
  async aoRecuperar() {},
  async email() { return "teste@exemplo.com"; },
  async conexoes() {
    const d = mdb(); const eu = d.sessao;
    return (d.conexoes || []).filter((x) => x.de === eu || x.para === eu).map((x) => ({ id: x.id, outro: x.de === eu ? x.para : x.de, usuario: x.de === eu ? x.para : x.de, status: x.status, enviada: x.de === eu }));
  },
  async conectar(u) {
    const d = mdb(); u = u.replace(/^@+/, "").toLowerCase();
    if (!d.users[u]) throw new Error(`Não achei @${u}.`);
    if (u === d.sessao) throw new Error("Esse é você.");
    d.conexoes = [...(d.conexoes || []), { id: "c" + Date.now(), de: d.sessao, para: u, status: "pendente" }]; mput(d);
  },
  async aceitar(id) { const d = mdb(); d.conexoes = d.conexoes.map((x) => (x.id === id ? { ...x, status: "aceita" } : x)); mput(d); },
  async desconectar(id) { const d = mdb(); d.conexoes = d.conexoes.filter((x) => x.id !== id); mput(d); },
  async compartilhados() { const d = mdb(); return (d.itens || []).filter((x) => x.dono === d.sessao || x.com === d.sessao); },
  async compartilhar(item) { const d = mdb(); const novo = { id: "i" + Date.now(), dono: d.sessao, pagamentos: [], freq: "unica", ...item }; d.itens = [...(d.itens || []), novo]; mput(d); return novo; },
  async atualizarCompartilhado(id, campos) { const d = mdb(); d.itens = d.itens.map((x) => (x.id === id ? { ...x, ...campos } : x)); mput(d); },
  async apagarCompartilhado(id) { const d = mdb(); d.itens = d.itens.filter((x) => x.id !== id); mput(d); },
  async sair() { const d = mdb(); d.sessao = null; mput(d); },
  async trocarSenha(n) { const d = mdb(); d.users[d.sessao] = n; mput(d); },
  async carregar() { const d = mdb(); return d.dados[d.sessao] || null; },
  async salvar(id, dados) { const d = mdb(); d.dados[id] = dados; mput(d); },
};

// Demo: volta os perfis fictícios ao estado inicial (só existe fora da produção)
export function restaurarDemo() {
  if (!ehDemo()) return false;
  try {
    Object.keys(localStorage).filter((k) => k === MK || k.startsWith("savia-wallet:")).forEach((k) => localStorage.removeItem(k));
  } catch { /* nada */ }
  return true;
}
export const usandoMock = ehDemo;
export const configurado = () => ehDemo() || !!AMBIENTE.key;
export const backend = ehDemo() ? mock : real;
