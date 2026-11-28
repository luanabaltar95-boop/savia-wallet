# Segurança multiusuário — evidências (001.1)

Ambiente de teste: Postgres 16 local + simulação do Supabase (`auth.uid()` pelo JWT, papéis `anon`/`authenticated`) + PostgREST 12. Usuários fictícios A, B, C. Nada rodou no banco de produção.

## Resultado
| Verificação | Antes da 0009 | Depois da 0009 |
|---|---|---|
| A consulta a carteira de B (SQL e API, filtrando pelo id) | bloqueado | bloqueado |
| A altera / exclui a carteira de B | bloqueado | bloqueado |
| A transfere a própria carteira para B / cria carteira ou perfil em nome de C | bloqueado | bloqueado |
| A vê objetivos de B (ficam dentro da carteira) | bloqueado | bloqueado |
| A cria conexão já aceita ou em nome de C | bloqueado | bloqueado |
| **B, ao aceitar um pedido, troca quem pediu (fabrica conexão com C)** | **FALHA** | bloqueado |
| **B passa um item compartilhado de A para C** | **FALHA** | bloqueado |
| C (sem conexão) vê conexões/itens de A e B | **FALHA** (efeito do item acima) | bloqueado |
| Anônimo lê carteiras/perfis, grava carteira | bloqueado | bloqueado |
| **Anônimo chama funções internas (buscar usuário)** | **FALHA** | bloqueado |
| Token com assinatura falsa | recusado (401) | recusado (401) |
| **Anônimo descobre o e-mail de um @ (`wallet_email_do_usuario`)** | **FALHA** | **FALHA — pendente** |
| Migrações reexecutadas | sem erro | sem erro |

Totais atuais: SQL 29 OK / 1 pendente; API 10 OK / 1 pendente.

## Correção: `supabase/migrations/0009_seguranca_conexoes.sql`
Sem mexer em dados; pode rodar mais de uma vez.
1. Conexões: quem aceita só muda `status`, e só para `aceita`.
2. Itens compartilhados: `dono` e `com` não mudam depois de criados.
3. Funções internas só para quem entrou (o Postgres libera para todos por padrão).
**Não aplicada em produção** — precisa da sua autorização (rodar no SQL Editor do Supabase).

## Pendente (decisão sua)
**Login por @ expõe o e-mail.** Para entrar com `@usuario`, o app pergunta ao banco o e-mail do @ (função aberta a anônimos). Qualquer pessoa que saiba um @ descobre o e-mail. Opções:
- (a) Entrar só com e-mail (simples, sem custo; o @ continua para conexões).
- (b) Edge Function de login no Supabase que recebe @ + senha e devolve a sessão, sem nunca mostrar o e-mail (grátis no plano atual, mais trabalho).

## Outras verificações
- Chaves no frontend: só a **publishable/anon** (pública por definição). Nenhuma `service_role`/`sb_secret`/JWT de serviço no repositório nem no histórico.
- Dados pessoais versionados: nenhum (busca por nomes, bancos, valores e e-mails no código, docs, testes e histórico). Arquivos `*PRIVADO*` no `.gitignore`.
- Documentos e arquivos: não existem ainda (sem Storage). Quando existir, buckets privados com RLS por dono.
- Objetivos: ficam dentro de `wallet_carteiras.dados` → mesmo isolamento da carteira (testado).
- `wallet_usuario_livre` (anônimo) responde só sim/não para um @ — permite saber se um @ existe; aceito para o cadastro.
- Integridade das migrações: todas reexecutáveis. `0007_sem_notas.sql` é uma migração **de dados** antiga (remove observações); rodar de novo não faz mal, mas não é só estrutura. As migrações `0002`/`0004` eram dados pessoais e nunca foram versionadas.
