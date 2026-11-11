r"""Draws the extension icons (16/32/48/128) and the store icon.

Design ("gradebook page", chosen 2026-11-10): a white gradebook sheet on a
navy tile, with a blue header bar, a column of name lines, and a 3x3 grid of
red / yellow / green score cells. The 48 and 128 px icons and the store icon
carry the author's initials "DG" in a navy badge in the bottom-right corner;
at 16 and 32 px the letters would be a few pixels tall and unreadable, so
those sizes leave them out.

Why drawn in code: icons stay reproducible and easy to tweak.
Run: py tools/make_icons.py   (plain py: PIL lives in user site-packages)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "extension" / "icons"
SCALE = 512  # draw large, then downsample for smooth edges

NAVY = "#1f3a5f"
BLUE = "#0b75b8"
WHITE = "#ffffff"
NAME_LINE = "#c9d3de"
RED, YELLOW, GREEN = "#ff4d4d", "#ffd23f", "#4caf50"
GRID = [[GREEN, GREEN, YELLOW], [RED, GREEN, GREEN], [YELLOW, RED, GREEN]]
BOLD = "C:/Windows/Fonts/segoeuib.ttf"


def draw(with_initials: bool) -> Image.Image:
    image = Image.new("RGBA", (SCALE, SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle([0, 0, SCALE - 1, SCALE - 1], radius=SCALE * 0.2, fill=NAVY)

    # The gradebook sheet with its blue header bar (rounded on top only).
    page = [44, 44, SCALE - 44, SCALE - 44]
    d.rounded_rectangle(page, radius=34, fill=WHITE)
    d.rounded_rectangle([page[0], page[1], page[2], page[1] + 86], radius=34, fill=BLUE)
    d.rectangle([page[0], page[1] + 50, page[2], page[1] + 86], fill=BLUE)

    # Three student rows: a name line on the left, three score cells on the right.
    top, bottom = page[1] + 110, page[3] - 34
    rows, cols, gap = 3, 3, 14
    row_height = (bottom - top) / rows
    for r in range(rows):
        middle = top + r * row_height + row_height / 2
        d.rounded_rectangle([page[0] + 30, middle - 14, page[0] + 150, middle + 14], radius=14, fill=NAME_LINE)

    left, right = page[0] + 180, page[2] - 30
    cell_w = (right - left - gap * (cols - 1)) / cols
    cell_h = (bottom - top - 12 - gap * (rows - 1)) / rows
    for r in range(rows):
        for c in range(cols):
            x0 = left + c * (cell_w + gap)
            y0 = top + 6 + r * (cell_h + gap)
            d.rounded_rectangle([x0, y0, x0 + cell_w, y0 + cell_h], radius=cell_w * 0.12, fill=GRID[r][c])

    if with_initials:
        # "DG" in a navy badge tucked into the bottom-right corner.
        size = 74
        right_edge, bottom_edge = SCALE - 18, SCALE - 18
        width, height = size * 1.55, size * 1.05
        d.rounded_rectangle([right_edge - width, bottom_edge - height, right_edge, bottom_edge],
                            radius=height * 0.3, fill=NAVY)
        d.text((right_edge - width / 2, bottom_edge - height / 2), "DG",
               font=ImageFont.truetype(BOLD, size), fill=WHITE, anchor="mm")
    return image


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with_dg, without_dg = draw(True), draw(False)
    for size in (16, 32):
        without_dg.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")
    for size in (48, 128):
        with_dg.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png")

    # Store icon: Google asks for 128x128 with the artwork inside 96x96 (16 px transparent padding).
    store_icon = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    store_icon.paste(with_dg.resize((96, 96), Image.LANCZOS), (16, 16))
    (ROOT / "store").mkdir(exist_ok=True)
    store_icon.save(ROOT / "store" / "store-icon-128.png")
    print("icons written")


# Only redraw the icons when run directly (make_profile_pic.py imports draw()).
if __name__ == "__main__":
    main()
