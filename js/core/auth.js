// =========================================================
// USUÁRIO — regras do @usuario. O login em si fica em backend.js (Supabase).
// =========================================================
export const limparUsuario = (u) => String(u || "").trim().replace(/^@+/, "").toLowerCase();
export const usuarioValido = (u) => /^[a-z0-9._]{3,30}$/.test(u);
