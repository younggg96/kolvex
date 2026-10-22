"""Isolated MLX process; importing this module does not load the model."""
import json
from pathlib import Path
import sys

if __name__ == '__main__':
    import mlx_whisper
    result = mlx_whisper.transcribe(sys.argv[1], path_or_hf_repo=sys.argv[3])
    Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False))
