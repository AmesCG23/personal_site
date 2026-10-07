"""Draws Meet's icon: an "MTG" monogram in the same style as the main site's "AG" favicon
(Cormorant Garamond Bold, accent red on paper), and writes every size the page needs into
meet/icons/.

    python3 docs/meet/make-icons.py path/to/CormorantGaramond-Bold.ttf

Needs fonttools and cairosvg (pip install fonttools cairosvg). Get the font from Google Fonts.
The letters are real glyph outlines, so the SVG doesn't depend on the font being installed."""
import io, os, sys
import cairosvg
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

TEXT = 'MTG'
PAPER, RED = '#f3ede1', '#a8201a'
SIZE, MARGIN = 512, 28  # same canvas as /favicon.svg; letters fill the width inside the margin
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'meet', 'icons')

def monogram_svg(font_path):
    font = TTFont(font_path)
    if 'fvar' in font:  # a variable font: pin it to Bold
        from fontTools.varLib.instancer import instantiateVariableFont
        font = instantiateVariableFont(font, {'wght': 700})
    glyphs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font['hmtx']
    paths, x = [], 0
    bounds = BoundsPen(glyphs)
    for ch in TEXT:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        paths.append(f'<path transform="translate({x},0)" d="{pen.getCommands()}"/>')
        glyphs[name].draw(TransformPen(bounds, (1, 0, 0, 1, x, 0)))
        x += hmtx[name][0]
    xmin, ymin, xmax, ymax = bounds.bounds
    scale = (SIZE - 2 * MARGIN) / (xmax - xmin)
    tx = MARGIN - xmin * scale
    ty = SIZE / 2 + (ymax + ymin) / 2 * scale  # centre the capitals vertically
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">\n'
            f'  <rect width="{SIZE}" height="{SIZE}" fill="{PAPER}"/>\n'
            f'  <g transform="translate({tx:.2f},{ty:.2f}) scale({scale:.5f},{-scale:.5f})" fill="{RED}">\n    '
            + '\n    '.join(paths) + '\n  </g>\n</svg>\n')

def png(svg, px):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=px, output_height=px))).convert('RGBA')

if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    svg = monogram_svg(sys.argv[1])
    open(os.path.join(OUT, 'icon.svg'), 'w').write(svg)
    png(svg, 180).convert('RGB').save(os.path.join(OUT, 'icon-180.png'))  # iPhone home screen
    png(svg, 192).save(os.path.join(OUT, 'icon-192.png'))
    png(svg, 512).save(os.path.join(OUT, 'icon-512.png'))
    png(svg, 48).save(os.path.join(OUT, 'favicon.ico'), sizes=[(48, 48), (32, 32), (16, 16)],
                      append_images=[png(svg, 32), png(svg, 16)])
    print('wrote', sorted(os.listdir(OUT)))
