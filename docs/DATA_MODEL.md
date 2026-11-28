# Modelo de dados

## Supabase
| Tabela | Conteúdo | Acesso (RLS) |
|---|---|---|
| `wallet_perfis` | usuário ↔ nome de usuário | só o dono |
| `wallet_carteiras` | `dados jsonb` = state inteiro | só o dono |
| `wallet_conexoes` | pedidos de conexão por @ | as duas pontas |
| `wallet_compartilhados` | contas divididas entre usuários | dono e convidado |

## `state` (um por usuário)
- `config` — partes editáveis: `semanais`, `mensais`, `parcelas`, `pontuais`, `cartoes`, `outras`, `pedidos`, `categorias`, `ciclo`, `metas` (piso), `entradas`, `modulos`, `moeda`, **`objetivos`**, legado `objetivo` e `colchaoSemanal`.
- `renda[semana]`, `pagos[semana][item]`, `bancos[]`, `transferencias[]`, `ajustesSaldo[]`, `cotacoes`, `fechadas`, `movs`, `updatedAt`.

## Objetivo (`config.objetivos[]`)
```js
{
  id, dono,                 // dono = usuário que criou (workspace futuro)
  tipo,                     // dividas|organizar|economizar|reserva|compra|patrimonio|moedas|familia|documentos|personalizado
  nome, descricao,
  prioridade, principal,    // 1 = primeiro; um principal só
  inicio, ate,              // ISO
  valorInicial, alvo, conta, semanal,
  status,                   // ativo|pausado|arquivado
  etapas: [{ id, nome, feito }],          // personalizado sem valor
  historico: { "2026-11-27": { p, prev } } // progresso e previsão por semana
}
```
Valor atual, progresso, etapas calculadas, previsão e o que falta **não são gravados**: o Goal Engine calcula a partir dos dados (fonte única).

## Migração
Carteira sem `config.objetivos`: dívidas cadastradas → objetivo `dividas` (principal); `config.objetivo` com valor/nome ou `colchaoSemanal > 0` → objetivo `reserva`/`compra`. Gravado na primeira abertura da Home; campos antigos mantidos.
