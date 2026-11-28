# Como testar

## 1. Regras (Node 18+, sem instalar nada)
```
node tests/goals.test.mjs      # Goal Engine, planejamento unificado, jornada, migração (23 cenários)
node tests/ambiente.test.mjs   # matriz de ambientes (9 casos)
```

## 2. App no navegador (modo demonstração)
```
python3 -m http.server 8765
# abrir http://localhost:8765 → entrar como @ana, @bruno, @carla, @dani, @eva ou @novo (senha demo1234)
```
Sem `/api` o app abre sozinho em demonstração; nada toca o banco real.

## 3. Isolamento entre usuários (RLS) — Postgres local
Precisa de `psql` e um Postgres 15+ local (sem Docker):
```
PGHOST=/tmp PGPORT=5499 PGUSER=postgres bash tests/rls/rodar.sh
```
Cria o banco `savia_rls`, simula o Supabase (`tests/rls/00_supabase_shim.sql`), aplica todas as migrações **duas vezes** (precisam ser reexecutáveis) e roda `tests/rls/10_isolamento.sql` com os usuários fictícios A, B e C. Cada linha imprime `OK` ou `FALHA`.

## 4. Pela API (como o app faz)
Com o banco acima, suba o PostgREST (binário em github.com/PostgREST/postgrest/releases) com `db-anon-role = "anon"`, `jwt-secret` igual ao de `tests/rls/api.py` e rode:
```
python3 tests/rls/api.py
```
Gera tokens de A, B e anônimo e tenta ler, alterar, excluir e criar dados do outro pela API REST.

## 5. Supabase local completo
Ver `docs/ENVIRONMENTS.md` → "Supabase local".
