// Matriz de ambientes (node tests/ambiente.test.mjs): preview nunca vai para o banco real,
// falta de variáveis cai em estado seguro, ?mock não liga demo em produção.
globalThis.location = { hostname: "savia-wallet-git-teste.vercel.app", search: "" };
globalThis.fetch = async () => { throw new Error("sem rede"); };
const { detectar } = await import("../js/config/ambiente.js");
const { SUPABASE_URL } = await import("../js/config/backend.js");
let ok = 0, falhou = 0;
const t = async (nome, fn) => { try { await fn(); ok++; console.log("✓", nome); } catch (e) { falhou++; console.log("✗", nome, "→", e.message); } };
const eq = (a, b) => { if (a !== b) throw new Error(`esperado ${b}, veio ${a}`); };
const resp = (j, status = 200) => async () => ({ ok: status === 200, status, json: async () => j });
const TESTE = "https://projeto-de-teste.supabase.co";

await t("produção sem variáveis → banco real (constantes)", async () => { const a = await detectar(resp({ ambiente: "production" })); eq(a.nome, "production"); eq(a.url, SUPABASE_URL); });
await t("produção com variáveis → as variáveis", async () => { const a = await detectar(resp({ ambiente: "production", supabaseUrl: "https://x.supabase.co", supabaseKey: "k" })); eq(a.url, "https://x.supabase.co"); });
await t("preview sem variáveis → demo", async () => eq((await detectar(resp({ ambiente: "preview" }))).nome, "demo"));
await t("preview com a URL de produção copiada → demo (nunca o banco real)", async () => eq((await detectar(resp({ ambiente: "preview", supabaseUrl: SUPABASE_URL, supabaseKey: "k" }))).nome, "demo"));
await t("preview com banco de teste → preview", async () => { const a = await detectar(resp({ ambiente: "preview", supabaseUrl: TESTE, supabaseKey: "k" })); eq(a.nome, "preview"); eq(a.url, TESTE); });
await t("development (vercel dev) sem variáveis → demo", async () => eq((await detectar(resp({ ambiente: "development" }))).nome, "demo"));
await t("/api/config fora do ar num endereço qualquer → demo", async () => eq((await detectar(async () => { throw new Error("x"); })).nome, "demo"));
await t("/api/config 404 (servidor local) → demo", async () => eq((await detectar(resp(null, 404))).nome, "demo"));
await t("?mock em produção é ignorado", async () => { location.search = "?mock"; eq((await detectar(resp({ ambiente: "production" }))).nome, "production"); location.search = ""; });
console.log(`\n${ok} ok, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
