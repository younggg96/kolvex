#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
[[ -x .venv/bin/python ]] || { print '请先运行 ./setup.sh'; exit 1; }
exec .venv/bin/python collect.py "$@"
