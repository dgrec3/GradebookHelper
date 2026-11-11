# Changelog — PowerSchool Enhancer

## 1.0 — 2026-11-10
First public release (manifest version `1.0`). It includes all the work below, which was built as pre-release 2.0.0 and 2.1.0. Those numbers were never published.

### Chrome Web Store prep (branch v1.03)
- **Renamed** to "Gradebook Enhancer for PowerTeacher Pro" (short name "Gradebook Enhancer"). "PowerSchool Enhancer" read as an official PowerSchool product, which is a trademark/impersonation rejection risk. Added "not affiliated with PowerSchool" lines.
- **Demo page** (`demo.html`): a made-up class in PowerTeacher's markup that runs the real highlighting code, so reviewers and teachers can try every feature without a PowerTeacher login. Opened from the popup ("See it on a sample gradebook") and the options page. It has a "Turn on all highlight types" button.
- **Privacy:** `injected.js` now reduces each PowerTeacher response to assignment ID → points pairs inside the page and passes on nothing else. It used to relay whole responses, student data included. It also no longer wraps `XMLHttpRequest.open`. content.js re-validates the pairs.
- Icons (16/32/48/128) added to the manifest and toolbar.
- **Text flag tags** (on by default): PowerTeacher's tiny colored flag squares become readable tags (MISS, LATE, INC, ABS, EXC) pinned to the cell's left edge. The score stays centered; one tag is centered vertically, two stack top/bottom. Tags show for every flag that's set, regardless of flag colors or split highlighting. Switch in the options page (Flags card) and the popup. CSS only: nothing is added to PowerTeacher's cells. Settings saved before this change default to tags on.
- Fixed: the filled tag style was silently ignored, because the per-flag `::before` rules (`background: none`, `color: inherit`, both `!important`) had higher specificity. The filled and word-size rules now use doubled classes to win.
- **Tag style:** "Filled" (white text on a dark pill, the new default) or "Outlined" (the cell's own text color).
- **Color strength** slider (30–100%, default 70%) on a new "Rows & colors" card. Highlights are drawn semi-transparent, so they look softer and PowerTeacher's alternating gray row stripes (on the `<tr>`) show through colored cells. Text contrast and every preview swatch use the blended color.
  - **Breaking-ish:** existing users' colors look lighter after updating; set 100% for the old look.
- **Row hover:** the student row under the mouse gets a blue outline across the name, course grade and every score (CSS `tr:hover`, on by default).
- **Row lines:** None, a line under every row, a heavy line every 5 rows, or both (the default).
- **Fixed flag slots:** tags sit in a 2×2 mini-grid of 8px slots (7px letters; 9px slots filled the whole 18px row and the cell border clipped their tops) on the cell's left edge, and each flag always uses the same slot: Missing top-left, Incomplete top-right, Late bottom-left, Absent bottom-right. Exempt stays centered on the left edge. The block sits 1px from the cell border, to leave the score room in narrow columns (sidebar open). Even four flags fit as a compact block beside the centered score, where earlier layouts spilled over it.
- The one-letter Incomplete tag uses a serif font (Georgia), so its "I" has bars and can't be mistaken for a lowercase l or a 1.
- **One-letter tags** (new default): L = Late, M = Missing, I = Incomplete, A = Absent, E = Exempt, at 9px and side by side in one row, leaving room for the comment bubble. "Tag text" in the Flags card switches back to short words (LATE, MISS…), which stay 7px and stacked. M for Missing can't clash with M = Medical, because Medical only exists in the course grade cell.
- **Comment badge** (default on, switch in the Flags card): PowerTeacher's comment bubble (`span.ps-notes-flag`, drawn at 60% opacity) is shown at full opacity on a white badge with a navy ring, so it stays visible on colored cells. Same icon, just easier to see. The demo page has three comment cells.
- Demo page rows now match PowerTeacher (`table.gridTable`, `tr#std…`, `th.student-col`, gray even rows).
- Demo page flags now use PowerTeacher's real markup (squares in `span.flag-container`), so the demo exercises the same CSS as the live page.
- Options page hints for score codes and flags now explain that "wins over" applies only when split highlighting is off.
- Added `PRIVACY.md`, `STORE_REVIEW.md`, `store/` (listing text, screenshots, promo tile) and `tools/` (icon, screenshot and zip builders).

## Pre-release 2.1.0 — 2026-10-30 (branch v1.02)

### Added
- **Split highlighting**: when a cell meets more than one condition, it is divided into equal left-to-right stripes (halves for 2, thirds for 3). On by default; max 2 or 3 is set on the options page; toggle also in the popup.
- Stripe order: **grade band → Late / Missing → other codes and flags** (score codes, Exempt, Incomplete, Absent).
- If stripes need different text colors, the text is black with a white halo so it stays readable on every stripe.

### Changed
- With split highlighting off, the single-color priority is the same as 2.0.0: score code → flag → grade band.
- A matched score code (e.g. M) no longer adds a separate Exempt stripe, because PowerTeacher marks those codes exempt anyway.
- Highlight colors are now per-cell CSS variables on one static stylesheet instead of one CSS class per band/flag/code. This is needed so any color combination can be split.

## Pre-release 2.0.0 — 2026-10-30
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
