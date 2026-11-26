#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
python_bin="${PYTHON_BIN:-python3}"
"$python_bin" -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
if [[ "${1:-}" == "--chromium" ]]; then
  .venv/bin/python -m playwright install chromium
fi
print '\n依赖安装完成。默认使用本机 Google Chrome；没有装 Chrome 时运行 ./setup.sh --chromium'
print '试抓一次（不写库）：./start.sh --dry-run'
