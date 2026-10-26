#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -x .venv/bin/python ]]; then
  print '请先运行 ./setup.sh（无字幕转写可用 ./setup.sh --whisper）'
  exit 1
fi
case "${1:-}" in
  batch) shift; exec .venv/bin/python batch.py "$@" ;;
  sync) shift; exec .venv/bin/python sync_kolvex.py "$@" ;;
  combine) shift; exec .venv/bin/python combine.py "$@" ;;
  api) shift; exec .venv/bin/python server.py "$@" ;;
  *) exec .venv/bin/python youtube_transcribe.py "$@" ;;
esac
