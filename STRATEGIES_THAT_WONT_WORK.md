# Strategies That Won't Work — PowerSchool Enhancer

- **Detecting Medical as a flag**: PowerTeacher Pro has no Medical flag. Medical is the special grade-scale **code** `M` (HCST special scale: X, M, I, WP, WF, all `isexempt: true`). Match it by the displayed text instead. Checking the Exempt flag first would swallow it.
- **Watching only childList mutations**: Angular updates score/percent text in place (characterData) and toggles flags by flipping `ng-hide` on icon spans (attribute change). Watching only added/removed nodes misses both.
- **Reacting to every class-attribute mutation**: our own `td` class changes would retrigger scans. Only class changes on `span.ps-icon` / `a.keypad-link` inside grade cells count as relevant.
- **Testing by fetching scripts from localhost into the PowerSchool tab**: the HTTPS page can't fetch `http://127.0.0.1` (private network access block). Paste test code directly instead.
- **Keeping docs like `_handoff.md` in the extension root**: Chrome refuses to load an unpacked extension if any root file or folder name starts with `_` (reserved). Extension code lives in `extension/`; docs stay at the project root.
- **Previewing popup/options as `file://` in the in-app browser**: the pane renders a static snapshot without running scripts. Serve the folder over `http://127.0.0.1` instead.

## Flag text tags
- **Inline tags after the score** (making `span.flag-container` static/inline): works, but it pushes the score off-center. The user preferred the score centered with tags in the corner.
- **Flex `column wrap` container for corner tags:** wrapped at just two tags because the 18px row is slightly shorter than two tags. The second column then covered the score. Use a grid with `grid-template-rows: repeat(2, max-content)` and `grid-auto-flow: column` instead.
- **Restyling only the flag spans:** not enough. The 8x8 squares are absolutely positioned inside `span.flag-container`, which is itself absolutely stretched over the cell, so the container has to be restyled too.
- **A generic `!important` override after per-flag `!important` rules:** it loses on specificity, whatever the order. The per-flag selectors have one more class, so the filled style never applied. Raise specificity instead (repeat a class: `.ps-icon.ps-icon`, plus the root class).
- **Auto-flow grids for corner tags (one row or two-per-column):** 3–4 flags spilled across the score (the user's screenshot shows 4 flags in one cell). Use fixed slots instead: each flag gets an explicit `grid-row`/`grid-column`, in fixed 9px columns.
- **`max-content` columns for the fixed slots:** an empty column collapses to 0, so a lone Absent slid into the left column. Use fixed `9px 9px` columns.

## Layering and change detection
- **Giving our cell content a z-index (even 1):** PowerTeacher pins the header while scrolling with a copy in `div.sticky-header` (position: fixed, z-index: 1). Badges at z-index 2 floated over it. Leave our absolute-positioned cell content at `z-index: auto`.
- **Watching only for added *element* nodes:** Angular often replaces the text node inside a score's `<var>`. The added node is text, so an element-only check missed it and grades kept stale colors. Also check `mutation.target.closest(gradeCell)`.
- **Relying on one color pass after the data XHR:** on slow loads, PowerTeacher renders the grid after the data arrives, so the pass found no cells. The watcher also missed the build because cells are inserted bare (no `data-column-identifier`, no score yet). Watch for any `td.keypad-cell` or `table.gridTable`, and keep a cheap periodic safety pass.
- **Marking painted cells with a class and trusting a "painted" record to skip them:** if the class or style is rewritten, the cell stays blank forever. Key the CSS on a data attribute, and verify the paint before skipping.
