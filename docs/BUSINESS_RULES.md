# Regras de negócio

## Ciclo e semana
- O período é rotulado pelo dia de pagamento (ex.: 21–27 nov termina na sexta 27).
- Ciclos: semanal, quinzenal, duas vezes no mês, mensal (dia fixo, dia útil, último dia útil; opção "antes" move para a sexta anterior), manual.

## Distribuição do dinheiro de cada pagamento (`js/goals/estrategia.js`)
Conceitos separados (cada item do plano cai em um):
| Conceito | O que é | Exemplos |
|---|---|---|
| Essenciais | vida do dia a dia | mercado, transporte, pets |
| Atrasados | contas que já venceram | conta de luz atrasada |
| Obrigações | contas com data neste período | aluguel, internet, parcela |
| Mínimos | pagamento mínimo de cartão | mínimo do cartão |
| Compromissos | futuras já assumidas, com data (protegidas) | estadia paga em partes até uma data |
| Reservas | guardar para contas que vêm | contas do mês, prazos |
| Objetivos | Guardar de cada objetivo, por prioridade | reserva, viagem |
| Pedidos | gastos planejados **opcionais** | presente, ocasião, desejo |
| Livre | o que sobra | vai para o destino da estratégia |

**Estratégia atual — "Equilibrada"** (única por enquanto; não é regra universal):
essenciais → atrasados → obrigações e mínimos (por data) → compromissos → reservas → objetivos → pedidos → livre vai para a dívida de juros mais altos.
Outras estratégias (quitação acelerada, reserva primeiro, objetivo específico, personalizada) estão no ROADMAP; cada uma é só outra ordem e outro destino do livre no mesmo arquivo.
- Exemplo: entra $500, conta de $300, dois objetivos de $500 → sobram $200; o 1º recebe $200, o 2º $0 e o app avisa.
- Objetivo pausado/arquivado não entra; alcançado para de guardar; perto do fim guarda só o que falta.
- "Só valor inteiro" (`semParcial`): não entra parcial; passa para o próximo período. O que faltou de contas/mínimos/pedidos passa para o próximo período.

### O que são "pedidos"
Vêm do módulo **Planejar**: a pessoa pede dinheiro para uma data ou ocasião (um presente, um passeio) e o app divide o valor pelos pagamentos até lá. Existem para separar o que é **desejado** do que é **obrigatório**: por isso ficam por último. Um pedido marcado como protegido (Futuras com data, ex.: hospedagem paga em partes) vira **compromisso** e entra antes das reservas.

## Sem contar o mesmo dinheiro duas vezes
- O plano usa só o **dinheiro que entra no período**. O saldo das contas aparece separado, só como informação (não é somado ao que entra).
- "Já paguei" mostra o que foi marcado; não é descontado de novo (os itens pagos já estão no plano).
- Guardar marcado como pago sai da conta corrente e entra na conta do objetivo (registro `para`); o objetivo conta o saldo dessa conta → entra uma vez.
- Dois objetivos na mesma conta: o saldo vai primeiro ao de maior prioridade.
- Objetivo guardando na **conta corrente**: o saldo também é dinheiro das contas → marcado como **estimativa** e o app recomenda uma conta só para guardar.
- Risco que continua: se a pessoa transfere à mão uma reserva de contas para a conta do objetivo, o objetivo conta esse dinheiro. Recomendação: uma conta por finalidade.

## Várias moedas
- Moeda de referência = `config.moeda` (padrão USD). Tudo no plano e nos objetivos está nela.
- Conta em outra moeda guarda `valorMoeda` + `moeda`; o valor de referência = `valorMoeda ÷ taxa`.
- Cada taxa tem **origem e data**: `pagamento` (aprendida de um pagamento real, com taxas do banco), `manual` (digitada) ou `mercado` (cotação do dia, open.er-api.com, no máximo a cada 12h). A conta convertida carrega a cotação usada.
- Sem taxa: a conta é marcada `semCotacao`, o valor não é inventado e o app avisa "falta a cotação".
- Objetivo "moedas" mostra a origem e a data de cada taxa e avisa quando tem mais de 30 dias.
- Limite: contas bancárias não têm moeda própria (todas na moeda de referência) — ROADMAP.

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
