"""Draws Meet's pixel-art icon (a tiny Magic card back with the five colour orbs) and
writes every size the page needs into meet/icons/.   python3 docs/meet/make-icons.py
Needs Pillow. Edit the palette or shapes here, then re-run."""
import math, os
from PIL import Image

N = 30  # the drawing is a 30 x 30 pixel grid
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'meet', 'icons')
PAPER = (243, 237, 225, 255)

C = {
    'edge': (27, 18, 10), 'rim': (92, 52, 22), 'field': (160, 100, 46), 'fleck': (182, 120, 58),
    'shade': (132, 80, 36), 'ovalrim': (214, 146, 62), 'oval': (34, 22, 12),
    'W': (255, 244, 196), 'U': (88, 170, 238), 'B': (156, 146, 140), 'R': (238, 96, 64), 'G': (76, 186, 104),
}

def draw():
    px = {}
    x0, x1, y0, y1 = 4, 25, 0, 29
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x in (x0, x1)) and (y in (y0, y1)):
                continue  # rounded corners
            d = min(x - x0, x1 - x, y - y0, y1 - y)
            if d == 0: col = 'edge'
            elif d <= 2: col = 'rim'
            else:
                col = 'field'
                if (x + 2 * y) % 7 == 0: col = 'fleck'
                if x == x1 - 3 or y == y1 - 3: col = 'shade'
            px[(x, y)] = col
    cx, cy, rx, ry = 14.5, 14.5, 7.6, 11.2
    for y in range(N):
        for x in range(N):
            v = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if v <= 1.0: px[(x, y)] = 'oval' if v <= 0.78 else 'ovalrim'
    # five orbs clockwise from the top: white, blue, black, red, green
    for i, k in enumerate('WUBRG'):
        a = math.radians(-90 + 72 * i)
        ox, oy = round(cx - 1.5 + 4.6 * math.cos(a)), round(cy - 1.5 + 6.9 * math.sin(a))
        dark = tuple(int(c * 0.72) for c in C[k])
        C[k + 'd'], C[k + 'h'] = dark, tuple(min(255, int(c * 0.5 + 128)) for c in C[k])
        for dx in range(4):
            for dy in range(4):
                if dx in (0, 3) and dy in (0, 3): continue  # 4x4 with corners off reads as a circle
                px[(ox + dx, oy + dy)] = k + 'd' if (dx == 3 or dy == 3) else k
        px[(ox + 1, oy + 1)] = k + 'h'  # glint
    return px

def image(px, scale, size, bg=None):
    im = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    off = (size - N * scale) // 2
    for (x, y), k in px.items():
        r, g, b = C[k]
        for i in range(scale):
            for j in range(scale):
                im.putpixel((off + x * scale + i, off + y * scale + j), (r, g, b, 255))
    return im

def svg(px):
    rects = []
    for y in range(N):
        x = 0
        while x < N:
            k = px.get((x, y))
            if not k: x += 1; continue
            start = x
            while x < N and px.get((x, y)) == k: x += 1
            rects.append(f'<rect x="{start}" y="{y}" width="{x - start}" height="1" fill="#%02x%02x%02x"/>' % C[k])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges">'
            + ''.join(rects) + '</svg>\n')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    px = draw()
    open(os.path.join(OUT, 'icon.svg'), 'w').write(svg(px))
    image(px, 1, 32).save(os.path.join(OUT, 'icon-32.png'))
    image(px, 5, 180, PAPER).save(os.path.join(OUT, 'icon-180.png'))   # iPhone home screen
    image(px, 6, 192, PAPER).save(os.path.join(OUT, 'icon-192.png'))
    image(px, 16, 512, PAPER).save(os.path.join(OUT, 'icon-512.png'))
    image(px, 2, 64).save(os.path.join(OUT, 'favicon.ico'), sizes=[(32, 32), (64, 64)],
                          append_images=[image(px, 1, 32)])
    print('wrote', sorted(os.listdir(OUT)))
