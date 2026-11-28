// =========================================================
// AMBIENTE — onde o app está rodando e qual banco usar.
//   production → Supabase com os dados reais
//   preview    → Supabase de teste (se a Vercel tiver as variáveis de Preview)
//   demo       → sem banco: dados fictícios no navegador (preview sem
//                Supabase de teste, computador local, ou ?mock na URL)
// A resposta vem de /api/config (variáveis de ambiente da Vercel).
// Um preview NUNCA usa o banco de produção.
// =========================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./backend.js";

const local = () => ["localhost", "127.0.0.1", ""].includes(location.hostname);

async function detectar() {
  if (new URLSearchParams(location.search).has("mock")) return { nome: "demo" };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("/api/config", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    if (j.ambiente === "production") return { nome: "production", url: j.supabaseUrl || SUPABASE_URL, key: j.supabaseKey || SUPABASE_ANON_KEY };
    if (j.supabaseUrl && j.supabaseKey && j.supabaseUrl !== SUPABASE_URL) return { nome: "preview", url: j.supabaseUrl, key: j.supabaseKey };
    return { nome: "demo" };
  } catch {
    // Sem /api (servidor local): demonstração. Em outro endereço, mantém produção como antes.
    return local() ? { nome: "demo" } : { nome: "production", url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  }
}

export const AMBIENTE = await detectar();
export const ehDemo = () => AMBIENTE.nome === "demo";
