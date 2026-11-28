#!/usr/bin/env bash
# Testes de isolamento multiusuário (RLS) num Postgres local.
# Uso: PGHOST=/tmp PGPORT=5499 PGUSER=postgres bash tests/rls/rodar.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${DB:-savia_rls}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f tests/rls/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do
  case "$f" in *PRIVADO*) continue;; esac
  echo "migração: $f"; psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f"
done
# Segunda vez: as migrações precisam ser reexecutáveis (idempotentes)
for f in supabase/migrations/*.sql; do case "$f" in *PRIVADO*) continue;; esac; psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f" >/dev/null; done
echo "migrações reexecutadas sem erro"
psql -q -v ON_ERROR_STOP=1 -d $DB -f tests/rls/10_isolamento.sql
