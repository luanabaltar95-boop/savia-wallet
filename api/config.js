// Vercel Function: diz ao app em que ambiente ele está e qual Supabase usar.
// As variáveis ficam na Vercel (Settings → Environment Variables), separadas por ambiente:
//   Production:          SUPABASE_URL, SUPABASE_ANON_KEY  (projeto com os dados reais)
//   Preview/Development: SUPABASE_URL, SUPABASE_ANON_KEY  (projeto de teste) — ou nada = modo demonstração
// Só a chave pública (anon/publishable) passa por aqui. Chave secreta nunca.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ambiente: process.env.VERCEL_ENV || "development",
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseKey: process.env.SUPABASE_ANON_KEY || null,
  });
};
