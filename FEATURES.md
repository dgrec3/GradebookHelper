# PowerSchool Enhancer — Feature List (v2.0)

Goal: turn the hard-coded GradebookHelper (v1.2.1) into a fully customizable
extension, building toward a Chrome Web Store release.

Status legend: ☐ planned · ◐ in progress · ☑ done · ❓ needs live-DOM check

---

## 1. Customizable highlight bands (assignments)
- ☑ Flexible list of bands; teacher can add, remove, reorder, enable/disable each.
- ☑ Each band: **min %**, **max %** (blank = no upper limit), **color**.
- ☑ Defaults reproduce today's behavior: `0–70 → red #ff4d4d`, `70–80 → yellow #ffeb3b`.
- **Algorithm:**
  - percent = score ÷ points possible × 100 (points come from the existing XHR interceptor).
  - A band matches when `min ≤ percent < max` (min inclusive, max exclusive), so 70 is yellow and 69.99 is red, exactly as today.
  - Bands are checked top-to-bottom; the **first match wins**. The options page warns about overlaps and gaps but allows them.
  - Scores over 100% (extra credit) are handled normally, so a "≥ 100 → green" band works.

## 2. Final grade column
- ☑ Toggle: **Include final grade** (default off).
- ☑ Sub-toggle: **Use the same bands as assignments** (default on).
  - When it's turned off, the final grade gets its own band list, pre-filled with a copy of the assignment bands.
- ☑ Selector `td.final-grade-info-cell`; percent read from `.final-grade-info .percent`.

## 3. Special score codes (each with toggle + color)
- ☑ **Exempt**, **Missing**, **Incomplete**, **Absent**, **Late** (Medical: see note below). Each gets its own enable toggle and color picker. Colors can repeat.
- ☑ Default: all off. Suggested starting colors are preset.
- **Precedence:** if a cell has an enabled code flag, the code color wins over the score band (e.g. a Missing 0 shows the Missing color, not red).
- ☑ Flags detected as visible (`:not(.ng-hide)`) icon spans. Absent and Late added. Medical is not a flag; it's score code `M` (see section 3b).
- ☑ Non-numeric or blank scores with no enabled code stay uncolored, as today.

## 3b. Score codes
- ☑ Editable list: code text, label, color, toggle (max 20). Pre-filled with `M` = Medical (off).
- ☑ Matches the cell's displayed text (assignment score / final letter grade), case-insensitive.
- **Precedence:** score code > flag > score band.
- ☐ Verify an `M` entered on an assignment shows as text "M".

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
- ☑ CSS is regenerated into one `<style>` tag when settings change. Each band or code gets a class (`ptp-a-<n>`, `ptp-f-<n>`, `ptp-flag-<key>`).

## 8. Chrome Web Store readiness (later phase)
- ☑ Narrow host permissions to the gradebook pages only. Permissions: `storage` only.
- ☐ Icons (16/32/48/128), store screenshots, description.
- ☐ Privacy policy: no data leaves the browser; grades are read locally only.
- ☐ Review for single-purpose policy and remote-code rules (none used).
- ☑ `CHANGELOG.md`, `_handoff.md`, `STRATEGIES_THAT_WONT_WORK.md`.
