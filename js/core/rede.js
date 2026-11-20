// =========================================================
// REDE — conexões e itens compartilhados, guardados em memória
// (ctx.rede) e recarregados do Supabase quando preciso.
// =========================================================
import { backend } from "./backend.js";

export function rede(ctx) {
  if (!ctx.rede) ctx.rede = { carregado: false, carregando: false, conexoes: [], itens: [], erro: "" };
  return ctx.rede;
}

export async function carregarRede(ctx, forcar = false) {
  const r = rede(ctx);
  if (r.carregando || (r.carregado && !forcar)) return;
  r.carregando = true;
  try {
    const [conexoes, itens] = await Promise.all([backend.conexoes(), backend.compartilhados()]);
    Object.assign(r, { conexoes, itens, carregado: true, erro: "" });
  } catch (err) {
    console.error("rede", err);
    Object.assign(r, { carregado: true, erro: "Não consegui carregar as conexões." });
  }
  r.carregando = false;
  ctx.rerender();
}

export const aceitas = (ctx) => rede(ctx).conexoes.filter((c) => c.status === "aceita");
export const arroba = (ctx, id) => (rede(ctx).conexoes.find((c) => c.outro === id) || {}).usuario || "alguém";
export const pago = (item) => (item.pagamentos || []).reduce((a, p) => a + (Number(p.valor) || 0), 0);
