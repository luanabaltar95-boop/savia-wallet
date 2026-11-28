# Design system

Tokens em `styles/tokens.css`. Mobile primeiro.

| Token | Valor |
|---|---|
| Fundo | `#F3F0E8` |
| Cards | `#FCFAF5` |
| Verde principal | `#388565` (ações, confirmado) |
| Texto | `#292720` |
| Terracota | `#B5654A` (saídas, atraso, falta dado) |
| Lilás | `#7467B3` (projeção, etapa da vez) |
| Margens | 16 · padding de card 16 · espaço entre cards 12 · relacionados 4–8 |
| Raio | cards 20, campos/linhas 12–16, pílulas cheias |
| Números | `font-variant-numeric: tabular-nums` (`.num`) |

## Padrões
- Botão principal verde "+ Adicionar …"; ações secundárias em texto verde com ícone (`.txt-acao`).
- Linhas compactas (ícone · nome · detalhe · valor · ⋯) com divisores sutis.
- Opções em **bottom sheet** (`.sheet`, `.sheet-acoes`), toque ≥ 44px.
- Etiqueta de origem do número: `.fonte.confirmado|projecao|estimativa|pendente`.
- Etapas: `.cam-lista` / `.cam-etapa.ok|atual` com número em círculo.
- Textos curtos, em primeira pessoa ("Guardo por semana", "Meu pagamento").
- Cenário da jornada (`scene.js`): paisagem que clareia com o progresso; o cachorro anda até a etapa atual. Vale para qualquer objetivo.
