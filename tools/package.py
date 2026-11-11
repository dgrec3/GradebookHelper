r"""Builds the Chrome Web Store upload: dist/gradebook-enhancer-<version>.zip

Why Python instead of PowerShell's Compress-Archive: Windows PowerShell 5.1
can write zip entries with backslashes (icons\icon16.png), which the Chrome
Web Store can't resolve. zipfile always writes forward slashes.
Run: py tools/package.py
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "extension"
DIST = ROOT / "dist"

manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
version = manifest["version"]

# Chrome refuses to load packages with files starting with "_" (see
# STRATEGIES_THAT_WONT_WORK.md); fail early instead of at upload time.
files = sorted(p for p in SOURCE.rglob("*") if p.is_file())
bad = [p.name for p in files if p.name.startswith("_") or p.name.startswith(".")]
if bad:
    raise SystemExit(f"Refusing to package files Chrome rejects: {bad}")

DIST.mkdir(exist_ok=True)
target = DIST / f"gradebook-enhancer-{version}.zip"
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in files:
        # manifest.json must sit at the zip root, so paths are relative to extension/.
        archive.write(path, path.relative_to(SOURCE).as_posix())

print(f"{target.relative_to(ROOT)}  ({len(files)} files, {target.stat().st_size // 1024} KB)")
