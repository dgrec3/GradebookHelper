# Changelog — PowerSchool Enhancer

## 1.0 — 2026-11-10
First public release (manifest version `1.0`). It includes all the work below, which was built as pre-release 2.0.0 and 2.1.0. Those numbers were never published.

### Chrome Web Store prep (branch v1.03)
- **Demo page is now hidden:** it still ships (so Chrome Web Store reviewers can test without a PowerTeacher login), but the popup button and the settings-page link are gone. The reviewer test instructions give its chrome-extension:// address.
- Settings: "Outline the row under the mouse" → "Outline the row when you hover over it".
- **Line darkness slider** under "Row lines" (Lighter ↔ Darker, 10–40% black, default 18 = the old look). It drives a `--ptp-line` CSS variable; the every-5 line is 2.5× as dark, capped at 85%. It's grayed out when row lines are off.
- **Palette color picker** (`color-picker.js`) for bands and score codes: clicking a color opens 16 standard highlight colors (including the defaults), with the current one ringed and the color names on hover. "More colors…" opens Chrome's full picker. Esc or clicking outside closes it.
- **Clearer band editor:**
  - Each row reads "From [0]% up to, but not including, [70]%", with a "Covers 0% – 69.99%" line under it.
  - The preview box shows a real example score (the highest whole score the band colors: 69, 79, or the start of an open band, 80) instead of always 85.
  - A 0–100% bar above the bands shows each color with its edges marked; switched-off ranges are striped gray.
  - **Bands are a ladder (schema 2):** band 1 always starts at 0%, and each later band starts where the one before ends (filled in as you type; start boxes are read-only). Teachers only type each band's end, and the last band can be "and up". Gaps and overlaps can't happen; a range meant to stay uncolored is a band that's switched off. The up/down buttons are gone. "+ Add band" stacks a band on top.
  - Warnings appear on the affected row (tinted): a middle band with no end, or an end that isn't above its start.
  - Settings saved before the ladder are converted once (`toLadder`): sorted low to high, old gaps kept as switched-off bands, overlaps trimmed.
  - Logic lives in `PTPSettings.analyzeBands` / `toLadder` (replaces `describeBandIssues`).
- **New defaults** (new installs and Reset): bands red <70, yellow 70–80, **green 80+**; **final grade column on**, using the assignment bands; row lines **under every row** (no heavy every-5 line); color strength 70%, row hover on, flag tags on (filled, single letters), comment badge on, M = Medical listed but off. Teachers with saved settings keep their choices.
- **Removed: flag colors and split (multi-color) cells.** With the clear flag tags, extra colors per flag were noise. Each cell now gets at most one color: a matching score code (e.g. M = Medical), otherwise its band. The settings page loses the "Multiple matches" card and the flag color rows, and the popup loses those toggles. Settings saved by earlier builds still load; their `flags` and `multiHighlight` keys are dropped. The content script no longer watches flag-icon class changes, because colors don't depend on flags.
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
- **Demo page rebuilt to look like PowerTeacher Pro's scoresheet:** title, class-info box, Mean/Median/Mode rows, category-colored headers, course-grade column, numbered bold names and 18px striped rows. It's recreated from measured styles (nothing copied from PowerSchool), with a made-up class of 19 students and 5 assignments. A banner on top keeps the demo buttons; `?shot` hides it.
- **Store screenshots** come from the demo via `tools/make_screenshots.py`: (1) in action with defaults, (2) custom bands, (3) split cells and flags, (4) settings beside the scoresheet. It runs Edge headless at 4/3 device scale, so 11px text is readable at 1280×800. It replaces `make_store_images.py`.
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
