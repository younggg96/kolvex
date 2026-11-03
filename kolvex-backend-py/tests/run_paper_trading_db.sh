#!/bin/sh
# Run inside a disposable postgres:17-alpine container with the backend mounted /work read-only.
set -eu
docker-entrypoint.sh postgres >/tmp/paper-postgres.log 2>&1 &
paper_postgres_pid=$!
trap 'kill "$paper_postgres_pid" 2>/dev/null || true' EXIT
paper_attempt=0
until pg_isready -U postgres >/dev/null 2>&1; do
  paper_attempt=$((paper_attempt + 1))
  if [ "$paper_attempt" -gt 30 ]; then cat /tmp/paper-postgres.log; exit 1; fi
  sleep 1
done
psql -U postgres -v ON_ERROR_STOP=1 -f /work/supabase/tests/paper_trading_bootstrap.sql
psql -U postgres -v ON_ERROR_STOP=1 -f /work/supabase/migrations/20261103090502_paper_trading.sql
psql -U postgres -v ON_ERROR_STOP=1 -f /work/supabase/tests/paper_trading.sql
