# Changelog

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
