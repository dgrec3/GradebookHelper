"""Draws the extension icons (16/32/48/128) and the store icon.

Why drawn in code: icons stay reproducible and easy to tweak (colors match
the extension's default highlight colors). Run: py -I tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "extension" / "icons"
SCALE = 512  # draw large, then downsample for smooth edges

NAVY = "#1f3a5f"
CELL = "#ffffff"
RED = "#ff4d4d"
YELLOW = "#ffeb3b"
ORANGE = "#ff9800"


def draw(grid):
    """grid: rows of cell fills; a tuple fill means a left/right split cell."""
    image = Image.new("RGBA", (SCALE, SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle([0, 0, SCALE - 1, SCALE - 1], radius=SCALE * 0.2, fill=NAVY)

    rows, cols = len(grid), len(grid[0])
    margin = SCALE * 0.14
    gap = SCALE * (0.06 if cols == 3 else 0.08)
    cell_w = (SCALE - 2 * margin - gap * (cols - 1)) / cols
    cell_h = (SCALE - 2 * margin - gap * (rows - 1)) / rows
    for r, row in enumerate(grid):
        for c, fill in enumerate(row):
            x0 = margin + c * (cell_w + gap)
            y0 = margin + r * (cell_h + gap)
            box = [x0, y0, x0 + cell_w, y0 + cell_h]
            radius = cell_w * 0.12
            if isinstance(fill, tuple):
                # Split cell: draw the right color, then mask the left half over it.
                d.rounded_rectangle(box, radius=radius, fill=fill[1])
                left = Image.new("RGBA", image.size, (0, 0, 0, 0))
                ImageDraw.Draw(left).rounded_rectangle(box, radius=radius, fill=fill[0])
                mask = Image.new("L", image.size, 0)
                ImageDraw.Draw(mask).rectangle([x0, y0, x0 + cell_w / 2, y0 + cell_h], fill=255)
                image.paste(left, (0, 0), Image.composite(left, Image.new("RGBA", image.size), mask).getchannel("A"))
            else:
                d.rounded_rectangle(box, radius=radius, fill=fill)
    return image


# Small sizes get a 2x2 grid so the cells stay readable at 16 px.
SMALL = [[CELL, RED], [(RED, ORANGE), YELLOW]]
LARGE = [[CELL, RED, CELL], [YELLOW, CELL, (RED, ORANGE)], [CELL, CELL, YELLOW]]

OUT.mkdir(parents=True, exist_ok=True)
for size, grid in [(16, SMALL), (32, SMALL), (48, LARGE), (128, LARGE)]:
    draw(grid).resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")

# Store icon: Google asks for 128x128 with the artwork inside 96x96 (16 px transparent padding).
store_icon = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
store_icon.paste(draw(LARGE).resize((96, 96), Image.LANCZOS), (16, 16))
(ROOT / "store").mkdir(exist_ok=True)
store_icon.save(ROOT / "store" / "store-icon-128.png")
print("icons written")
