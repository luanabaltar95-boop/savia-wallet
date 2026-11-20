// =========================================================
// CÓPIA LOCAL — guarda a carteira no navegador para abrir rápido
// e funcionar sem internet. A versão oficial fica no Supabase.
// =========================================================
const KEY = "savia-wallet";

export const vazioState = () => ({ renda: {}, pagos: {}, lyft: [], pedidos: [], juntas: [], config: {}, movs: [], recebimentos: [], gasolina: [], compart: {}, entradasExtra: [], gastos: [], bancos: [] });

export function load(usuario) {
  if (!usuario) return vazioState();
  try { return { ...vazioState(), ...(JSON.parse(localStorage.getItem(`${KEY}:${usuario}`)) || {}) }; }
  catch { return vazioState(); }
}

export function save(state, usuario) {
  if (!usuario) return;
  try { localStorage.setItem(`${KEY}:${usuario}`, JSON.stringify(state)); } catch { /* sem armazenamento */ }
}
