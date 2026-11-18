"""chat.png → chat-empty.png: paint the composer placeholder out with a Coons-patch fill — every pixel of the
placeholder box is blended from the clean composer pixels on all four sides, so the aurora tint inside the
composer stays continuous and the typed text needs no cover box."""
from PIL import Image
S = 800 / 480
im = Image.open('public/textures/dashboard/chat.png').convert('RGB')
px = im.load()
x0, x1, y0, y1 = int(768 * S), int(1208 * S), int(909 * S), int(947 * S)  # inside the rounded border
L = {y: px[x0 - 1, y] for y in range(y0, y1 + 1)}
R = {y: px[x1 + 1, y] for y in range(y0, y1 + 1)}
T = {x: px[x, y0 - 1] for x in range(x0, x1 + 1)}
B = {x: px[x, y1 + 1] for x in range(x0, x1 + 1)}
c00, c10, c01, c11 = px[x0 - 1, y0 - 1], px[x1 + 1, y0 - 1], px[x0 - 1, y1 + 1], px[x1 + 1, y1 + 1]
for y in range(y0, y1 + 1):
    v = (y - y0) / (y1 - y0)
    for x in range(x0, x1 + 1):
        u = (x - x0) / (x1 - x0)
        out = []
        for c in range(3):
            h = L[y][c] * (1 - u) + R[y][c] * u
            w = T[x][c] * (1 - v) + B[x][c] * v
            b = (c00[c] * (1 - u) * (1 - v) + c10[c] * u * (1 - v) + c01[c] * (1 - u) * v + c11[c] * u * v)
            out.append(max(0, min(255, round(h + w - b))))
        px[x, y] = tuple(out)
im.save('public/textures/dashboard/chat-empty.png', optimize=True)
im.crop((int(740 * S), int(880 * S), int(1440 * S), int(1000 * S))).resize((1400, 240)).save('out/qa/chat-empty-crop.png')
print('ok')
