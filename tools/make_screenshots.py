"""Builds the Chrome Web Store screenshots (1280x800) and small promo tile.

Pipeline (one command: py tools/make_screenshots.py):
1. Copy extension/ to a temp folder and add a test-only chrome.* stand-in
   (STORAGE_SHIM) before settings.js, so extension pages run over plain http.
   ?preset=<name> picks the saved settings for a shot.
2. Serve that folder on localhost and capture pages with headless Edge.
   Pages are rendered at 960x600 CSS px with a 4/3 device scale, so the image is
   1280x800 but the 11px PowerTeacher text is readable in the store.
3. Compose the store images with PIL.

Why the demo page: it recreates PowerTeacher's scoresheet with made-up
students, so screenshots never contain real student data.
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

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store"
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
PORT = 8766
FONT = "C:/Windows/Fonts/segoeui.ttf"
FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"

# Settings presets for the shots. Missing keys fall back to the extension's
# defaults through PTPSettings.normalize, so "default" is simply empty.
STORAGE_SHIM = r"""
// Test-only stand-in for chrome.* so extension pages run over http.
(function () {
  const PRESETS = {
    default: null,
    bands: {
      assignmentBands: [
        { enabled: true, min: null, max: 60, color: '#ff4d4d' },
        { enabled: true, min: 60, max: 70, color: '#ff9800' },
        { enabled: true, min: 70, max: 80, color: '#ffeb3b' },
        { enabled: true, min: 90, max: null, color: '#4caf50' }
      ],
      finalGrade: { include: true, useAssignmentBands: true }
    },
    all: {
      finalGrade: { include: true, useAssignmentBands: true },
      scoreCodes: [{ enabled: true, code: 'M', label: 'Medical', color: '#f48fb1' }]
    }
  };
  const listeners = [];
  const preset = PRESETS[new URLSearchParams(location.search).get('preset') || 'default'];
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
})();
"""


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
                    f"--screenshot={target}", f"http://127.0.0.1:{PORT}/{url}"],
                   check=True, capture_output=True)
    return Image.open(target).convert("RGBA")


def float_window(base: Image.Image, window: Image.Image, x: int, y: int) -> Image.Image:
    """Pastes a page capture over the base like a floating window, with a shadow."""
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([x + 4, y + 8, x + window.width + 4, y + window.height + 8], fill=(0, 0, 0, 120))
    base = Image.alpha_composite(base, shadow.filter(ImageFilter.GaussianBlur(12)))
    base.paste(window, (x, y))
    ImageDraw.Draw(base).rectangle([x, y, x + window.width - 1, y + window.height - 1], outline="#9aa5b1")
    return base


def save(image: Image.Image, name: str):
    image.convert("RGB").save(OUT / name)  # store wants 24-bit images, no alpha
    print("wrote", name)


def main():
    if not EDGE.exists():
        sys.exit(f"Edge not found at {EDGE}")
    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp:
        site, shots = Path(temp) / "site", Path(temp) / "shots"
        shots.mkdir()
        prepare_site(site)
        server = serve(site)
        try:
            scale = 4 / 3
            in_action = shoot(shots, "in-action", "demo.html?shot&preset=default", 960, 600, scale)
            bands = shoot(shots, "bands", "demo.html?shot&preset=bands", 960, 600, scale)
            flags = shoot(shots, "flags", "demo.html?shot&preset=all", 960, 600, scale)
            options = shoot(shots, "options", "options.html?preset=all", 720, 1100, 1)
        finally:
            server.shutdown()

    save(in_action, "screenshot-1-in-action.png")
    save(bands, "screenshot-2-bands.png")
    save(flags, "screenshot-3-flags.png")

    # 4: settings page floating over the right side of the default scoresheet,
    # cropped to the "Rows & colors" and "Assignment highlights" cards (range
    # bar, wording, example scores) so no card is cut in half.
    # Captured 720px wide so band rows don't wrap; y 156–874 holds both cards.
    settings_window = options.crop((0, 156, 720, 874))
    save(float_window(in_action.copy(), settings_window, 1280 - 720 - 28, 36), "screenshot-4-settings.png")

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
