"""Builds the Chrome Web Store screenshots (1280x800) and small promo tile (440x280).

Input: raw page captures in a shots folder (made with headless Edge from the
demo, options and popup pages, which only ever show made-up students).
Run: py tools/make_store_images.py <shots folder>
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHOTS = Path(sys.argv[1])
OUT = ROOT / "store"
OUT.mkdir(exist_ok=True)
FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"


def save(image, name):
    # The store accepts 24-bit PNG/JPEG with no alpha.
    image.convert("RGB").save(OUT / name)


# 1. Every highlight type on the sample class.
save(Image.open(SHOTS / "demo-all.png"), "screenshot-1-scoresheet.png")

# 2. Popup floating over the scoresheet (default settings: bands only).
base = Image.open(SHOTS / "demo-default.png").convert("RGBA")
popup = Image.open(SHOTS / "popup.png").convert("RGBA").crop((0, 0, 340, 560))
x, y = 1280 - 340 - 40, 24
shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
ImageDraw.Draw(shadow).rectangle([x + 4, y + 6, x + 344, y + 566], fill=(0, 0, 0, 110))
base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(10)))
base.paste(popup, (x, y))
ImageDraw.Draw(base).rectangle([x, y, x + 339, y + 559], outline="#c3ccd6")
save(base, "screenshot-2-popup.png")

# 3. Top of the options page; 4. score codes and flags further down.
save(Image.open(SHOTS / "options.png"), "screenshot-3-settings.png")
save(Image.open(SHOTS / "options-lower.png").crop((0, 1000, 1280, 1800)), "screenshot-4-codes-flags.png")

# Small promo tile.
tile = Image.new("RGB", (440, 280), "#1f3a5f")
icon = Image.open(ROOT / "extension" / "icons" / "icon128.png").convert("RGBA")
tile.paste(icon.resize((112, 112), Image.LANCZOS), (28, 84), icon.resize((112, 112), Image.LANCZOS))
d = ImageDraw.Draw(tile)
d.text((160, 88), "Gradebook", font=ImageFont.truetype(FONT_BOLD, 34), fill="white")
d.text((160, 128), "Enhancer", font=ImageFont.truetype(FONT_BOLD, 34), fill="white")
d.text((162, 176), "for PowerTeacher Pro", font=ImageFont.truetype(FONT, 18), fill="#cfe0f3")
save(tile, "promo-small-440x280.png")
print("store images written")
