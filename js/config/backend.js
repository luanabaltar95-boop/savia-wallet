// Supabase do Savia Wallet (a chave "anon" é pública: quem protege os dados são as regras do banco)
export const SUPABASE_URL = "https://zjhgapytrukehawoolwu.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_oFpmOcH5DwPCR-Jhm7mN2g_rhEg6-UO"; // publishable key (Project Settings → API Keys)
// Endereços de produção: se /api/config falhar nestes domínios, o app continua no banco real.
// Em qualquer outro endereço sem resposta, o app abre em modo demonstração (seguro).
export const PRODUCAO_HOSTS = [];
