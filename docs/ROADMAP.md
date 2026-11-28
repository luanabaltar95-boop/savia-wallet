# Roadmap

## Feito — Evolução 001
- Seleção de vários objetivos e principal; onboarding em 2 passos que pede só o que falta.
- Goal Engine central (`js/goals/`) com dívidas, dinheiro, contínuos e personalizado.
- Fonte única: necessidades por objetivo; o que já existe não é perguntado.
- Home por objetivo, com "Meu caminho" (todos em ordem) e alternância.
- Recomendações com origem dos números; histórico semanal e tendência.
- Um "Guardar" por objetivo no plano; saldo dividido por prioridade.
- Migração da carteira atual sem apagar campos antigos.

## Feito — Evolução 001.1
- Ambientes: preview nunca usa o banco real; demo com 6 perfis fictícios; restaurar.
- Planejamento unificado com conceitos separados e estratégia "Equilibrada" (`estrategia.js`).
- Segurança: testes de RLS (SQL e API) e migração `0009` (pendente de aplicar).
- Jornada: estados das etapas (alcançada, atual, futura, sem previsão), mascote pela fração real, sem progresso mínimo artificial.
- Cotação marcada quando falta; objetivo guardando em conta corrente marcado como estimativa.

## Estratégias de distribuição (futuro)
Escolha em Ajustes; cada uma = ordem das categorias + destino do livre (`js/goals/estrategia.js`):
- **Quitação acelerada:** objetivos só com o mínimo combinado; livre todo para a dívida mais cara.
- **Reserva de emergência primeiro:** reserva antes de qualquer extra para dívida, até X meses.
- **Equilibrada (atual).**
- **Objetivo específico:** um objetivo recebe antes dos outros até uma data.
- **Personalizada:** a pessoa ordena as categorias e escolhe o destino do livre.

## Generalizar (o que ainda segue o modelo da primeira usuária)
| Tema | Hoje | Generalizar para |
|---|---|---|
| Recebimento | ciclos semanal, quinzenal, 2×/mês, mensal, manual | diário e irregular (renda sem data); plano por período e não por "semana" |
| Textos | "Fechar semana", "Plano da semana", "Guardo por semana" | rótulos pelo ciclo ("período", "mês") |
| Ritmo dos objetivos | valor por semana × semanas do período | valor por período ou por mês |
| Padrão sem configurar | semanal na sexta, USD | perguntar sempre; padrão pelo país/idioma |
| Moeda | contas bancárias sem moeda própria | conta com moeda, saldo convertido com origem/data |
| Reserva | sugestão de 3 meses de contas | meses escolhidos pela pessoa |
| Divisão | conta dividida = 50/50 entre 2 pessoas | percentuais e mais pessoas |
| Família | conexões 1 a 1 | workspace familiar com papéis |
| Piso | "piso da semana" e "semanas no piso" no placar | meta de renda do período, opcional |
| Ordem de pagamento | estratégia única | estratégias acima |
| Nomes internos | id `citibank` da conta principal, `lyft` no Extra Money | ids neutros com migração |
| Jornada de dívidas | etapas fixas por tipo (atrasados → futuras → em dia → cartões → parcelas → outras) | ordem pela estratégia escolhida |

## Próximo
1. **Futuras automáticas:** distribuir o valor pelas semanas até a data conforme a folga de cada semana; avisar quanto falta e sugerir extra.
2. **Carteira familiar:** tabela `wallet_workspaces` + `wallet_membros (papel: dono|editor|leitor)`; objetivos com `workspace_id`; RLS por membro.
3. **Objetivos fora do JSON:** tabela `wallet_objetivos` quando houver workspace (consultas e histórico maiores).
4. **Patrimônio:** cadastro de investimentos e bens (hoje só saldos e dívidas).
5. **Documentos e contratos:** módulo com upload privado (Supabase Storage + RLS) e vencimentos ligados às contas.
6. **Explicações por IA:** texto sobre os números do Goal Engine, sem gerar valores.
7. Limpeza de nomes legados no estado (`citibank` como id da conta principal, `lyft` como Extra Money) com migração.
