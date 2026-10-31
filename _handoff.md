# Handoff — PowerSchool Enhancer

_Last updated: 2026-10-30_

## What it is
Chrome MV3 extension that highlights grades in the PowerTeacher Pro scoresheet. Cloned from `github.com/dgrec3/GradebookHelper` (v1.2.1, hard-coded red/yellow). Now v2.0.0 with full customization. Long-term goal: Chrome Web Store release.

## Files
All extension code lives in `extension/`, which is the folder to load in Chrome. Docs stay at the project root because Chrome refuses to load a folder containing `_`-prefixed files like this one.

| File (in `extension/`) | Role |
|---|---|
| `manifest.json` | MV3; `storage` permission; popup + options page; content script on `https://*.powerschool.com/teachers/*` |
| `settings.js` | Shared settings model (`PTPSettings`): defaults, validation, band matching, contrast, storage |
| `content.js` | Applies highlight classes to grade cells; rebuilds CSS on settings change |
| `injected.js` | Page-context XHR wrapper; relays JSON so content.js can read points possible |
| `popup.html/js` | Quick toggles (on/off, final grade, flags) + band summary |
| `options.html/js`, `band-editor.js` | Full editor |
| `ui.css` | Shared popup/options styles (light + dark) |
| `FEATURES.md`, `CHANGELOG.md`, `STRATEGIES_THAT_WONT_WORK.md` | Project docs |

## PowerTeacher Pro DOM (confirmed 2026-10-30, hcst.powerschool.com)
- Assignment cell: `td.score-assignment-col[data-column-identifier=<assignmentId>]`, score in `a.keypad-link > var`.
- Final grade cell: `td.final-grade-info-cell` (`cell-col-id="courseGrade"`). Percent is in `.final-grade-info .percent` (e.g. "57%"), letter grade in `.grade`.
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

## Next steps
1. Load unpacked in Chrome (`chrome://extensions` → Developer mode → Load unpacked → pick the `extension` folder) and smoke-test.
2. Confirm what an `M` looks like when entered on an **assignment**: is it `var` text "M"? This is assumed but unverified, because no live M scores existed. Final-grade M is read from `.final-grade-info .grade`.
   - Possible upgrade: auto-discover each district's codes from the grade_scale XHR and offer them as presets.
3. Web Store prep: icons (16/32/48/128), screenshots, privacy policy (all processing is local; no data leaves the browser), store description. Expect reviewers to ask about the XHR wrapper in `injected.js`; justify it as reading points possible for the percent calculation.
4. Districts on custom (non-powerschool.com) domains won't match the host pattern. Consider optional host permissions later.
