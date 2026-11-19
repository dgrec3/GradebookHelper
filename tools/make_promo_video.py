"""Builds Instagram Reels (1080x1920, 30 fps, H.264 + AAC) for the extension.

Two cuts share the same building blocks:
  15 s  before/after teaser          -> dist/promo-reel-15s.mp4
  45 s  full feature tour            -> dist/promo-reel-45s.mp4

45-second story (seconds):
  0-3.5     plain scoresheet: "Which students need help?"
  3.5-5     colors wipe in
  5-8.5     colored sheet + toolbar popup
  8.5-13    custom grade bands + band editor
  13-17     course grade column + Final grade card
  17-21     flag letters + Flags card
  21-24.5   flag words (MISS, LATE...)
  24.5-28   comment badges
  28-32     score codes (M = Medical) + Score codes card
  32-36.5   row lines and hover outline + Rows & colors card
  36.5-40.5 live recolor: a 6 is changed to 10 and turns green
  40.5-42.5 privacy
  42.5-45   end card (app icon, store, DG EdTech Tools logo)

Why frames + ffmpeg instead of a screen recording: every frame comes from the
real demo page (made-up class, FERPA-safe) running the real extension code,
so the result is exact and reproducible. Music is synthesized in numpy, so
there is nothing to license.

Optional: tools/promo/logo.png (round, transparent PNG) goes on the end card.

Run: py tools/make_promo_video.py [15|45]   (default: both lengths)
Writes promo-reel-<n>s-silent.mp4 (add music in Instagram/Canva) and
promo-reel-<n>s.mp4 (with the track from promo_music.py).
Needs: py -m pip install --user imageio-ffmpeg
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import make_screenshots as shots_tool  # reuse the demo site, shim and Edge capture
import promo_music  # the synthesized music bed

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
LOGO = Path(__file__).resolve().parent / "promo" / "logo.png"
W, H, FPS = 1080, 1920, 30
NAVY, LIGHT, GOLD = (31, 58, 95), (207, 224, 243), (255, 210, 63)
FONT_BOLD, FONT, FONT_SEMI = shots_tool.FONT_BOLD, shots_tool.FONT, shots_tool.FONT_SEMIBOLD

# Extra presets for the video, added to the screenshot shim's PRESETS.
# "off" = the extension switched fully off: what a teacher sees today.
EXTRA_PRESETS = """
    off: { schemaVersion: 2, enabled: false, flagTags: false, commentBadge: false, rowDividers: 'off', rowHover: false },
    words: { schemaVersion: 2, flagTagLength: 'word' },
"""
# ?edit: after the sheet is built, change Owen Bennett's HW 3.1 score from 6 to 10
# the way Angular does (text swap), so the real content.js recolors it.
EDIT_SHIM = """
if (new URLSearchParams(location.search).has('edit')) {
  window.addEventListener('load', () => setTimeout(() => {
    const v = document.querySelector('tr#std1001 td.score-assignment-col a.keypad-link > var');
    if (v) v.textContent = '10';
  }, 1500));
}
"""

# Scoresheet capture: 780 x 545 CSS px at 2x shows names, course grade and
# about 3.5 assignment columns, which reads well in a phone-width frame.
SHEET_CSS, SCALE = (780, 545), 2
SHEETS = {"off": "preset=off", "default": "preset=default", "bands": "preset=bands", "words": "preset=words",
          "codes": "preset=codes", "rows": "preset=rows&hover=std1007", "edited": "preset=default&edit"}
# Settings cards / popup shown under the sheet: (url, css width, css height).
PANELS = {
    "popup": ("popup.html?preset=default", 300, 640),
    "bands": ("options.html?preset=bands&only=Assignment highlights", 600, 900),
    "final": ("options.html?preset=default&only=Final grade", 600, 600),
    "flags": ("options.html?preset=default&only=Flags", 600, 700),
    "codes": ("options.html?preset=codes&only=Score codes", 600, 500),
    "rows": ("options.html?preset=rows&only=Rows %26 colors", 600, 600),
}


def capture(temp: Path):
    site, shots = temp / "site", temp / "shots"
    shots.mkdir()
    shots_tool.prepare_site(site)
    shim = site / "shim.js"
    text = shim.read_text(encoding="utf-8").replace("default: null,", "default: null," + EXTRA_PRESETS, 1)
    shim.write_text(text + EDIT_SHIM, encoding="utf-8")
    server = shots_tool.serve(site)
    try:
        sheets = {k: shots_tool.shoot(shots, f"sheet-{k}", f"demo.html?shot&{q}", *SHEET_CSS, SCALE)
                  for k, q in SHEETS.items()}
        panels = {k: shots_tool.trim(shots_tool.shoot(shots, f"panel-{k}", url, w, h, SCALE))
                  for k, (url, w, h) in PANELS.items()}
    finally:
        server.shutdown()
    return sheets, panels


# ---------- drawing helpers ----------

def ease(t: float) -> float:
    """Smooth 0..1 ease-in-out so motion doesn't start or stop abruptly."""
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def fade(t, start, end, edge=0.35):
    """Opacity for something visible from start to end, with soft edges."""
    return min(ease((t - start) / edge), ease((end - t) / edge))


_BG = None


def background() -> Image.Image:
    """Navy vertical gradient behind everything (built once, copied per frame)."""
    global _BG
    if _BG is None:
        top, bottom = np.array(NAVY, float), np.array((12, 28, 50), float)
        ramp = np.linspace(0, 1, H)[:, None, None]
        rows = (top * (1 - ramp) + bottom * ramp).astype(np.uint8)
        _BG = Image.fromarray(np.broadcast_to(rows, (H, W, 3)).copy(), "RGB").convert("RGBA")
    return _BG.copy()


def rounded(image: Image.Image, radius=28) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, image.width - 1, image.height - 1], radius=radius, fill=255)
    image = image.copy()
    image.putalpha(mask)
    return image


def card(sheet: Image.Image, zoom: float = 1.0, focus=(0.5, 0.5)) -> Image.Image:
    """The scoresheet as a rounded card, optionally zoomed toward a focus point (fractions)."""
    if zoom > 1.0:
        cw, ch = sheet.width / zoom, sheet.height / zoom
        left = min(max(0, focus[0] * sheet.width - cw / 2), sheet.width - cw)
        top = min(max(0, focus[1] * sheet.height - ch / 2), sheet.height - ch)
        sheet = sheet.crop((int(left), int(top), int(left + cw), int(top + ch))).resize(sheet.size, Image.LANCZOS)
    width = W - 80
    return rounded(sheet.resize((width, int(sheet.height * width / sheet.width)), Image.LANCZOS))


def place(frame: Image.Image, image: Image.Image, y: int, alpha: float = 1.0, dy: int = 0):
    """Centers an image with a soft shadow; alpha/dy animate it in."""
    if alpha <= 0:
        return
    x, y = (W - image.width) // 2, y + dy
    shadow = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x + 6, y + 16, x + image.width + 6, y + image.height + 16],
                                             radius=28, fill=(0, 0, 0, int(150 * alpha)))
    frame.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))
    if alpha < 1:
        image = image.copy()
        image.putalpha(image.getchannel("A").point(lambda v: int(v * alpha)))
    frame.alpha_composite(image, (x, y))


def text(frame: Image.Image, lines, alpha: float, y: int, size: int, color=(255, 255, 255), path=FONT_BOLD):
    """Centered lines of text; alpha fades and slides them in."""
    if alpha <= 0:
        return
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    f = ImageFont.truetype(path, size)
    offset = int((1 - alpha) * 30)
    for i, line in enumerate(lines):
        draw.text((W // 2, y + offset + i * int(size * 1.2)), line, font=f, anchor="mm", fill=(*color, int(255 * alpha)))
    frame.alpha_composite(layer)


def headline(frame, lines, alpha):
    text(frame, lines, alpha, 170, 76)


def subline(frame, lines, alpha, y=1290):
    text(frame, lines, alpha, y, 48, LIGHT)


def brand_bar(frame):
    text(frame, ["Gradebook Enhancer for PowerTeacher Pro"], 1.0, H - 110, 38, LIGHT, FONT_SEMI)


def panel_image(panel: Image.Image, max_w=900, max_h=560) -> Image.Image:
    """A settings card at a readable size. Tall cards (band editor, popup) are
    not shrunk to fit; the top part is shown and fades out at the cut, because
    a whole tall card scaled into the frame is too small to read on a phone."""
    ratio = min(max_w / panel.width, 1.25)
    panel = panel.resize((int(panel.width * ratio), int(panel.height * ratio)), Image.LANCZOS).convert("RGBA")
    if panel.height > max_h:
        panel = panel.crop((0, 0, panel.width, max_h))
        fade_px = 90
        alpha = np.full((max_h, panel.width), 255, np.uint8)
        alpha[-fade_px:] = np.linspace(255, 0, fade_px, dtype=np.uint8)[:, None]
        image = rounded(panel, 20)
        image.putalpha(Image.fromarray(np.minimum(np.array(image.getchannel("A")), alpha)))
        return image
    return rounded(panel, 20)


# ---------- scenes ----------
# Each scene is (start, end, draw(frame, t, local_t, assets)). SHEET_Y is where
# the scoresheet card sits; a settings panel slides in under it.
SHEET_Y = 430
PANEL_Y = 1190


def sheet_scene(name, title, sub=None, panel=None, zoom=None, focus=(0.5, 0.5)):
    """Most scenes: a headline, the sheet (optionally zooming in), and a sub-line or settings panel."""
    def draw(frame, t, lt, length, a):
        z = 1.0 if zoom is None else 1.0 + (zoom - 1.0) * ease(lt / 1.0)
        place(frame, card(a["sheets"][name], z, focus), SHEET_Y)
        headline(frame, title, fade(lt, 0.15, length))
        if panel:
            p = ease((lt - 0.4) / 0.5)
            place(frame, a["panels"][panel], PANEL_Y, p, int((1 - p) * 60))
        elif sub:
            subline(frame, sub, fade(lt, 0.5, length))
    return draw


def wipe_scene(frame, t, lt, length, a):
    before, after = card(a["sheets"]["off"]), card(a["sheets"]["default"])
    cut = int(after.width * ease(lt / (length - 0.2)))
    mixed = before.copy()
    mixed.paste(after.crop((0, 0, cut, after.height)), (0, 0))
    mixed.putalpha(after.getchannel("A"))
    place(frame, mixed, SHEET_Y)
    x = (W - after.width) // 2 + cut
    if 0 < cut < after.width:  # bright wipe edge
        ImageDraw.Draw(frame).rectangle([x - 3, SHEET_Y, x + 3, SHEET_Y + after.height], fill=GOLD)
    headline(frame, ["Now you see it", "instantly."], ease((lt - 0.7) / 0.5))


def live_edit_scene(frame, t, lt, length, a):
    """Owen's HW 3.1: 6 (red) -> typed 10 -> green, zoomed on that cell."""
    focus, zoom = (0.60, 0.40), 2.2
    z = 1.0 + (zoom - 1.0) * ease(lt / 0.8)
    sheet = a["sheets"]["edited" if lt >= 1.6 else "default"]
    place(frame, card(sheet, z, focus), SHEET_Y)
    headline(frame, ["Change a grade,", "the color follows"], fade(lt, 0.15, length))
    subline(frame, ["6 → 10: red turns green", "right away, no reload"], fade(lt, 1.7, length))


def privacy_scene(frame, t, lt, length, a):
    icon = a["icon"].resize((300, 300), Image.LANCZOS)
    place(frame, rounded(icon, 60), 420, ease(lt / 0.4))
    text(frame, ["Private by design"], ease((lt - 0.1) / 0.4), 900, 80)
    text(frame, ["Runs only in your browser.", "No student data is collected", "or sent anywhere."],
         ease((lt - 0.3) / 0.4), 1080, 50, LIGHT)


def end_scene(frame, t, lt, length, a):
    a_in = ease(lt / 0.5)
    size = int(360 * (0.8 + 0.2 * ease(lt / 0.4)))
    big = a["icon"].resize((size, size), Image.LANCZOS)
    big.putalpha(big.getchannel("A").point(lambda v: int(v * a_in)))
    frame.alpha_composite(big, ((W - size) // 2, 520 - size // 2))
    text(frame, ["Gradebook Enhancer"], ease((lt - 0.2) / 0.4), 820, 86)
    text(frame, ["for PowerTeacher Pro"], ease((lt - 0.3) / 0.4), 920, 52, LIGHT)
    text(frame, ["Free on the", "Chrome Web Store"], ease((lt - 0.6) / 0.4), 1130, 72, GOLD)
    if a["logo"] is not None:
        lg = a["logo"].copy()
        lg.thumbnail((300, 300), Image.LANCZOS)  # round DG EdTech Tools badge
        lg.putalpha(lg.getchannel("A").point(lambda v: int(v * ease((lt - 0.9) / 0.4))))
        frame.alpha_composite(lg, ((W - lg.width) // 2, 1320))
    text(frame, ["Made by a teacher, for teachers"], ease((lt - 0.9) / 0.4), 1720, 40, LIGHT)
    text(frame, ["Not affiliated with PowerSchool"], ease((lt - 0.9) / 0.4), 1800, 30, (150, 170, 195))


BEFORE = sheet_scene("off", ["Which students", "need help?"], ["Rows and rows of plain numbers…"])

CUTS = {
    15: [
        (0.0, 3.5, BEFORE),
        (3.5, 5.0, wipe_scene),
        (5.0, 8.0, sheet_scene("default", ["Now you see it", "instantly."],
                               ["Red, yellow, green:", "struggling students stand out"])),
        (8.0, 11.0, sheet_scene("default", ["Missing, late &", "comments pop out"],
                                ["Clear letters instead of", "tiny colored squares"], zoom=1.9, focus=(0.58, 0.78))),
        (11.0, 12.5, sheet_scene("bands", ["Your bands.", "Your colors."], ["Set your own thresholds", "in seconds"])),
        (12.5, 15.0, end_scene),
    ],
    45: [
        (0.0, 3.5, BEFORE),
        (3.5, 5.0, wipe_scene),
        (5.0, 8.5, sheet_scene("default", ["Now you see it", "instantly."], panel="popup")),
        (8.5, 13.0, sheet_scene("bands", ["Your grade bands.", "Your colors."], panel="bands")),
        (13.0, 17.0, sheet_scene("default", ["Course grades", "too"], panel="final", zoom=1.7, focus=(0.42, 0.55))),
        (17.0, 21.0, sheet_scene("default", ["Flags become", "clear letters"], panel="flags", zoom=1.9, focus=(0.66, 0.62))),
        (21.0, 24.5, sheet_scene("words", ["…or short", "words"], ["MISS · LATE · INC · ABS · EXC"],
                                 zoom=1.9, focus=(0.66, 0.62))),
        (24.5, 28.0, sheet_scene("default", ["Comments you", "won't miss"],
                                 ["A clear badge, even", "on colored cells"], zoom=2.3, focus=(0.75, 0.80))),
        (28.0, 32.0, sheet_scene("codes", ["Special codes like", "M (Medical)"], panel="codes", zoom=1.7, focus=(0.40, 0.64))),
        (32.0, 36.5, sheet_scene("rows", ["Never lose", "your row"], panel="rows")),
        (36.5, 40.5, live_edit_scene),
        (40.5, 42.5, privacy_scene),
        (42.5, 45.0, end_scene),
    ],
}

CROSSFADE = 0.3  # seconds of blend into each new scene (except the wipe, which is its own transition)


def render(cut, t: float, assets) -> Image.Image:
    for index, (start, end, draw) in enumerate(cut):
        if start <= t < end or index == len(cut) - 1:
            frame = background()
            draw(frame, t, t - start, end - start, assets)
            if draw not in (end_scene, privacy_scene):
                brand_bar(frame)
            if index > 0 and t - start < CROSSFADE and draw is not wipe_scene:
                previous = render(cut, start - 1 / FPS, assets)
                frame = Image.blend(previous, frame, ease((t - start) / CROSSFADE))
            return frame
    raise ValueError(t)


# ---------- main ----------

# Music cues per cut: drop = color wipe; breakdown = drums out; outro = end-card hit.
MUSIC_CUES = {15: {"drop": 3.5, "breakdown": None, "outro": 12.5},
              45: {"drop": 3.5, "breakdown": (40.5, 42.5), "outro": 42.5}}


def build(seconds: int, assets, temp: Path):
    """Writes a silent video (for Instagram's own music library) and a copy with
    the synthesized track from promo_music.py. Frames are rendered once; the
    music copy only re-muxes the same video stream with audio."""
    cut, ffmpeg = CUTS[seconds], imageio_ffmpeg.get_ffmpeg_exe()
    silent = DIST / f"promo-reel-{seconds}s-silent.mp4"
    proc = subprocess.Popen([ffmpeg, "-y", "-loglevel", "error",
                             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                             "-movflags", "+faststart", str(silent)],
                            stdin=subprocess.PIPE)
    # Frames go straight to ffmpeg as raw RGB: no thousands of PNGs on disk.
    for i in range(int(seconds * FPS)):
        proc.stdin.write(render(cut, i / FPS, assets).convert("RGB").tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit("ffmpeg failed")

    audio = temp / f"music-{seconds}.wav"
    promo_music.render_music(audio, seconds, **MUSIC_CUES[seconds])
    with_music = DIST / f"promo-reel-{seconds}s.mp4"
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(silent), "-i", str(audio),
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart",
                    str(with_music)], check=True)

    # One preview still from the middle of each scene, for checking without playing.
    for start, end, _ in cut:
        mid = (start + end) / 2
        render(cut, mid, assets).convert("RGB").save(DIST / f"promo-{seconds}s-frame-{mid:05.2f}.png")
    print("wrote", silent.name, "and", with_music.name)


def main():
    lengths = [int(a) for a in sys.argv[1:] if a.isdigit()] or [15, 45]
    DIST.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp:
        temp = Path(temp)
        sheets, panels = capture(temp)
        assets = {
            "sheets": sheets,
            "panels": {k: panel_image(v) for k, v in panels.items()},
            "icon": __import__("make_icons").draw(True),  # 512 px app icon art with the DG badge
            "logo": Image.open(LOGO).convert("RGBA") if LOGO.exists() else None,
        }
        for seconds in lengths:
            build(seconds, assets, temp)


if __name__ == "__main__":
    main()
