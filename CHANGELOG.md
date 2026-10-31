# Changelog — PowerSchool Enhancer

## 2.1.0 — 2026-10-30 (branch v1.02)

### Added
- **Split highlighting**: when a cell meets more than one condition, it is divided into equal left-to-right stripes (halves for 2, thirds for 3). On by default; max 2 or 3 is set on the options page; toggle also in the popup.
- Stripe order: **grade band → Late / Missing → other codes and flags** (score codes, Exempt, Incomplete, Absent).
- If stripes need different text colors, the text is black with a white halo so it stays readable on every stripe.

### Changed
- With split highlighting off, the single-color priority is the same as 2.0.0: score code → flag → grade band.
- A matched score code (e.g. M) no longer adds a separate Exempt stripe, because PowerTeacher marks those codes exempt anyway.
- Highlight colors are now per-cell CSS variables on one static stylesheet instead of one CSS class per band/flag/code. This is needed so any color combination can be split.

## 2.0.0 — 2026-10-30
Renamed from "PowerTeacher Gradebook - Highlight Low Grades" (GradebookHelper v1.2.1).

### Added
- Custom highlight bands: any number of min % / max % / color bands that can be added, removed, reordered and turned on/off. Min is inclusive, max is exclusive, and the first match wins. Blank min or max means no limit.
- **Include final grade** option. Final grades use the assignment bands by default or can have their own bands. Reads the percent PowerTeacher shows in the Course Grade column.
- Flag colors for Exempt, Missing, Incomplete, Absent and Late, each with its own toggle and color. A flag color overrides the score band.
- **Score codes**: an editable list of special grade-scale codes (code, label, color, toggle). Matches the displayed score or final letter grade, e.g. `M` = Medical (pre-filled, off). Codes override flags because PowerTeacher also marks these codes as exempt.
- Automatic black/white text color based on the background color (WCAG luminance).
- Toolbar popup with quick toggles and a summary of your bands.
- Full options page with overlap/gap warnings and Reset to defaults.
- Settings saved in `chrome.storage.sync` and applied to open gradebooks right away.
- Rescans also run when a flag is set or cleared and when PowerTeacher updates score or percent text in place.

### Changed
- Content script runs only on `https://*.powerschool.com/teachers/*` (was every page on `*.powerschool.com`).
- Cell classes change only when the highlight actually changes, which avoids needless DOM writes.
- Red cells now get black text instead of white, chosen by auto-contrast (#ff4d4d is a light red).

### Kept from 1.2.1
- XHR interceptor (`injected.js`), points-possible lookup, duplicate-load guard, debounced rescans.
