#!/bin/zsh
set -euo pipefail
cd "$(dirname "$0")"
python_bin="${PYTHON_BIN:-python3}"
"$python_bin" -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
if [[ "${1:-}" == "--whisper" ]]; then
  .venv/bin/python -m pip install 'mlx-whisper>=0.4,<0.5'
fi
print '\nPython 依赖安装完成。'
command -v ffmpeg >/dev/null || print '音频转写需要 FFmpeg：brew install ffmpeg'
command -v ollama >/dev/null || print '请安装 Ollama：https://ollama.com/download'
print '启动 Ollama 后，运行：ollama pull qwen2.5:7b'
print '检查环境：./start.sh --check'
print '发现博主视频：./start.sh batch discover --config channels.kolvex.json --output batches/kolvex.json'
print '批量处理：./start.sh batch run batches/kolvex.json'
