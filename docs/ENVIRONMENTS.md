# Ambientes

| Ambiente | Onde | Banco | Dados |
|---|---|---|---|
| **Production** | domínio de produção (branch `main`) | Supabase `savia-wallet` | reais |
| **Preview** | links de preview da Vercel (outras branches) | Supabase de teste **só se** configurado | fictícios |
| **Demo** | preview sem banco de teste, servidor local, `?mock` fora de produção | nenhum (navegador) | perfis fictícios |

## Como o app decide (`js/config/ambiente.js`)
O app chama `/api/config` (Vercel Function `api/config.js`), que devolve `VERCEL_ENV` e as variáveis do ambiente.

| Resposta | Resultado |
|---|---|
| `production` sem variáveis | banco real (constantes de `js/config/backend.js`) |
| `production` com variáveis | banco das variáveis |
| `preview`/`development` sem variáveis | **demo** |
| `preview` com a URL de produção copiada por engano | **demo** (nunca o banco real) |
| `preview` com banco de teste | preview → banco de teste |
| sem resposta, endereço em `PRODUCAO_HOSTS` | banco real |
| sem resposta, qualquer outro endereço | **demo** (estado seguro) |
| `?mock` em produção | ignorado |

Testado em `tests/ambiente.test.mjs` (9 casos). Fora de produção aparece a faixa "Teste · dados fictícios" (com "sem /api" quando a função não respondeu).

> **Antes do merge:** preencha `PRODUCAO_HOSTS` em `js/config/backend.js` com o domínio de produção (ex.: `savia-wallet.vercel.app`). Assim, se a função `/api/config` falhar em produção, o app continua no banco real em vez de abrir em demonstração.

## Modo demonstração
- Perfis (senha `demo1234`): `@ana` dívidas · `@bruno` economia + organizar · `@carla` moedas + família · `@dani` renda variável quinzenal · `@eva` objetivo concluído · `@novo` vazio. Ficam em `js/demo/perfis.js`; nenhum dado real.
- Os dados ficam só no navegador (`localStorage`, chave `savia-wallet-mock`), num domínio diferente do de produção. Nada vai para o Supabase.
- **Restaurar:** na tela de login, "restaurar dados de teste" apaga a demo do navegador e recria os perfis.
- Em produção o backend falso nunca é carregado: não dá para "entrar" na produção pelo modo demo.

## Variáveis na Vercel (Settings → Environment Variables)
| Nome | Production | Preview |
|---|---|---|
| `SUPABASE_URL` | URL do projeto real (opcional) | URL do banco de teste (opcional) |
| `SUPABASE_ANON_KEY` | chave publishable do real (opcional) | chave publishable do teste (opcional) |
Só chaves **publishable/anon**. A chave secreta e a senha do banco nunca vão para a Vercel nem para o código.

## Testes locais
Ver `docs/TESTING.md`.

## Supabase local (para testar login, sincronização e RLS de verdade)
Não precisa de outro projeto na nuvem nem de plano pago. No seu computador:
1. Instale o **Docker Desktop** e o **Supabase CLI** (`brew install supabase/tap/supabase`).
2. Na pasta do projeto: `supabase init` (uma vez) e `supabase start`. O CLI mostra a URL local (`http://127.0.0.1:54321`) e a chave `anon` local.
3. `supabase db reset` aplica todas as migrações de `supabase/migrations/` num banco vazio.
4. Rode o app com `vercel dev` e um arquivo `.env.local` (não versionado) com `SUPABASE_URL=http://127.0.0.1:54321` e `SUPABASE_ANON_KEY=<anon local>`. O app entra em modo preview, apontando para o banco local.
5. Crie usuários de teste pelo próprio app (e-mails em `http://127.0.0.1:54324`, o Inbucket local).

Nesta sessão de trabalho não foi possível rodar o Supabase CLI (as imagens Docker são bloqueadas pela rede). Por isso os testes de RLS rodaram num **Postgres 16 local com a mesma estrutura do Supabase** (papéis `anon`/`authenticated`, `auth.uid()` pelo JWT) e no **PostgREST 12** (o mesmo servidor de API do Supabase). Ver `docs/SECURITY.md`.
