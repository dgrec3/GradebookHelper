# PowerSchool Enhancer — Feature List (v2.0)

Goal: turn the hard-coded GradebookHelper (v1.2.1) into a fully customizable
extension, building toward a Chrome Web Store release.

Status legend: ☐ planned · ◐ in progress · ☑ done · ❓ needs live-DOM check

---

## 1. Customizable highlight bands (assignments)
- ☑ Colors are chosen from a 16-color palette (`color-picker.js`, shared with score codes), with "More colors…" for the full picker.
- ☑ Band editor (2026-11-10): bands form a ladder, lowest first. Band 1 starts at 0; each start is the previous end (read-only, auto-filled); only the ends are typed; the last can be "and up". Switch a band off to leave its range uncolored. Also: "From X% up to, but not including, Y%" wording, a "Covers …" line, the preview box showing the highest whole score in the band, a 0–100% bar, and per-row warnings. Schema 2; older saves are converted by `toLadder`.
- ☑ Flexible list of bands; teacher can add, remove, reorder, enable/disable each.
- ☑ Each band: **min %**, **max %** (blank = no upper limit), **color**.
- ☑ Defaults (2026-11-10): `0–70 → red #ff4d4d`, `70–80 → yellow #ffeb3b`, `80+ → green #4caf50`.
- **Algorithm:**
  - percent = score ÷ points possible × 100 (points come from the existing XHR interceptor).
  - A band matches when `min ≤ percent < max` (min inclusive, max exclusive), so 70 is yellow and 69.99 is red, exactly as today.
  - Bands are checked top-to-bottom; the **first match wins**. The options page warns about overlaps and gaps but allows them.
  - Scores over 100% (extra credit) are handled normally, so a "≥ 100 → green" band works.

## 2. Final grade column
- ☑ Toggle: **Include final grade** (default on; a missing saved value takes the default, an explicit choice is kept).
- ☑ Sub-toggle: **Use the same bands as assignments** (default on).
  - When it's turned off, the final grade gets its own band list, pre-filled with a copy of the assignment bands.
- ☑ Selector `td.final-grade-info-cell`; percent read from `.final-grade-info .percent`.

## 3. Flag colors (removed 2026-11-10)
- ~~Exempt / Missing / Incomplete / Absent / Late each with a toggle and color.~~ Removed: the text flag tags (8b) show flags more clearly than colors did. Flags never change a cell's color now.

## 3b. Score codes
- ☑ Editable list: code text, label, color, toggle (max 20). Pre-filled with `M` = Medical (off).
- ☑ Matches the cell's displayed text (assignment score / final letter grade), case-insensitive.
- **Precedence:** score code > score band (one color per cell).
- ☑ Medical (M) can only be entered in the course grade cell (confirmed by the user).

## 3c. Split highlighting (removed 2026-11-10)
- ~~Cells meeting several conditions split into 2–3 colored stripes.~~ Removed together with flag colors: with only bands and score codes left, a cell never needs more than one color.

## 4. Readability
- ☑ Text color is picked automatically (black or white) from the background's luminance (WCAG relative-luminance formula, threshold ≈ 0.179).

## 5. Settings UI
- ☑ **Toolbar popup** (quick): master on/off, Include final grade, the special-code toggles, "Open full settings" link.
- ☑ **Options page** (full): band editors (assignments + final grade), special-code colors, live preview swatches, overlap/gap warnings, Reset to defaults.
- ☑ Changes apply **instantly** to open gradebook tabs (via `chrome.storage.onChanged`, no reload).

## 6. Storage
- ☑ `chrome.storage.sync`: settings follow the teacher across their Chrome profiles (well under the 8 KB/item quota).
- ☑ Settings carry a `schemaVersion` with a migration function for future upgrades.
- ☑ Invalid or corrupt stored values fall back to defaults instead of breaking highlighting.

## 7. Performance (keep v1.2 safeguards)
- ☑ Keep the duplicate-load guard, CSS classes (not inline styles), debounced rescans, and relevance-filtered MutationObserver.
- ☑ One static `<style>` tag; each highlighted cell gets class `ptp-hl` plus `--ptp-bg/--ptp-fg/--ptp-shadow` variables (since 1.0).

## 8. Chrome Web Store readiness
- ☑ Narrow host permissions to the gradebook pages only. Permissions: `storage` only.
- ☑ Icons (16/32/48/128), store screenshots, description (`store/`, drawn by `tools/make_icons.py` and `tools/make_store_images.py`).
- ☑ Privacy policy (`PRIVACY.md`): no data leaves the browser; grades are read locally only.
- ☑ Review for single-purpose policy and remote-code rules (none used); see `STORE_REVIEW.md`.
- ☑ Store-safe name "Gradebook Enhancer for PowerTeacher Pro" plus non-affiliation lines.
- ☑ Minimal data relay: injected.js passes only assignment ID → points.
- ☑ Upload zip built by `tools/package.py` (forward-slash paths; refuses `_`/`.` files).

## 8b. Text flag tags
- ☑ Setting `flagTags` (default on; missing in old settings → on). Toggles in options (Flags card) and popup.
- ☑ CSS only, via class `ptp-flag-tags` on `<html>`: each visible flag span loses its square and shows its `tag` text (from `FLAG_DEFINITIONS`) through `::before`.
- ☑ `span.flag-container` becomes a fixed 2×2 grid of 8px slots on the left edge (`FLAG_SLOTS`): Missing top-left, Incomplete top-right, Late bottom-left, Absent bottom-right. Columns are a fixed 8px so empty slots stay open (word mode uses max-content columns). Exempt (outside the container) is centered on the left edge.
- ☑ Independent of flag colors and split highlighting; off when highlighting is off.
- Known limit: Exempt together with other flags can overlap the grid (rare: Exempt usually has a blank score).

## 8c. Row tracking & color strength
- ☑ `colorStrength` (30–100, default 70): `--ptp-bg` uses `rgba()` via `PTPSettings.withStrength`; text contrast via `blendOverWhite` + `contrastTextColor`; swatches via `paintSwatch`.
- ☑ `rowHover` (default on): `html.ptp-row-hover table.gridTable tr[id^="std"]:hover` cells get inset top/bottom box-shadows; the name cell gets a light blue tint.
- ☑ `rowDividers`: off / every / five / both (default every).
- ☑ `lineDarkness` (10–40, default 18): `--ptp-line` on `<html>`; every-5 line = 2.5× (max 0.85). Uses classes `ptp-row-lines` and `ptp-row-fives` (`:nth-child(5n)`).
- ☑ `flagTagStyle`: filled (default) / outlined.
- ☑ `flagTagLength`: letter (default; `FLAG_DEFINITIONS[].letter`, 9px, one row) / word (`.tag`, 7px, two per column) via class `ptp-flag-tags-word`.
- ☑ `commentBadge` (default on): class `ptp-comment-badge` on `<html>`. `span.ps-notes-flag:not(.ng-hide)` gets a white background, `opacity: 1`, and a white-then-navy ring shadow.

## 9. Demo page (shipped, unlinked: for reviewers, testing and screenshots)
- ☑ Looks like PowerTeacher Pro's scoresheet (measured styles; made-up class); `?shot` hides the banner for screenshots.
- ☑ Store screenshots: `py tools/make_screenshots.py` (settings presets default / bands / all via a test-only storage shim).
- ☑ `demo.html` + `demo.js` + `demo-data.json`: 19 made-up students and 5 assignments in PowerTeacher Pro markup (same td classes, `var` scores, flag icons with `ng-hide`, final-grade `.grade`/`.percent`).
- ☑ Loads its data with a real XHR, so it goes through injected.js → points relay → content.js exactly like PowerTeacher.
- ☑ Uses the teacher's saved settings and updates live; a "Turn on all highlight types" button enables final grade, every flag and every score code.
- ☑ `CHANGELOG.md`, `_handoff.md`, `STRATEGIES_THAT_WONT_WORK.md`.
