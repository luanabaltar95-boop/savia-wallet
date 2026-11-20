-- =========================================================
-- Savia Wallet — "livro" de divisão entre duas pessoas.
-- O dono publica as contas que divide (já calculadas por semana/mês);
-- as duas pessoas registram pagamentos no mesmo livro.
-- =========================================================
alter table public.wallet_compartilhados add column if not exists dados jsonb not null default '{}'::jsonb;
alter table public.wallet_compartilhados drop constraint if exists wallet_compartilhados_tipo_check;
alter table public.wallet_compartilhados add constraint wallet_compartilhados_tipo_check
  check (tipo in ('conta', 'me_deve', 'eu_devo', 'divisao'));
create unique index if not exists wallet_divisao_par on public.wallet_compartilhados (dono, com) where tipo = 'divisao';
notify pgrst, 'reload schema';
