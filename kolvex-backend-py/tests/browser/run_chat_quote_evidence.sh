#!/usr/bin/env bash
# Requires Docker, the backend venv, installed web dependencies, and Playwright Core.
# Set PLAYWRIGHT_CORE_PATH to the package directory if it is not on Node's module path.
set -euo pipefail

test_dir="$(cd "$(dirname "$0")" && pwd)"
backend="$(cd "$test_dir/../.." && pwd)"
web="$(cd "$backend/../kolvex-frontend-web-nextjs" && pwd)"
python="$backend/venv/bin/python"
scratch="$(mktemp -d)"
network="kolvex-quote-test-$$"
postgres=""
postgrest=""
backend_pid=""
web_pid=""

cleanup() {
  [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "$postgrest" ]] || docker rm -f "$postgrest" >/dev/null 2>&1 || true
  [[ -z "$postgres" ]] || docker rm -f "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf "$scratch"
}

show_logs() {
  for log in "$scratch/backend.log" "$scratch/web.log"; do
    if [[ -f "$log" ]]; then tail -60 "$log"; fi
  done
}

trap cleanup EXIT
trap show_logs ERR

free_port() {
  "$python" -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'
}

wait_http() {
  for ((i = 0; i < 120; i++)); do
    if curl -sSf --max-time 2 "$1" >/dev/null 2>&1; then return; fi
    sleep 1
  done
  echo "Timed out waiting for $1" >&2
  return 1
}

docker network create "$network" >/dev/null
postgres="$(docker run -d --network "$network" --network-alias db -e POSTGRES_PASSWORD=fixture postgres:17-alpine)"
for ((i = 0; i < 45; i++)); do
  if docker exec "$postgres" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
{
  cat <<'SQL'
create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL
  cat "$backend/migrations/create_chat_conversations_table.sql"
  cat "$backend/supabase/migrations/20261110184725_chat_quote_evidence.sql"
  cat "$backend/supabase/migrations/20261110184729_chat_revenue_evidence.sql"
  cat <<'SQL'
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
insert into public.chat_conversations (id, user_id)
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
SQL
} | docker exec -i "$postgres" psql -X -v ON_ERROR_STOP=1 -U postgres >/dev/null

postgrest="$(docker run -d --network "$network" -p 127.0.0.1::3000 \
  -e PGRST_DB_URI=postgres://postgres:fixture@db:5432/postgres \
  -e PGRST_DB_ANON_ROLE=postgres postgrest/postgrest:v12.2.12)"
postgrest_url="http://$(docker port "$postgrest" 3000/tcp)"
wait_http "$postgrest_url/chat_conversations"

backend_port="$(free_port)"
backend_url="http://127.0.0.1:$backend_port"
(
  cd "$scratch"
  export PYTHONPATH="$backend:$test_dir"
  export QUOTE_TEST_POSTGREST_URL="$postgrest_url"
  exec "$python" -m uvicorn chat_quote_fixture:app --host 127.0.0.1 --port "$backend_port"
) >"$scratch/backend.log" 2>&1 &
backend_pid=$!
wait_http "$backend_url/auth/v1/user"

# Copy source to keep the running development server's build cache and env files untouched.
mkdir "$scratch/web"
rsync -a --exclude '/node_modules' --exclude '/.next' --exclude '/.env*' "$web/" "$scratch/web/"
ln -s "$web/node_modules" "$scratch/web/node_modules"
web_port="$(free_port)"
web_url="http://127.0.0.1:$web_port"
(
  cd "$scratch/web"
  export NEXT_PUBLIC_SUPABASE_URL="$backend_url"
  export NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture
  export NEXT_PUBLIC_BACKEND_API_URL="$backend_url"
  export NEXT_TELEMETRY_DISABLED=1
  exec node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port "$web_port"
) >"$scratch/web.log" 2>&1 &
web_pid=$!
for ((i = 0; i < 120; i++)); do
  if curl -s --max-time 1 "$web_url/favicon.ico" >/dev/null 2>&1; then break; fi
  sleep 1
done
QUOTE_TEST_WEB_URL="$web_url" QUOTE_TEST_AUTH_URL="$backend_url" node "$test_dir/chat_quote_evidence.cjs"
