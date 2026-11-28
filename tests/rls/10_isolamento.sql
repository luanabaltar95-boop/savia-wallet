-- =========================================================
-- Isolamento entre usuários (A e B fictícios) — evidências.
-- Cada verificação imprime OK ou FALHA. Rodar via tests/rls/rodar.sh
-- =========================================================
\set ON_ERROR_STOP 0
set client_min_messages = notice;
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@teste.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@teste.local'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@teste.local');
insert into public.wallet_perfis values ('aaaaaaaa-0000-0000-0000-00000000000a', 'usuario_a', now()), ('bbbbbbbb-0000-0000-0000-00000000000b', 'usuario_b', now()), ('cccccccc-0000-0000-0000-00000000000c', 'usuario_c', now());
insert into public.wallet_carteiras values ('aaaaaaaa-0000-0000-0000-00000000000a', '{"dono":"A","config":{"objetivos":[{"id":"oa","tipo":"reserva"}]}}', now()),
                                           ('bbbbbbbb-0000-0000-0000-00000000000b', '{"dono":"B","config":{"objetivos":[{"id":"ob","tipo":"dividas"}]}}', now());

create or replace function pg_temp.ok(cond boolean, nome text) returns void language plpgsql as $$
begin raise notice '% %', case when cond then 'OK   ' else 'FALHA' end, nome; end $$;
create or replace function pg_temp.como(uid text, papel text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when uid is null then json_build_object('role', papel)::text else json_build_object('sub', uid, 'role', papel)::text end, false);
  execute format('set role %I', papel);
end $$;

-- ---------- Usuário A (autenticado) ----------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a', 'authenticated');
select pg_temp.ok((select count(*) from wallet_carteiras) = 1 and (select dados->>'dono' from wallet_carteiras) = 'A', 'A só vê a própria carteira');
select pg_temp.ok((select count(*) from wallet_carteiras where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b') = 0, 'A não consulta a carteira de B (nem filtrando pelo id)');
select pg_temp.ok((select count(*) from wallet_carteiras where dados->'config'->'objetivos' @> '[{"id":"ob"}]') = 0, 'A não vê os objetivos de B');
select pg_temp.ok((select count(*) from wallet_perfis) = 1, 'A só vê o próprio perfil');
do $$ declare n int; begin update wallet_carteiras set dados = '{"hack":1}' where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A não altera a carteira de B'); end $$;
do $$ begin update wallet_carteiras set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'; perform pg_temp.ok(false, 'A não transfere a própria carteira para B');
  exception when others then perform pg_temp.ok(true, 'A não transfere a própria carteira para B'); end $$;
do $$ declare n int; begin delete from wallet_carteiras where user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A não exclui a carteira de B');
  exception when others then perform pg_temp.ok(true, 'A não exclui a carteira de B (sem permissão de excluir)'); end $$;
do $$ begin insert into wallet_carteiras values ('cccccccc-0000-0000-0000-00000000000c', '{"falso":1}', now()); perform pg_temp.ok(false, 'A não cria carteira em nome de C');
  exception when others then perform pg_temp.ok(true, 'A não cria carteira em nome de C'); end $$;
do $$ begin insert into wallet_perfis values ('cccccccc-0000-0000-0000-00000000000c', 'falso_c', now()); perform pg_temp.ok(false, 'A não cria perfil em nome de C');
  exception when others then perform pg_temp.ok(true, 'A não cria perfil em nome de C'); end $$;
do $$ begin perform pg_temp.ok(not exists (select 1 from wallet_importacoes), 'A não lê carteiras importadas de ninguém'); exception when others then perform pg_temp.ok(true, 'A não lê carteiras importadas de ninguém'); end $$;

-- Conexões: A pede a B (permitido); A não cria conexão já aceita nem em nome de outro
do $$ begin insert into wallet_conexoes (de, para, status) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b', 'aceita'); perform pg_temp.ok(false, 'A não cria conexão já aceita');
  exception when others then perform pg_temp.ok(true, 'A não cria conexão já aceita'); end $$;
do $$ begin insert into wallet_conexoes (de, para) values ('cccccccc-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-00000000000b'); perform pg_temp.ok(false, 'A não cria pedido em nome de C');
  exception when others then perform pg_temp.ok(true, 'A não cria pedido em nome de C'); end $$;
insert into wallet_conexoes (de, para) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b');
do $$ begin insert into wallet_compartilhados (dono, com, tipo, nome, valor) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b', 'conta', 'x', 1); perform pg_temp.ok(false, 'A não compartilha com B antes de B aceitar');
  exception when others then perform pg_temp.ok(true, 'A não compartilha com B antes de B aceitar'); end $$;
do $$ declare n int; begin update wallet_conexoes set status = 'aceita' where para = 'bbbbbbbb-0000-0000-0000-00000000000b'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'A não aceita o próprio pedido por B'); end $$;

-- ---------- Usuário B ----------
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b', 'authenticated');
-- B aceita, mas não pode trocar quem pediu (fabricar conexão C → B)
do $$ declare n int; begin
  update wallet_conexoes set de = 'cccccccc-0000-0000-0000-00000000000c', status = 'aceita' where para = 'bbbbbbbb-0000-0000-0000-00000000000b';
  get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'B não troca quem pediu a conexão (fabricar conexão com C)');
  exception when others then perform pg_temp.ok(true, 'B não troca quem pediu a conexão (fabricar conexão com C)'); end $$;
reset role;
update wallet_conexoes set de = 'aaaaaaaa-0000-0000-0000-00000000000a', status = 'pendente' where para = 'bbbbbbbb-0000-0000-0000-00000000000b';
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b', 'authenticated');
update wallet_conexoes set status = 'aceita' where para = 'bbbbbbbb-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from wallet_conexoes where status = 'aceita') = 1, 'B aceita o pedido de A');

-- ---------- A compartilha com B ----------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a', 'authenticated');
insert into wallet_compartilhados (dono, com, tipo, nome, valor) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b', 'conta', 'Aluguel teste', 100);
select pg_temp.ok((select count(*) from wallet_compartilhados) = 1, 'A vê o item que compartilhou');
do $$ begin insert into wallet_compartilhados (dono, com, tipo, nome, valor) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000c', 'conta', 'x', 1); perform pg_temp.ok(false, 'A não compartilha com C (sem conexão)');
  exception when others then perform pg_temp.ok(true, 'A não compartilha com C (sem conexão)'); end $$;

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b', 'authenticated');
select pg_temp.ok((select count(*) from wallet_compartilhados) = 1, 'B vê o item compartilhado com ele');
do $$ declare n int; begin update wallet_compartilhados set pagamentos = '[{"v":50}]'; get diagnostics n = row_count; perform pg_temp.ok(n = 1, 'B registra pagamento no item compartilhado'); end $$;
do $$ declare n int; begin
  update wallet_compartilhados set dono = 'cccccccc-0000-0000-0000-00000000000c';
  get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'B não passa o item de A para C (vínculo indevido)');
  exception when others then perform pg_temp.ok(true, 'B não passa o item de A para C (vínculo indevido)'); end $$;
do $$ declare n int; begin delete from wallet_compartilhados; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'B não exclui o item de A'); end $$;

-- ---------- C (sem conexão) ----------
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c', 'authenticated');
select pg_temp.ok((select count(*) from wallet_compartilhados) = 0 and (select count(*) from wallet_conexoes) = 0, 'C não vê conexões nem itens de A e B');
select pg_temp.ok((select count(*) from wallet_minhas_conexoes()) = 0, 'Função de conexões não vaza dados para C');

-- ---------- Não autenticado (anon) ----------
select pg_temp.como(null, 'anon');
do $$ begin perform pg_temp.ok((select count(*) from wallet_carteiras) = 0, 'Anônimo não lê carteiras'); exception when others then perform pg_temp.ok(true, 'Anônimo não lê carteiras'); end $$;
do $$ begin perform pg_temp.ok((select count(*) from wallet_perfis) = 0, 'Anônimo não lê perfis'); exception when others then perform pg_temp.ok(true, 'Anônimo não lê perfis'); end $$;
do $$ begin insert into wallet_carteiras values ('aaaaaaaa-0000-0000-0000-00000000000a', '{}', now()); perform pg_temp.ok(false, 'Anônimo não grava carteira');
  exception when others then perform pg_temp.ok(true, 'Anônimo não grava carteira'); end $$;
do $$ begin perform pg_temp.ok(wallet_usuario_livre('usuario_a') = false, 'Anônimo só sabe se um @ está livre (sim/não)'); end $$;
do $$ begin perform pg_temp.ok(wallet_email_do_usuario('usuario_a') is null, 'Anônimo NÃO descobre o e-mail de um @ (login por @)'); exception when others then perform pg_temp.ok(true, 'Anônimo NÃO descobre o e-mail de um @ (login por @)'); end $$;
do $$ begin perform wallet_buscar_usuario('usuario_a'); perform pg_temp.ok(false, 'Anônimo não busca usuários');
  exception when others then perform pg_temp.ok(true, 'Anônimo não busca usuários'); end $$;
reset role;
