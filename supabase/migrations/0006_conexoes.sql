-- =========================================================
-- Savia Wallet — conexões entre pessoas e itens compartilhados
-- (contas divididas e dívidas entre duas pessoas).
-- Cada pessoa só vê as conexões e os itens de que participa.
-- =========================================================

-- Conexões: "de" pede, "para" aceita
create table if not exists public.wallet_conexoes (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references auth.users(id) on delete cascade default auth.uid(),
  para uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceita')),
  criado_em timestamptz not null default now(),
  unique (de, para),
  check (de <> para)
);
alter table public.wallet_conexoes enable row level security;
drop policy if exists "conexao: ver as minhas" on public.wallet_conexoes;
create policy "conexao: ver as minhas" on public.wallet_conexoes for select to authenticated using (auth.uid() in (de, para));
drop policy if exists "conexao: pedir" on public.wallet_conexoes;
create policy "conexao: pedir" on public.wallet_conexoes for insert to authenticated with check (de = auth.uid() and status = 'pendente');
drop policy if exists "conexao: aceitar" on public.wallet_conexoes;
create policy "conexao: aceitar" on public.wallet_conexoes for update to authenticated using (para = auth.uid()) with check (para = auth.uid());
drop policy if exists "conexao: desfazer" on public.wallet_conexoes;
create policy "conexao: desfazer" on public.wallet_conexoes for delete to authenticated using (auth.uid() in (de, para));
grant select, insert, update, delete on public.wallet_conexoes to authenticated;

-- Itens compartilhados entre duas pessoas conectadas
--   tipo 'conta'   : conta dividida (valor total, cada um paga a sua parte)
--   tipo 'me_deve' : "com" deve "valor" ao dono
--   tipo 'eu_devo' : o dono deve "valor" a "com"
-- Do outro lado, um aparece como o outro.
create table if not exists public.wallet_compartilhados (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null references auth.users(id) on delete cascade default auth.uid(),
  com uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('conta', 'me_deve', 'eu_devo')),
  nome text not null,
  valor numeric(12, 2) not null check (valor >= 0),
  freq text not null default 'unica',
  pagamentos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.wallet_compartilhados enable row level security;

create or replace function public.wallet_conectados(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.wallet_conexoes
    where status = 'aceita' and ((de = a and para = b) or (de = b and para = a)));
$$;

drop policy if exists "compartilhado: ver" on public.wallet_compartilhados;
create policy "compartilhado: ver" on public.wallet_compartilhados for select to authenticated using (auth.uid() in (dono, com));
drop policy if exists "compartilhado: criar" on public.wallet_compartilhados;
create policy "compartilhado: criar" on public.wallet_compartilhados for insert to authenticated
  with check (dono = auth.uid() and public.wallet_conectados(dono, com));
drop policy if exists "compartilhado: atualizar" on public.wallet_compartilhados;
create policy "compartilhado: atualizar" on public.wallet_compartilhados for update to authenticated
  using (auth.uid() in (dono, com)) with check (auth.uid() in (dono, com));
drop policy if exists "compartilhado: apagar" on public.wallet_compartilhados;
create policy "compartilhado: apagar" on public.wallet_compartilhados for delete to authenticated using (dono = auth.uid());
grant select, insert, update, delete on public.wallet_compartilhados to authenticated;

-- Achar alguém pelo @ (só o @ exato; devolve id e @, nada mais)
create or replace function public.wallet_buscar_usuario(p_usuario text)
returns table (user_id uuid, usuario text)
language sql stable security definer set search_path = public as $$
  select user_id, usuario from public.wallet_perfis where usuario = lower(trim(leading '@' from p_usuario)) limit 1;
$$;
grant execute on function public.wallet_buscar_usuario(text) to authenticated;

-- Minhas conexões com o @ da outra pessoa
create or replace function public.wallet_minhas_conexoes()
returns table (id uuid, outro uuid, usuario text, status text, enviada boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
         case when c.de = auth.uid() then c.para else c.de end,
         p.usuario, c.status, c.de = auth.uid()
  from public.wallet_conexoes c
  join public.wallet_perfis p on p.user_id = case when c.de = auth.uid() then c.para else c.de end
  where auth.uid() in (c.de, c.para)
  order by c.criado_em;
$$;
grant execute on function public.wallet_minhas_conexoes() to authenticated;

notify pgrst, 'reload schema';
