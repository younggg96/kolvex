#!/usr/bin/env bash
set -euo pipefail

# Resolve configuration and venv relative to this script, even from the repo root.
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3.11+ is required."
    exit 1
fi

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env. Configure SUPABASE_URL, SUPABASE_KEY and SUPABASE_SERVICE_KEY, then run again."
    exit 1
fi

if [ ! -x venv/bin/python ]; then
    python3 -m venv venv
fi

# A moved/deleted venv can leave an old server running with missing package metadata.
# Always start a new process using the interpreter inside this project.
venv/bin/python -m ensurepip --upgrade >/dev/null
venv/bin/python -m pip install -r requirements.txt
venv/bin/python -m pip check
venv/bin/python - <<'PY'
import sys
from importlib.metadata import version
from app.core.config import settings
from pydantic import TypeAdapter, EmailStr

if sys.version_info < (3, 11):
    raise SystemExit("Python 3.11+ is required.")
missing = [key for key in ("SUPABASE_URL", "SUPABASE_KEY") if not getattr(settings, key)]
if missing:
    raise SystemExit("Configure .env: " + ", ".join(missing))
TypeAdapter(EmailStr).validate_python("local-check@example.com")
print("Auth dependency check passed (email-validator " + version("email-validator") + ").")
PY

echo "API: http://127.0.0.1:8080"
echo "Docs: http://127.0.0.1:8080/docs"
echo "Authentication uses the Supabase project configured in .env."
exec venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8080 --reload
