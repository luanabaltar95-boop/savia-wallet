// =========================================================
// ARMAZENAMENTO — cópia no navegador. Tudo protegido com try/catch.
// Cada usuário tem a própria carteira (doc). A primeira usa a chave
// antiga "carteira-digital-v1"; as outras ganham o sufixo do doc.
// O registro de usuários e a sessão ficam em "carteira-perfis".
// =========================================================
const KEY = "carteira-digital-v1";
const REG = "carteira-perfis";

export const vazioState = () => ({ renda: {}, pagos: {}, lyft: [], pedidos: [], juntas: [], config: {}, movs: [], recebimentos: [], gasolina: [], compart: {}, entradasExtra: [], gastos: [], bancos: [] });
const chave = (doc = "carteira") => (doc === "carteira" ? KEY : `${KEY}-${doc}`);

export function load(doc) {
  try { return { ...vazioState(), ...(JSON.parse(localStorage.getItem(chave(doc))) || {}) }; }
  catch { return vazioState(); }
}

export function save(state, doc) {
  try { localStorage.setItem(chave(doc), JSON.stringify(state)); } catch { /* sem armazenamento: segue em memória */ }
}

// Registro: { perfis: [{ usuario, salt, iter, hash, doc }], sessao: usuario|null, updatedAt }
export function loadReg() {
  let r = null;
  try { r = JSON.parse(localStorage.getItem(REG)); } catch { /* nada */ }
  r = { perfis: [], sessao: null, updatedAt: 0, ...(r || {}) };
  // Compatibilidade: usuário criado antes do registro (perfil dentro da carteira)
  if (!r.perfis.length) {
    const antigo = load("carteira").perfil;
    if (antigo) {
      r.perfis = [{ ...antigo, doc: "carteira" }];
      try { if (localStorage.getItem("carteira-sessao") === antigo.usuario) r.sessao = antigo.usuario; } catch { /* nada */ }
    }
  }
  return r;
}

export function saveReg(reg) {
  try { localStorage.setItem(REG, JSON.stringify(reg)); } catch { /* nada */ }
}
