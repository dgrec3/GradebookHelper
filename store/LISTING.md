# Chrome Web Store listing — copy and paste

Each section matches a field in the Chrome Web Store Developer Dashboard.

---

## Package
Upload `dist/gradebook-enhancer-1.0.zip` (build it with `py tools/package.py`).

## Store listing tab

**Name** (from the manifest): Gradebook Enhancer for PowerTeacher Pro

**Summary** (from the manifest, 128 of 132 characters):
Color-code PowerTeacher Pro scoresheet grades with your own thresholds, plus clear flag tags and row guides. Not by PowerSchool.

**Category:** Education

**Language:** English (United States)

**Description:**
```
See at a glance which students need attention. Gradebook Enhancer colors the cells of your PowerTeacher Pro scoresheet based on rules you choose, and makes the whole grid easier to read.

Made by a teacher with 25 years in the classroom, for fellow educators, and free.

WHAT IT DOES
• Grade bands: color scores by percentage, lowest to highest. Out of the box: red below 70%, yellow 70% to 80%, green 80% and up. Add, remove or recolor bands; each band starts where the one before it ends, so there are no gaps or overlaps to worry about. Uncheck a band to leave that range uncolored.
• Course grade column: highlight course grades too, using the same bands or a separate set.
• Flag letters: PowerTeacher's tiny colored flag squares become clear letters, always in the same spot: M (missing), I (incomplete), L (late), A (absent) and E (exempt). Prefer words? Switch to LATE, MISS, INC, ABS and EXC.
• Comment badges: cells with comments get a clear badge, so notes don't get lost on colored cells.
• Score codes: color your district's special codes, like M for Medical.
• Easy-to-follow rows: soft, see-through colors keep PowerTeacher's row stripes visible. Add lines under each row (with a heavier line every 5 rows), adjust how dark they are, and outline the row you hover over.
• Simple color choices: pick from 16 ready-made colors, or any color you like.
• Readable text: text automatically switches between black and white to stay readable on any color.
• Live updates: changes show up on your open scoresheet right away. No reload needed.

PRIVACY
Everything runs inside your browser. The extension does not collect, store or send any student data, and it has no analytics, ads or trackers. Only your settings are saved, using Chrome's built-in settings sync.

WORKS WITH
PowerTeacher Pro scoresheets on powerschool.com addresses (https://yourdistrict.powerschool.com/teachers/...). Districts that use a custom web address are not supported yet.

Gradebook Enhancer is free. If it saves you time, you can support it at buymeacoffee.com/dgrec3m (completely optional; every feature works without it).

Gradebook Enhancer is an independent tool for teachers. It is not affiliated with, endorsed by or sponsored by PowerSchool. PowerSchool and PowerTeacher are trademarks of their respective owners.
```

**Graphic assets** (all in `store/`, rebuilt with `py tools/make_screenshots.py`):
| Field | File |
|---|---|
| Store icon (128×128) | `store-icon-128.png` |
| Screenshots (1280×800, in this order) | `screenshot-1-in-action.png` (defaults + toolbar popup), `screenshot-2-bands.png` (5-band scheme + band editor), `screenshot-3-flags.png` (flag letters, comment badges + Flags card), `screenshot-4-rows.png` (softer colors, heavier lines, outlined row + Rows & colors card), `screenshot-5-final-codes.png` (Medical code in the course grade + Final grade and Score codes cards) |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile | optional, skip |

**Additional fields**
- Official URL: none
- Homepage URL: `https://github.com/dgrec3/GradebookHelper` (optional)
- Support URL: `https://github.com/dgrec3/GradebookHelper/issues` (optional)
- Mature content: No

## Privacy tab

**Single purpose description:**
```
Makes the PowerTeacher Pro gradebook scoresheet easier to read: it colors grade cells using the teacher's own percentage bands and score codes, and shows the scoresheet's existing flags and comments more clearly (letter tags, comment badges, row lines), so teachers can quickly spot students who need attention. It runs only on PowerTeacher Pro teacher pages and does nothing else.
```

**Permission justification — storage:**
```
The storage permission saves the teacher's display settings with chrome.storage.sync: the grade bands (percent ranges and colors), score-code colors, course-grade options, color strength, row line and flag tag options, and on/off switches. These settings are read back each time the scoresheet loads, and sync lets them follow the teacher to their other computers. No student data, grades or page content is ever stored.
```

**Permission justification — host permission** (content script on `https://*.powerschool.com/teachers/*`):
```
The content script runs only on https://*.powerschool.com/teachers/*, the PowerTeacher Pro teacher pages. Each school district's PowerTeacher Pro is hosted on its own powerschool.com subdomain (for example https://yourdistrict.powerschool.com/teachers/), so a wildcard subdomain is required to work for any district. Access is limited to the /teachers/ path; the extension does not run on any other site or page. On these pages it reads the scores, percentages and flags already shown on the scoresheet, plus each assignment's points possible from data the page has already loaded, in order to color the cells. Nothing is stored or sent anywhere.
```

**Are you using remote code?** No, I am not using remote code.

**Data usage — what user data do you plan to collect?**
Leave every box unchecked. The extension reads scoresheet content only in the browser tab to decide colors and never transmits it off the device (see the note in `STORE_REVIEW.md`).

**Certifications:** check all three:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** the Google Sites page you create from `PRIVACY.md`.

## Test instructions (Distribution → test instructions, if shown)
```
PowerTeacher Pro requires a school district teacher login, which we cannot share because it gives access to real student records (FERPA). The extension includes a reviewer demo page that recreates the PowerTeacher scoresheet with a made-up class and runs the same highlighting code:

1. Install the extension, then open chrome://extensions and copy its ID.
2. Go to chrome-extension://<that ID>/demo.html
   (After publishing, the address is chrome-extension://EXTENSION_ID/demo.html. Replace EXTENSION_ID with the ID shown in the developer dashboard.)
3. The sample scoresheet shows the defaults: score bands (red below 70%, yellow 70–80%, green 80%+) on assignments and the course grade, flag letters (M, I, L, A, E), comment badges and row lines.
4. Click "Turn on all highlight types" to also color the M (Medical) score code.
5. Click "Open settings" (or right-click the toolbar icon → Options) and change any color or threshold. The sample scoresheet updates immediately.

The demo page is not linked from the extension's menus; it exists for review and testing. The content script only runs on https://*.powerschool.com/teachers/* pages, makes no network requests of its own, and loads no remote code.
```

## Distribution tab
- Visibility: Public (or Unlisted if you want to share the link with colleagues first)
- Regions: all regions
- Pricing: free
