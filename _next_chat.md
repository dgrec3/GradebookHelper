# Start here — next chat (written 2026-11-18)

Chrome extension "Gradebook Enhancer for PowerTeacher Pro" (repo dgrec3/GradebookHelper). Version 1.0 is live on the Chrome Web Store. Full background: `_handoff.md`. Working preferences: `_preferences.md`.

## Where things stand
- `main` = `v1.01` branch = manifest **1.0.1** (commit ddd9389), pushed. Nothing uncommitted.
- 1.0.1 fixes: comment badges no longer float over the pinned header, edited grades recolor, colors no longer go missing after a reload, and row lines can be darker (slider up to 70).
- Upload file is ready: `dist/gradebook-enhancer-1.0.1.zip`. Rebuild it with `py tools/package.py`.

## Next steps (the user's)
1. Test 1.0.1 in Chrome: turn off the store copy, use Load unpacked on `extension/`, then refresh the scoresheet.
2. If it looks good, upload the zip as a new version in the Developer Dashboard.

## Still open (only if asked)
- Put the real extension ID into the reviewer instructions in `store/LISTING.md` (replace EXTENSION_ID).
- `PRIVACY.md` still has the "[your contact email]" placeholder. Ask the user which email to use.
- There are two empty GitHub branches, `fix/issue-1-…` and `fix/issue-2-…`. Delete them only if the user says so.

## Branches
- `0.01` through `0.08`: pre-release work.
- `1.0`: the store release.
- `v1.01`: version 1.0.1.

Workflow: create a branch, commit, push, then fast-forward `main` and push.

## Watch out
- Don't change real grades in PowerSchool. Never show real student data, because of FERPA. Test on `extension/demo.html` instead.
- Cell content must stay at z-index auto. The pinned header is `div.sticky-header`, at z-index 1.
- PowerTeacher builds the grid in stages and Angular swaps text nodes, so coloring depends on three things:
  - the broad MutationObserver
  - the change and XHR event hooks
  - a 3 s safety pass

  See `STRATEGIES_THAT_WONT_WORK.md` before changing any of them.
- Use plain `py` for the Python tools (PIL).
