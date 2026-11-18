"""Stitch 4x4 browser-pane tiles (each = 480x270 CSS px of a 1920x1080 viewport, captured at 800x450)
into one 3200x1800 texture (1.667x), remove personal/admin data by flat-filling those regions with the
surrounding surface colour (before the aurora, so the glow stays continuous), then add the page's WebGL
aurora (captured alone at 800x450) back with a lighten blend. Regions are viewport CSS px: [x, y, w, h, [r,g,b]].
usage: python3 stitch_tiles.py <tiles.json> <name>
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageDraw

spec = json.load(open(sys.argv[1]))[sys.argv[2]]
root = Path(spec['dir'])
S = 800 / 480  # output px per CSS px
W, H = round(1920 * S), round(1080 * S)
out = Image.new('RGB', (W, H))
for r, row in enumerate(spec['tiles']):
    for c, name in enumerate(row):
        if name is None:
            continue  # tile without UI: canvas hidden → pure black
        im = Image.open(root / name).convert('RGB')
        out.paste(im, (c * 800, r * 450))
draw = ImageDraw.Draw(out)
for (x, y, w, h, rgb) in spec.get('redact', []):
    draw.rectangle(tuple(round(v * S) for v in (x, y, x + w, y + h)), fill=tuple(rgb))
if spec.get('aurora'):
    aur = Image.open(root / spec['aurora']).convert('RGB').resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * spec.get('auroraGain', 0.4)))
    out = ImageChops.lighter(out, aur)
dst = Path(spec['out'])
dst.parent.mkdir(parents=True, exist_ok=True)
out.save(dst, optimize=True)
print('wrote', dst, out.size)
