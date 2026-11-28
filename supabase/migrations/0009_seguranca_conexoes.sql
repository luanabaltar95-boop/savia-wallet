-- =========================================================
-- Savia Wallet — correções de isolamento encontradas nos testes de RLS
-- (tests/rls). Não mexe em dados; pode rodar mais de uma vez.
-- 1) Quem aceita uma conexão só muda o status (não troca quem pediu).
-- 2) Em itens compartilhados, ninguém troca o dono nem com quem é.
-- 3) Funções internas não ficam abertas para quem não entrou.
-- =========================================================

-- 1) Conexões: aceitar = só status, e só para "aceita"
revoke update on public.wallet_conexoes from authenticated, anon;
grant update (status) on public.wallet_conexoes to authenticated;
drop policy if exists "conexao: aceitar" on public.wallet_conexoes;
create policy "conexao: aceitar" on public.wallet_conexoes for update to authenticated
  using (para = auth.uid()) with check (para = auth.uid() and status = 'aceita');

-- 2) Compartilhados: dono e "com" não mudam depois de criados
revoke update on public.wallet_compartilhados from authenticated, anon;
grant update (tipo, nome, valor, freq, pagamentos, dados, atualizado_em) on public.wallet_compartilhados to authenticated;

-- 3) Funções: só para quem entrou (o Postgres libera para todos por padrão)
revoke execute on function public.wallet_buscar_usuario(text) from public, anon;
revoke execute on function public.wallet_minhas_conexoes() from public, anon;
revoke execute on function public.wallet_reivindicar() from public, anon;
revoke execute on function public.wallet_conectados(uuid, uuid) from public, anon;
grant execute on function public.wallet_buscar_usuario(text) to authenticated;
grant execute on function public.wallet_minhas_conexoes() to authenticated;
grant execute on function public.wallet_reivindicar() to authenticated;
grant execute on function public.wallet_conectados(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
