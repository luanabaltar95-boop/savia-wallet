-- =========================================================
-- Savia Wallet — tabelas e regras (rodar uma vez no SQL Editor do Supabase)
-- Cada pessoa só lê e grava a própria carteira (RLS).
-- =========================================================

-- @usuario de cada pessoa (único). Base para conexões no futuro.
create table if not exists public.wallet_perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique check (usuario ~ '^[a-z0-9._]{3,30}$'),
  criado_em timestamptz not null default now()
);

-- A carteira inteira de cada pessoa (mesmo formato do app)
create table if not exists public.wallet_carteiras (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wallet_perfis enable row level security;
alter table public.wallet_carteiras enable row level security;

-- Perfil: cada um vê e cria só o seu
drop policy if exists "perfil: ver o meu" on public.wallet_perfis;
create policy "perfil: ver o meu" on public.wallet_perfis for select to authenticated using (user_id = auth.uid());
drop policy if exists "perfil: criar o meu" on public.wallet_perfis;
create policy "perfil: criar o meu" on public.wallet_perfis for insert to authenticated with check (user_id = auth.uid());

-- Carteira: cada um lê, cria e atualiza só a sua
drop policy if exists "carteira: ver a minha" on public.wallet_carteiras;
create policy "carteira: ver a minha" on public.wallet_carteiras for select to authenticated using (user_id = auth.uid());
drop policy if exists "carteira: criar a minha" on public.wallet_carteiras;
create policy "carteira: criar a minha" on public.wallet_carteiras for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "carteira: atualizar a minha" on public.wallet_carteiras;
create policy "carteira: atualizar a minha" on public.wallet_carteiras for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Saber se um @ está livre (sem expor a lista de usuários)
create or replace function public.wallet_usuario_livre(p_usuario text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (select 1 from public.wallet_perfis where usuario = lower(p_usuario));
$$;
grant execute on function public.wallet_usuario_livre(text) to anon, authenticated;
