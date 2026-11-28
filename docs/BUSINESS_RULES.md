# Regras de negócio

## Ciclo e semana
- O período é rotulado pelo dia de pagamento (ex.: 21–27 nov termina na sexta 27).
- Ciclos: semanal, quinzenal, duas vezes no mês, mensal (dia fixo, dia útil, último dia útil; opção "antes" move para a sexta anterior), manual.

## Plano da semana (ordem de prioridade) — planejamento unificado
0 vida (essenciais) · 1 atrasados · 2 contas e mínimos da semana (por data) · 2,5 futuras protegidas · 3 reservas para contas que vêm · **3,5 objetivos (Guardar), por prioridade** · 4 pedidos · o que sobra vai para a dívida que mais custa.
- Objetivos só recebem o que sobra depois das obrigações (desde 001.1; antes o Guardar vinha logo depois da vida).
- Exemplo: entra $500, conta de $300, dois objetivos de $500 → sobram $200; o 1º recebe $200, o 2º $0 e o app avisa.
- Objetivo pausado/arquivado não entra; alcançado para de guardar; perto do fim guarda só o que falta.
- "Só valor inteiro" (`semParcial`): não entra parcial; passa para a próxima semana.
- Pagar um item ligado a uma dívida baixa o saldo dela.

## Disponível
`Disponível = Entradas − Saídas`. Ajuste de conferência negativo (banco com mais dinheiro) conta como entrada; positivo, como saída.

## Objetivos (Goal Engine)
- Vários objetivos ativos; **um principal**; ordem = prioridade. Status: ativo, pausado, arquivado (remover = arquivar; nada é apagado).
- **Dívidas:** etapas = atrasados → futuras protegidas → tudo em dia → cada cartão em `alvos` → parcelamentos → outras dívidas. Sem cartões/dívidas cadastrados não há etapas.
- **Dinheiro (economizar, reserva, compra, patrimônio, personalizado com valor):**
  - atual = saldo da conta do objetivo (confirmado se o saldo foi conferido; senão "falta dado");
  - patrimônio = saldo das contas − cartões − dívidas;
  - reserva sem valor = 3 meses de contas (**estimativa**); marcos em 1/3/6 meses que cabem no alvo, o último é o alvo;
  - outros: marcos de 25/50/75/100%;
  - previsão = semanas até cobrir o que falta no ritmo de "guardo por semana"; com data, mostra quanto precisaria por semana.
- **Contínuos (organizar, moedas, família):** lista de cuidados; progresso = quantos estão em dia agora.
- **Concorrência:** saldo de uma conta vai primeiro ao objetivo de maior prioridade.
- **Histórico:** uma foto por semana (progresso + previsão), até 52 semanas; "previsão adiantou/atrasou N semanas" quando muda ≥ 7 dias.

## Recursos da semana (`goals/recursos.js`)
Entra − essenciais − contas/atrasados − mínimos − futuras − reservas = **sobra para objetivos**; − objetivos − pedidos = **livre**. Também mostra o já pago (confirmado) e o saldo nas contas. Mesmo cálculo do plano da Hoje (não é um segundo planejamento).

## Fonte única
Cada objetivo declara o que precisa (`pagamento`, `bancos`, `contas`, `dividas`, `valor`, `moedas`, `familia`). O onboarding e a Home pedem só o que falta (uma vez, mesmo que vários objetivos precisem) e apontam detalhes incompletos (ex.: cartão sem APR).

## Origem dos números
`confirmado` (dado conferido/marcado) · `projeção` (plano e ritmo) · `estimativa` (valor sugerido pelo app) · `falta dado`.
