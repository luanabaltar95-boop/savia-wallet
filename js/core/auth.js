// =========================================================
// USUÁRIOS — @usuario + senha. Cada usuário tem a própria carteira.
// A senha nunca é guardada: só um resumo (PBKDF2-SHA256 com sal).
// A sessão fica salva na conta (vale em todos os aparelhos) até "Sair".
// =========================================================
const ITER = 100000;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

export const limparUsuario = (u) => String(u || "").trim().replace(/^@+/, "").toLowerCase();
export const usuarioValido = (u) => /^[a-z0-9._]{3,30}$/.test(u);

async function resumo(senha, saltHex, iter = ITER) {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: deHex(saltHex), iterations: iter }, chave, 256);
  return hex(bits);
}

export const perfilDe = (reg, usuario) => reg.perfis.find((p) => p.usuario === usuario) || null;
export const perfilAtivo = (reg) => (reg.sessao ? perfilDe(reg, reg.sessao) : null);

// Novo usuário: a primeira carteira da conta usa o doc "carteira"; as outras, "carteira-<usuario>"
export async function criarPerfil(reg, usuario, senha) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const doc = reg.perfis.length ? `carteira-${usuario.replace(/[^a-z0-9]/g, "-")}` : "carteira";
  const p = { usuario, salt, iter: ITER, hash: await resumo(senha, salt), doc, criado: Date.now() };
  reg.perfis = [...reg.perfis, p];
  return p;
}

export async function conferir(reg, usuario, senha) {
  const p = perfilDe(reg, limparUsuario(usuario));
  if (!p) return null;
  return (await resumo(senha, p.salt, p.iter || ITER)) === p.hash ? p : null;
}

// Perfil: trocar a senha (gera novo sal e resumo)
export async function trocarSenha(perfil, nova) {
  perfil.salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  perfil.iter = ITER;
  perfil.hash = await resumo(nova, perfil.salt);
}
