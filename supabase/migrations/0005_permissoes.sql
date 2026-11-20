-- Projetos novos do Supabase não liberam tabelas novas para a API sozinhos.
-- Libera as tabelas da carteira para quem está logado (as regras RLS continuam valendo).
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.wallet_perfis to authenticated;
grant select, insert, update on public.wallet_carteiras to authenticated;
notify pgrst, 'reload schema';
