# Handoff — Gradebook Enhancer for PowerTeacher Pro (folder: PowerSchool Enhancer)

_Last updated: 2026-11-10_

## What it is
Chrome MV3 extension that highlights grades in the PowerTeacher Pro scoresheet. Cloned from `github.com/dgrec3/GradebookHelper` (v1.2.1, hard-coded red/yellow). Branch `v1.01` added full customization; branch `v1.02` added split highlighting. Both are merged to `main` and released as manifest version **1.0** (the earlier pre-release numbers 2.0.0/2.1.0 were dropped). Branch `v1.03` (merged to main 2026-11-10) is Chrome Web Store prep: rename to **Gradebook Enhancer for PowerTeacher Pro**, demo page, trimmed XHR relay, icons, privacy policy, listing text and screenshots. Branch `v1.04` (merged to main 2026-11-10): PowerTeacher look-alike demo and screenshots; flag colors and split (multi-color) cells removed: one color per cell, from a score code or else a band. It also adds a color strength slider (translucent highlights let row stripes show through), a row hover outline, row divider lines, and **text flag tags**: MISS/LATE/INC/ABS/EXC tags replace PowerTeacher's tiny squares, pinned to the left edge with the score still centered. See `STORE_REVIEW.md` (risk analysis plus a submit checklist) and `store/LISTING.md` (paste-ready dashboard text).

## Files
All extension code lives in `extension/`, which is the folder to load in Chrome. Docs stay at the project root because Chrome refuses to load a folder containing `_`-prefixed files like this one.

| File (in `extension/`) | Role |
|---|---|
| `manifest.json` | MV3; `storage` permission; popup + options page; content script on `https://*.powerschool.com/teachers/*` |
| `settings.js` | Shared settings model (`PTPSettings`): defaults, validation, band matching, contrast, storage |
| `content.js` | Applies highlight classes to grade cells; rebuilds CSS on settings change |
| `injected.js` | Page-context XHR wrapper; relays only assignment ID → points possible to content.js |
| `popup.html/js` | Quick toggles (on/off, final grade, flags) + band summary |
| `options.html/js`, `band-editor.js` | Full editor |
| `ui.css` | Shared popup/options styles (light + dark) |
| `demo.html/js`, `demo-data.json` | PowerTeacher look-alike scoresheet (made-up class of 19) that runs the real highlighting; for teachers, reviewers and store screenshots |
| `icons/` | 16/32/48/128 icons drawn by `tools/make_icons.py` |

Root (not packaged): `FEATURES.md`, `CHANGELOG.md`, `STRATEGIES_THAT_WONT_WORK.md`, `PRIVACY.md`, `STORE_REVIEW.md`, `store/` (listing, screenshots, promo tile), `tools/` (`make_icons.py`, `make_screenshots.py`, `package.py` → `dist/`, which is gitignored).

## PowerTeacher Pro DOM (confirmed 2026-10-30, hcst.powerschool.com)
- Assignment cell: `td.score-assignment-col[data-column-identifier=<assignmentId>]`, score in `a.keypad-link > var`.
- Final grade cell: `td.final-grade-info-cell` (`cell-col-id="courseGrade"`). Percent is in `.final-grade-info .percent` (e.g. "57%"), letter grade in `.grade`.
- Flag markup (measured 2026-11-10): cells are 100x18px. Missing, Late, Incomplete and Absent are 8x8 background-colored spans in a 2x2 grid (positioned absolutely inside `span.flag-container`, which is stretched over the cell). Exempt and Collected sit directly in `a.keypad-link`. Comments (`ps-notes-flag corner-top-right`) is a 12px background image in the top-right.
- Flags: every cell renders all flag icons and hides unused ones with `ng-hide`: `ps-missing-flag`, `ps-incomplete-flag`, `ps-absent-flag`, `ps-late-flag`, `ps-exempt-flag-purple`, `ps-check-green` (collected), `ps-notes-flag` (comments). An exempt final grade adds class `exempt` to its `a.keypad-link`.

- Special grade-scale codes come from XHR `/ws/xte/section/grade_scale` → `_gradescales[0]._specialgradescale._items[]` (`_scorecode.name`, `description`, `isexempt`...). HCST codes: X Not Applicable, M Medical, I Incomplete, WP/WF Withdrawal Passing/Failing.

## Verified
- Live on the P2 Calculus scoresheet (test code pasted into the page, Chrome storage faked):
  - bands match score ÷ points with 0 mismatches
  - final-grade bands and the Absent flag color the right cells
  - Missing stays uncolored when off and colors cells when turned on, without a reload
  - column paging recolors new cells
  - dark colors get white text
- Options page and popup render and behave correctly (served over localhost).
- Unpacked extension (from `extension/`) loads in Chrome without errors (confirmed by user 2026-10-30).
- **Not yet verified in the installed extension:** `chrome.storage` save/sync and the popup's "Edit colors" button.

- (Historical) Split highlighting was tested, then removed on 2026-11-10 along with flag colors.

- Flag mini-grid (2026-11-10): 8px slots (Missing top-left, Incomplete top-right, Late bottom-left, Absent bottom-right), 1px from the cell border. Checked live on an 18px row with a simulated four-flag cell; nothing was clipped. Single-letter tags, the serif I and the filled style were checked on the demo and live.
- Comment badge (2026-11-10): checked live by pasting the CSS in. The comment icon is `span.ps-notes-flag.corner-top-right` with the sprite `/images/dist/teacher_tools/images/icons/icons.svg`, 12.4px, at **opacity 0.6**.
- Row aids and color strength (2026-11-10): checked live on section 74017 by pasting the real CSS in and setting 70% rgba on existing cells. The hover outline spans the name and every cell, and lines appear after rows 5 and 10. Students are in `table.gridTable > tbody > tr#std<id>`, names in `th.student-col`; even rows get `rgba(0,0,0,0.1)` on the `<tr>`.
- Text flag tags: CSS checked live on 2026-11-10 on the 2(M-F) Calculus scoresheet (section 74017), in the DELL-GEMINI (work) Chrome profile, by pasting it into the page. Single tags and stacked pairs looked right; the pair was simulated by unhiding a flag icon, and the page was reloaded afterward. **Not yet run from the installed extension.**
- Demo page (v1.03): rendered over localhost with a chrome.* shim; every highlight type (bands, M code, final grade, flag tags) rendered correctly through the real injected.js relay. **Not yet opened as an installed extension page.**

## Regenerating store images
`py tools/make_screenshots.py` (plain `py`, because PIL needs user site-packages). It copies `extension/` to a temp folder, adds a chrome.* storage shim with presets (default / bands / all), serves it on 127.0.0.1:8766, and captures the demo (`?shot`) and options pages with headless **Edge** at 960x600 CSS px × 4/3 scale, then composes `store/screenshot-1..4` and the promo tile. Headless Chrome exits with code 21 on this machine.

## Next steps
1. Reload the unpacked `extension` folder in Chrome and smoke-test on a real scoresheet: colors, popup and options saving, the popup's demo button, and "Turn on all highlight types". Then commit and push v1.03, and merge it to main.
   - Publish PRIVACY.md as a page on sites.google.com/view/dg3dev and fill in the contact email.
   - Run `py tools/package.py`, then submit using `store/LISTING.md`.
2. ~~Confirm what an `M` looks like on an assignment.~~ Answered by the user on 2026-11-10: Medical (M) **can only be entered in the course grade cell**, never on assignments. Final-grade M is read from `.final-grade-info .grade`.
   - Possible upgrade: auto-discover each district's codes from the grade_scale XHR and offer them as presets.
3. Web Store prep: icons (16/32/48/128), screenshots, privacy policy (all processing is local; no data leaves the browser), store description. Expect reviewers to ask about the XHR wrapper in `injected.js`; justify it as reading points possible for the percent calculation.
4. Districts on custom (non-powerschool.com) domains won't match the host pattern. Consider optional host permissions later.
