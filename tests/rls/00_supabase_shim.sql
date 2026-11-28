-- =========================================================
-- Simulação mínima do Supabase para testar as migrações e a RLS
-- num Postgres local (sem Docker). Recria: papéis anon/authenticated/
-- service_role/authenticator, auth.users e auth.uid()/auth.role()
-- lendo o JWT como o PostgREST faz (request.jwt.claims).
-- NÃO usar em produção.
-- =========================================================
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login password 'teste' noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create table auth.users (id uuid primary key, email text unique, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
  $$ select current_setting('request.jwt.claims', true)::json->>'role' $$;
create or replace function auth.email() returns text language sql stable as
  $$ select current_setting('request.jwt.claims', true)::json->>'email' $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- Padrões do Supabase: o schema public é usável pelos papéis da API
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
