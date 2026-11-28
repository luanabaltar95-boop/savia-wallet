# Ambientes

| Ambiente | Onde | Banco | Dados |
|---|---|---|---|
| **Production** | domínio de produção na Vercel (branch `main`) | Supabase `savia-wallet` | reais |
| **Preview** | links de preview da Vercel (outras branches) | Supabase de teste **se** configurado; senão nenhum | fictícios |
| **Demo** | preview sem Supabase de teste, `localhost`, ou `?mock` | nenhum (navegador) | perfis fictícios |

## Como o app decide
`js/config/ambiente.js` chama `/api/config` (Vercel Function em `api/config.js`), que devolve `VERCEL_ENV` e as variáveis do ambiente:
- `production` → usa `SUPABASE_URL`/`SUPABASE_ANON_KEY` de Production (ou, se não houver, as constantes de `js/config/backend.js`).
- `preview`/`development` → usa o Supabase de teste **só** se as variáveis de Preview existirem e forem diferentes do de produção; senão, **demo**.
- Sem `/api` (servidor local) → demo.

**Um preview nunca usa o banco de produção.** Fora de produção aparece a faixa "Teste · dados fictícios".

## Perfis fictícios (demo)
Senha `demo1234`: `@ana` (dívidas), `@bruno` (economia + organizar), `@carla` (moedas + família), `@novo` (vazio). Ficam em `js/demo/perfis.js`; nenhum dado real.

## Variáveis na Vercel (Settings → Environment Variables)
| Nome | Production | Preview |
|---|---|---|
| `SUPABASE_URL` | URL do projeto real | URL do projeto de teste (opcional) |
| `SUPABASE_ANON_KEY` | chave publishable do real | chave publishable do teste (opcional) |

Só chaves **publishable/anon**. A chave secreta (service_role) e a senha do banco nunca vão para a Vercel nem para o código.

## Supabase de teste (opcional, quando precisar testar login/sincronização/conexões)
O plano gratuito permite **2 projetos ativos**. Opções:
1. Pausar outro projeto gratuito e criar `savia-wallet-dev` (custo zero).
2. Plano pago (cobrança por projeto).
Passos: criar o projeto → rodar `supabase/migrations/*.sql` (as públicas, sem `*PRIVADO*`) → colocar URL e chave publishable nas variáveis de **Preview** → criar usuários de teste.
