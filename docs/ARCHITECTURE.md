# Arquitetura

Site estático: HTML + JavaScript com módulos nativos, **sem build e sem framework**. Publicado na Vercel; dados no Supabase.

## Pastas
| Pasta | O que tem |
|---|---|
| `js/app.js` | rotas por hash, contexto (`ctx`), salvar/sincronizar |
| `js/config/` | marca, seed vazio (nada pessoal), chaves públicas do Supabase |
| `js/core/` | regras de negócio: calendário/ciclo, plano da semana (`plan.js`), caixa e saldos, dívidas, jornada, câmbio, importação, sincronização |
| `js/goals/` | **Goal Engine**: `tipos.js` (catálogo), `modelo.js` (dados, migração), `necessidades.js` (fonte única), `engine.js` (avaliação), `recomendacoes.js` (guia) |
| `js/pages/` | uma página por arquivo; só desenha e liga eventos |
| `js/components/` | peças de tela reutilizadas (`ui.js`, `objetivos.js`, `weekNav.js`, `scene.js`, ícones) |
| `styles/` | `tokens.css` (design system), `global.css`, `components.css`, `pagamentos.css`, `objetivos.css` |
| `supabase/migrations/` | tabelas, RLS e funções (sem dados pessoais) |
| `tests/` | testes do Goal Engine (`node tests/goals.test.mjs`) |
| `api/` | Vercel Function `config.js` (ambiente e Supabase por variável) |
| `js/demo/` | perfis fictícios do modo demonstração |
| `docs/` | esta documentação |

## Fluxo de dados
```
Entidades (state.config: entradas, contas, cartões, dívidas, futuras, objetivos; bancos; pagos)
   │ getSeed (lê as entidades originais; não copia)
   ▼
seed ──▶ plan.buildWeek + allocate  (UM plano: obrigações → objetivos → livre)
   │            │
   │            ├──▶ goals/recursos.js  (quanto entra, obrigações, sobra, livre)
   │            └──▶ Hoje (lista desta sexta)
   ▼
goals/engine.avaliar (etapas, progresso, previsão, faltando; saldo por prioridade)
   │
   ├──▶ goals/recomendacoes (guia com origem dos números)
   └──▶ Home (caminho, etapa da vez, dinheiro desta semana) · Ajustes (Meus objetivos)
goals/modelo.guardarPorSemana ──▶ plan (itens Guardar; pausados/alcançados ficam fora)
```
Nada do Goal Engine é gravado além da definição do objetivo e do histórico semanal: progresso, saldos e previsões são recalculados sempre que os dados mudam.
- `state` é um único objeto por usuário, salvo no navegador e sincronizado em `wallet_carteiras.dados` (a cópia mais nova vence por `updatedAt`).
- `seed` = partes editáveis (`state.config.*`) por cima do seed vazio.
- O Goal Engine **não desenha nada**; as telas só leem o resultado.

## Dependências entre módulos (resumo)
- `plan.js` → `goals/modelo.js` (itens Guardar). `modelo.js` não importa `plan.js` (evita ciclo).
- `goals/engine.js` → `core/jornada.js` (etapas de dívidas) → `plan.js`, `debts.js`.
- `goals/recomendacoes.js` → `engine.js`, `caixa.js`, `plan.js`.
- `core/objetivo.js` é só compatibilidade (primeiro objetivo em dinheiro).

## Segurança e multiusuário
- Supabase Auth; RLS em todas as tabelas (`user_id = auth.uid()`); conexões e compartilhados só entre as duas pontas.
- A chave no código é a **publishable/anon** (pública por definição). Chaves secretas e senha do banco nunca entram no repositório.
- Arquivos `*PRIVADO*` ficam no `.gitignore`.
- Isolamento visual ou localStorage **não** é segurança: quem protege é a RLS.
- Próximo passo para família: tabela de workspaces com membros e papéis (ver ROADMAP).

## Decisões (ADR curtas)
- **ADR-001 — Sem framework.** Manter módulos nativos: deploy simples, sem build. (mantida)
- **ADR-002 — Goal Engine separado da UI** (`js/goals/`). Home, Ajustes e plano consomem o mesmo resultado; cálculo testável em Node.
- **ADR-003 — Objetivos dentro do `state.config.objetivos`.** Mesmo lugar e mesma sincronização do resto da carteira; nada de tabela nova agora. Quando houver carteira familiar, migra para tabela própria com `workspace_id`.
- **ADR-004 — Migração sem apagar.** Carteiras antigas viram objetivos na leitura; `config.objetivo` e `colchaoSemanal` ficam guardados (caminho de volta). `colchaoSemanal` segue a soma do "guardar por semana".
- **ADR-005 — Um item Guardar por objetivo.** O primeiro mantém o id `colchao` para os pagamentos já marcados continuarem valendo.
- **ADR-006 — Saldo dividido por prioridade.** Dois objetivos na mesma conta não contam o mesmo dinheiro.
- **ADR-007 — Planejamento unificado (001.1).** Objetivos entram no plano depois das obrigações (camada 3,5), em ordem de prioridade; não existe plano por objetivo. `goals/recursos.js` só lê esse plano.
- **ADR-008 — Ambientes por variável (001.1).** `/api/config` (Vercel Function) informa o ambiente; preview sem banco de teste roda em demo com dados fictícios. Ver `ENVIRONMENTS.md`.
