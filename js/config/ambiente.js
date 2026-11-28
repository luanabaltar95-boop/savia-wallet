// =========================================================
// AMBIENTE — onde o app está rodando e qual banco usar.
//   production → Supabase com os dados reais
//   preview    → Supabase de teste (só se a Vercel tiver as variáveis de Preview)
//   demo       → sem banco: dados fictícios no navegador
// A resposta vem de /api/config (variáveis de ambiente da Vercel).
// Regras de segurança:
//   · Preview nunca usa o banco de produção (nem se copiarem a variável).
//   · Sem resposta da Vercel → demo (estado seguro), exceto nos endereços
//     de produção listados em PRODUCAO_HOSTS.
//   · Em produção, ?mock é ignorado: o modo demo não existe lá.
// =========================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY, PRODUCAO_HOSTS } from "./backend.js";

const PROD = { nome: "production", url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
const DEMO = { nome: "demo" };
const ehHostProducao = () => PRODUCAO_HOSTS.includes(location.hostname);

export async function detectar(buscar = fetch) {
  let j = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await buscar("/api/config", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) j = await r.json();
  } catch { j = null; }
  if (j && j.ambiente === "production") return { ...PROD, url: j.supabaseUrl || SUPABASE_URL, key: j.supabaseKey || SUPABASE_ANON_KEY };
  if (!j && ehHostProducao()) return PROD; // função fora do ar no domínio de produção
  if (j && j.supabaseUrl && j.supabaseKey && j.supabaseUrl !== SUPABASE_URL) return { nome: "preview", url: j.supabaseUrl, key: j.supabaseKey };
  return { ...DEMO, semApi: !j };
}

export const AMBIENTE = await detectar();
export const ehDemo = () => AMBIENTE.nome === "demo";
