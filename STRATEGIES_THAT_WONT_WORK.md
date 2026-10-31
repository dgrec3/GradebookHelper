# Strategies That Won't Work — PowerSchool Enhancer

- **Detecting Medical as a flag**: PowerTeacher Pro has no Medical flag. Medical is the special grade-scale **code** `M` (HCST special scale: X, M, I, WP, WF, all `isexempt: true`). Match it by the displayed text instead. Checking the Exempt flag first would swallow it.
- **Watching only childList mutations**: Angular updates score/percent text in place (characterData) and toggles flags by flipping `ng-hide` on icon spans (attribute change). Watching only added/removed nodes misses both.
- **Reacting to every class-attribute mutation**: our own `td` class changes would retrigger scans. Only class changes on `span.ps-icon` / `a.keypad-link` inside grade cells count as relevant.
- **Testing by fetching scripts from localhost into the PowerSchool tab**: the HTTPS page can't fetch `http://127.0.0.1` (private network access block). Paste test code directly instead.
- **Keeping docs like `_handoff.md` in the extension root**: Chrome refuses to load an unpacked extension if any root file or folder name starts with `_` (reserved). Extension code lives in `extension/`; docs stay at the project root.
- **Previewing popup/options as `file://` in the in-app browser**: the pane renders a static snapshot without running scripts. Serve the folder over `http://127.0.0.1` instead.
