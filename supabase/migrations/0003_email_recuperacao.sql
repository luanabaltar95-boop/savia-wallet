-- =========================================================
-- Savia Wallet — login com e-mail (para recuperar senha) e
-- carteira importada esperando o dono criar o usuário.
-- =========================================================

-- Carteiras trazidas de fora, guardadas pelo @ até a pessoa criar o usuário.
-- Sem políticas: ninguém lê direto; só a função abaixo mexe aqui.
create table if not exists public.wallet_importacoes (
  usuario text primary key,
  dados jsonb not null,
  criado_em timestamptz not null default now()
);
alter table public.wallet_importacoes enable row level security;

-- Entrar com @: descobre o e-mail do @ (só o e-mail, nada mais)
create or replace function public.wallet_email_do_usuario(p_usuario text)
returns text
language sql
security definer
set search_path = public, auth
stable
as $$
  select u.email from public.wallet_perfis p join auth.users u on u.id = p.user_id
  where p.usuario = lower(p_usuario) limit 1;
$$;
grant execute on function public.wallet_email_do_usuario(text) to anon, authenticated;

-- Depois de entrar: se houver carteira importada para o meu @, ela vira minha
create or replace function public.wallet_reivindicar()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario text;
  v_dados jsonb;
begin
  select usuario into v_usuario from public.wallet_perfis where user_id = auth.uid();
  if v_usuario is null then return false; end if;
  delete from public.wallet_importacoes where usuario = v_usuario returning dados into v_dados;
  if v_dados is null then return false; end if;
  insert into public.wallet_carteiras (user_id, dados, updated_at) values (auth.uid(), v_dados, now())
  on conflict (user_id) do update set dados = excluded.dados, updated_at = now();
  return true;
end;
$$;
grant execute on function public.wallet_reivindicar() to authenticated;
