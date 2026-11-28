# Changelog

## Evolução 001.1 — parte 2 (branch `evolucao-001`)
- Ambientes: `?mock` ignorado em produção; sem resposta de `/api` → demo (exceto `PRODUCAO_HOSTS`); preview com URL de produção → demo; "restaurar dados de teste"; perfis `@dani` (renda variável) e `@eva` (objetivo concluído).
- Segurança: `tests/rls` (SQL + API). Encontradas 3 falhas de isolamento em conexões/compartilhados/funções → `0009_seguranca_conexoes.sql` (não aplicada em produção). Pendente: e-mail exposto no login por @.
- Planejamento: `goals/estrategia.js` separa os conceitos; plano e recursos usam a mesma classificação. Mesmo comportamento da 001.1.
- Moedas: conta sem cotação fica marcada e o app avisa; objetivo "moedas" mostra origem e data das taxas.
- Objetivo na conta corrente: progresso marcado como estimativa.
- Jornada: estados das etapas; mascote pela fração real; barra sem mínimo artificial; Home vazia orientada a objetivos (sai a lista de "5 passos" focada em dívidas).
- Textos: "Ver meu plano", "Dinheiro deste período".
- Testes: 23 regras + 9 ambientes + 30 RLS + 11 API.

## Evolução 001.1 — validação e estabilização (branch `evolucao-001`)
- Ambientes: `api/config.js` + `js/config/ambiente.js`; preview nunca usa o banco de produção; modo demo com perfis fictícios (`js/demo/perfis.js`) e faixa "Teste".
- Planejamento unificado: Guardar dos objetivos passou para depois das obrigações (camada 3,5), por prioridade. **Muda o plano de quem usava o Guardar antes das contas.**
- `goals/recursos.js`: dinheiro da semana (entra, obrigações, sobra para objetivos, livre) na Home e nas recomendações.
- Objetivo alcançado para de guardar; perto do fim guarda só o que falta.
- Contínuos sem porcentagem: "x de n cuidados em dia".
- Classe `.fonte` renomeada para `.origem` (conflito de estilo).
- Testes: 18 cenários.

## Evolução 001 — objetivos (branch `evolucao-001`)
- Novo `js/goals/`: tipos, modelo e migração, necessidades (fonte única), engine e recomendações.
- Onboarding: "O que você deseja alcançar?" (vários, um principal) → "Só o que falta".
- Ajustes → **Meus objetivos**: lista por prioridade, principal, subir/descer, pausar, remover (arquivar), adicionar, editar por tipo, o que falta com atalho, etapas.
- Home: cenário para qualquer objetivo, "Meu caminho" + um chip por objetivo, etapa da vez, recomendações com origem, placar só para dívidas, todas as etapas recolhidas.
- Plano: um item Guardar por objetivo em dinheiro, cada um para a sua conta.
- Removido `components/objetivoCard.js` (substituído pela Home do Goal Engine). `core/objetivo.js` virou camada de compatibilidade.
- Testes: `tests/goals.test.mjs` (12 cenários).
- Docs: esta pasta.

## Antes
- Pagamentos mobile-first (cabeçalho com período, Vai entrar, resumo Disponível, plano em linhas, bottom sheets).
- Minhas contas por categoria editável; Meu objetivo em etapas; Home com a etapa da vez.
