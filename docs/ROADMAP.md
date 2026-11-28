# Roadmap

## Feito — Evolução 001
- Seleção de vários objetivos e principal; onboarding em 2 passos que pede só o que falta.
- Goal Engine central (`js/goals/`) com dívidas, dinheiro, contínuos e personalizado.
- Fonte única: necessidades por objetivo; o que já existe não é perguntado.
- Home por objetivo, com "Meu caminho" (todos em ordem) e alternância.
- Recomendações com origem dos números; histórico semanal e tendência.
- Um "Guardar" por objetivo no plano; saldo dividido por prioridade.
- Migração da carteira atual sem apagar campos antigos.

## Próximo
1. **Futuras automáticas:** distribuir o valor pelas semanas até a data conforme a folga de cada semana; avisar quanto falta e sugerir extra.
2. **Carteira familiar:** tabela `wallet_workspaces` + `wallet_membros (papel: dono|editor|leitor)`; objetivos com `workspace_id`; RLS por membro.
3. **Objetivos fora do JSON:** tabela `wallet_objetivos` quando houver workspace (consultas e histórico maiores).
4. **Patrimônio:** cadastro de investimentos e bens (hoje só saldos e dívidas).
5. **Documentos e contratos:** módulo com upload privado (Supabase Storage + RLS) e vencimentos ligados às contas.
6. **Explicações por IA:** texto sobre os números do Goal Engine, sem gerar valores.
7. Limpeza de nomes legados no estado (`citibank` como id da conta principal, `lyft` como Extra Money) com migração.
