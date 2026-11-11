"""Builds the Chrome Web Store screenshots (1280x800) and small promo tile.

Each screenshot is the sample scoresheet (extension/demo.html, a PowerTeacher
look-alike with made-up students) under a given settings preset, with the
matching settings card floating on top and a one-line caption across the top,
so a store visitor sees which setting produces which look.

Pipeline (one command: py tools/make_screenshots.py):
1. Copy extension/ to a temp folder and add a test-only chrome.* stand-in
   (STORAGE_SHIM) before settings.js, so extension pages run over plain http.
   URL parameters drive the shim:
     preset=<name>   saved settings for the shot (see PRESETS)
     only=<A>|<B>    options page: show only the cards titled A, B (no header)
     hover=<row id>  scoresheet: draw the hover outline on that row, since a
                     headless browser has no mouse
2. Serve that folder on localhost and capture pages with headless Edge.
   The scoresheet renders at 960x555 CSS px with a 4/3 device scale (1280x740
   image) so the 11px PowerTeacher text is readable; a 60px caption bar sits
   above it. Settings cards are captured at their own width and trimmed to
   their content automatically (no hand-tuned pixel crops).
3. Compose the store images with PIL.

Why Edge: headless Chrome exits with code 21 on this machine (see _strategies.md).
"""
import functools
import http.server
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store"
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
PORT = 8766
FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_SEMIBOLD = "C:/Windows/Fonts/seguisb.ttf"
CAPTION_HEIGHT = 60
CAPTION_BG = "#1f3a5f"

# Settings presets. Missing keys fall back to the extension's defaults through
# PTPSettings.normalize, so "default" is empty. schemaVersion 2 = bands are
# already a ladder (band 1 starts at 0, each start = previous end).
STORAGE_SHIM = r"""
// Test-only stand-in for chrome.* so extension pages run over http.
(function () {
  const PRESETS = {
    default: null,
    bands: {
      schemaVersion: 2,
      assignmentBands: [
        { enabled: true, min: 0,  max: 60,   color: '#ff4d4d' },
        { enabled: true, min: 60, max: 70,   color: '#ff9800' },
        { enabled: true, min: 70, max: 80,   color: '#ffeb3b' },
        { enabled: true, min: 80, max: 90,   color: '#8bc34a' },
        { enabled: true, min: 90, max: null, color: '#4caf50' }
      ]
    },
    rows: { schemaVersion: 2, colorStrength: 45, rowDividers: 'both', lineDarkness: 30 },
    codes: { schemaVersion: 2, scoreCodes: [{ enabled: true, code: 'M', label: 'Medical', color: '#f48fb1' }] }
  };
  const params = new URLSearchParams(location.search);
  const listeners = [];
  const preset = PRESETS[params.get('preset') || 'default'];
  const store = preset ? { settings: preset } : {};
  window.chrome = {
    runtime: { getURL: p => p, openOptionsPage() {} },
    tabs: { create() {} },
    storage: {
      sync: {
        async get(key) { return { [key]: store[key] }; },
        async set(obj) { Object.assign(store, obj); listeners.forEach(fn => fn({}, 'sync')); }
      },
      onChanged: { addListener(fn) { listeners.push(fn); } }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Options page: keep only the named cards, so each can be shown on its own.
    const only = params.get('only');
    if (only) {
      const wanted = only.split('|');
      document.querySelector('.page-header')?.remove();
      document.querySelector('.actions')?.remove();
      document.querySelectorAll('main > section.card').forEach(card => {
        const title = card.querySelector('h2')?.textContent.trim();
        if (!wanted.includes(title)) card.remove();
      });
    }
    // Scoresheet: the same outline content.js draws on :hover, on one row.
    const hover = params.get('hover');
    if (hover) {
      const style = document.createElement('style');
      style.textContent = `html.ptp-row-hover tr#${hover} > td, html.ptp-row-hover tr#${hover} > th {
          box-shadow: inset 0 2px 0 #0b5cad, inset 0 -2px 0 #0b5cad !important; }
        html.ptp-row-hover tr#${hover} > th { background-color: rgba(11, 92, 173, 0.14) !important; }`;
      document.head.append(style);
    }
  });
})();
"""

# One store screenshot each: caption, scoresheet preset (+ optional hovered
# row), and the settings overlay that explains it.
SHOTS = [
    {
        "file": "screenshot-1-in-action.png",
        "caption": "Spot struggling students at a glance",
        "sheet": "preset=default",
        "overlay": ("popup.html?preset=default", 300, 640),
    },
    {
        "file": "screenshot-2-bands.png",
        "caption": "Set your own grade bands, lowest to highest",
        "sheet": "preset=bands",
        "overlay": ("options.html?preset=bands&only=Assignment highlights", 700, 900),
    },
    {
        "file": "screenshot-3-flags.png",
        "caption": "Clear flag letters and comment badges",
        "sheet": "preset=default",
        "overlay": ("options.html?preset=default&only=Flags", 600, 700),
    },
    {
        "file": "screenshot-4-rows.png",
        "caption": "Rows that are easy to follow",
        "sheet": "preset=rows&hover=std1007",
        "overlay": ("options.html?preset=rows&only=Rows %26 colors", 600, 600),
    },
    {
        "file": "screenshot-5-final-codes.png",
        "caption": "Course grades and special codes like M (Medical)",
        "sheet": "preset=codes",
        "overlay": ("options.html?preset=codes&only=Final grade|Score codes", 600, 800),
    },
]


def prepare_site(site: Path):
    shutil.copytree(ROOT / "extension", site)
    (site / "shim.js").write_text(STORAGE_SHIM, encoding="utf-8")
    for page in ("demo.html", "options.html", "popup.html"):
        path = site / page
        html = path.read_text(encoding="utf-8")
        path.write_text(html.replace('<script src="settings.js"></script>',
                                     '<script src="shim.js"></script>\n  <script src="settings.js"></script>', 1),
                        encoding="utf-8")


def serve(site: Path):
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):  # keep the console to the "wrote …" lines
            pass

    handler = functools.partial(QuietHandler, directory=str(site))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def shoot(shots: Path, name: str, url: str, width: int, height: int, scale: float) -> Image.Image:
    target = shots / f"{name}.png"
    profile = shots / f"profile-{name}"  # fresh profile per shot: no stale cached scripts
    subprocess.run([str(EDGE), "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    f"--force-device-scale-factor={scale}", f"--user-data-dir={profile}",
                    f"--window-size={width},{height}", "--virtual-time-budget=5000",
                    f"--screenshot={target}", f"http://127.0.0.1:{PORT}/{url.replace(' ', '%20')}"],
                   check=True, capture_output=True)
    return Image.open(target).convert("RGBA")


def trim(image: Image.Image, pad: int = 10) -> Image.Image:
    """Crops away the page background around the content (corner pixel = background)."""
    background = Image.new("RGBA", image.size, image.getpixel((0, 0)))
    box = ImageChops.difference(image, background).convert("L").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not box:
        return image
    left, top, right, bottom = box
    return image.crop((max(0, left - pad), max(0, top - pad), min(image.width, right + pad), min(image.height, bottom + pad)))


def float_window(base: Image.Image, window: Image.Image, x: int, y: int) -> Image.Image:
    """Pastes a capture over the base like a floating window, with a shadow."""
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([x + 4, y + 8, x + window.width + 4, y + window.height + 8], fill=(0, 0, 0, 120))
    base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(12)))
    base.paste(window, (x, y))
    ImageDraw.Draw(base).rectangle([x, y, x + window.width - 1, y + window.height - 1], outline="#9aa5b1")
    return base


def compose(sheet: Image.Image, overlay: Image.Image, caption: str) -> Image.Image:
    canvas = Image.new("RGBA", (1280, 800), "white")
    canvas.paste(sheet.crop((0, 0, 1280, 800 - CAPTION_HEIGHT)), (0, CAPTION_HEIGHT))

    # Keep the overlay inside the area below the caption, shrinking it if needed.
    # 620px wide at most, so the names, course grade and a few assignment
    # columns always stay visible beside it.
    max_w, max_h = 620, 800 - CAPTION_HEIGHT - 40
    ratio = min(1.0, max_w / overlay.width, max_h / overlay.height)
    if ratio < 1:
        overlay = overlay.resize((int(overlay.width * ratio), int(overlay.height * ratio)), Image.LANCZOS)
    canvas = float_window(canvas, overlay, 1280 - overlay.width - 24, CAPTION_HEIGHT + 20)

    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, 0, 1280, CAPTION_HEIGHT], fill=CAPTION_BG)
    draw.text((24, CAPTION_HEIGHT // 2), caption, font=ImageFont.truetype(FONT_SEMIBOLD, 28), fill="white", anchor="lm")
    draw.text((1256, CAPTION_HEIGHT // 2), "Gradebook Enhancer", font=ImageFont.truetype(FONT, 16), fill="#cfe0f3", anchor="rm")
    return canvas


def save(image: Image.Image, name: str):
    image.convert("RGB").save(OUT / name)  # store wants 24-bit images, no alpha
    print("wrote", name)


def main():
    if not EDGE.exists():
        sys.exit(f"Edge not found at {EDGE}")
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("screenshot-*.png"):  # names change as shots are added or removed
        old.unlink()

    scale = 4 / 3
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp:
        site, shots = Path(temp) / "site", Path(temp) / "shots"
        shots.mkdir()
        prepare_site(site)
        server = serve(site)
        try:
            for index, shot in enumerate(SHOTS, start=1):
                sheet = shoot(shots, f"sheet-{index}", f"demo.html?shot&{shot['sheet']}", 960, 555, scale)
                url, width, height = shot["overlay"]
                # Settings at the same 4/3 scale as the scoresheet, so text sizes match.
                overlay = trim(shoot(shots, f"overlay-{index}", url, width, height, scale))
                save(compose(sheet, overlay, shot["caption"]), shot["file"])
        finally:
            server.shutdown()

    # Small promo tile.
    tile = Image.new("RGB", (440, 280), "#1f3a5f")
    icon = Image.open(ROOT / "extension" / "icons" / "icon128.png").convert("RGBA").resize((112, 112), Image.LANCZOS)
    tile.paste(icon, (28, 84), icon)
    draw = ImageDraw.Draw(tile)
    draw.text((160, 88), "Gradebook", font=ImageFont.truetype(FONT_BOLD, 34), fill="white")
    draw.text((160, 128), "Enhancer", font=ImageFont.truetype(FONT_BOLD, 34), fill="white")
    draw.text((162, 176), "for PowerTeacher Pro", font=ImageFont.truetype(FONT, 18), fill="#cfe0f3")
    save(tile, "promo-small-440x280.png")


if __name__ == "__main__":
    main()
