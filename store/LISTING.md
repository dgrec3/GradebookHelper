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
See at a glance which students need attention. Gradebook Enhancer colors the cells of your PowerTeacher Pro scoresheet based on rules you choose.

WHAT IT DOES
• Score bands: color any score below, between or above the percentages you pick. Add as many bands as you like (out of the box: red below 70%, yellow 70% to 80%, green 80% and up).
• Final grade column: highlight course grades too, using the same bands or a separate set.
• Flag tags: PowerTeacher's tiny colored flag squares become clear letters, always in the same spot: M (missing), I (incomplete), L (late), A (absent) and E (exempt). Full words are an option.
• Score codes: color your district's special codes, like M for Medical.
• Row guides: soft, see-through colors keep PowerTeacher's row stripes visible, with optional lines under each row (heavier every 5) and an outline on the row under your mouse.
• Comment badges: cells with comments get a clear badge, so notes don't disappear on colored cells.
• Readable text: text automatically switches between black and white to stay readable on any color.
• Live updates: changes in settings show up on your open scoresheet right away. No reload needed.

PRIVACY
Everything runs inside your browser. The extension does not collect, store or send any student data, and it has no analytics, ads or trackers. Only your color settings are saved, using Chrome's built-in settings sync.

WORKS WITH
PowerTeacher Pro scoresheets on powerschool.com addresses (https://yourdistrict.powerschool.com/teachers/...). Districts that use a custom web address are not supported yet.

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
Highlights cells in the PowerTeacher Pro gradebook scoresheet with teacher-chosen colors based on score thresholds and special score codes, and makes the scoresheet easier to read (clear flag tags, comment badges, row guides), so teachers can spot grades that need attention.
```

**Permission justification — storage:**
```
Saves the teacher's highlight settings (color bands, thresholds, score-code colors, display options and on/off switches) with chrome.storage.sync. No student data or page content is stored.
```

**Permission justification — host permission** (content script on `https://*.powerschool.com/teachers/*`):
```
The extension's only job is to color cells on the PowerTeacher Pro scoresheet, which each school district hosts on its own powerschool.com subdomain (for example https://district.powerschool.com/teachers/). The wildcard subdomain is needed because the district name varies. The script is limited to the /teachers/ path and does nothing on other pages.
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
