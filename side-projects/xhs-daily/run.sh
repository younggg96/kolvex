#!/bin/bash
set -euo pipefail
umask 077

collector_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$collector_dir/../.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ $# -eq 0 ]]; then
  set -- run
fi
runtime_dir="$HOME/Library/Application Support/Kolvex/xhs-worker/side-projects/xhs-daily"
if [[ "$collector_dir" != "$runtime_dir" && "$1" != install && -f "$runtime_dir/.runtime-ready" ]]; then
  exec /bin/bash "$runtime_dir/run.sh" "$@"
fi
cd "$repo_dir"
exec "$repo_dir/kolvex-backend-py/venv/bin/python" "$collector_dir/workflow.py" "$@"
