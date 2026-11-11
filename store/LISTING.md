# Chrome Web Store listing — copy and paste

Each section matches a field in the Chrome Web Store Developer Dashboard.

---

## Package
Upload `dist/gradebook-enhancer-1.0.zip` (build it with `py tools/package.py`).

## Store listing tab

**Name** (from the manifest): Gradebook Enhancer for PowerTeacher Pro

**Summary** (from the manifest, 125 of 132 characters):
Color-code PowerTeacher Pro scoresheet grades with your own thresholds, flag colors and split highlights. Not by PowerSchool.

**Category:** Education

**Language:** English (United States)

**Description:**
```
See at a glance which students need attention. Gradebook Enhancer colors the cells of your PowerTeacher Pro scoresheet based on rules you choose.

WHAT IT DOES
• Score bands: color any score below, between or above the percentages you pick. Add as many bands as you like (for example red below 70%, yellow from 70% to 80%).
• Final grade column: highlight course grades too, using the same bands or a separate set.
• Flags: give Late, Missing, Exempt, Incomplete and Absent their own colors. Turn each one on or off.
• Score codes: color your district's special codes, like M for Medical.
• Split cells: when a cell matches more than one rule (say, a low score that was also turned in late), it is split into two or three colored stripes so you see everything at once.
• Readable text: text automatically switches between black and white to stay readable on any color.
• Live updates: changes in settings show up on your open scoresheet right away. No reload needed.

TRY IT FIRST
Click the toolbar icon and choose "See it on a sample gradebook" to try every feature on a made-up class.

PRIVACY
Everything runs inside your browser. The extension does not collect, store or send any student data, and it has no analytics, ads or trackers. Only your color settings are saved, using Chrome's built-in settings sync.

WORKS WITH
PowerTeacher Pro scoresheets on powerschool.com addresses (https://yourdistrict.powerschool.com/teachers/...). Districts that use a custom web address are not supported yet.

Gradebook Enhancer is an independent tool for teachers. It is not affiliated with, endorsed by or sponsored by PowerSchool. PowerSchool and PowerTeacher are trademarks of their respective owners.
```

**Graphic assets** (all in `store/`):
| Field | File |
|---|---|
| Store icon (128×128) | `store-icon-128.png` |
| Screenshots (1280×800, in this order) | `screenshot-1-scoresheet.png`, `screenshot-2-popup.png`, `screenshot-3-settings.png`, `screenshot-4-codes-flags.png` |
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
Highlights cells in the PowerTeacher Pro gradebook scoresheet with teacher-chosen colors based on score thresholds, PowerTeacher flags (late, missing, exempt, incomplete, absent) and special score codes, so teachers can spot grades that need attention.
```

**Permission justification — storage:**
```
Saves the teacher's highlight settings (color bands, thresholds, flag and score-code colors, on/off switches) with chrome.storage.sync. No student data or page content is stored.
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
PowerTeacher Pro requires a school district teacher login, which we cannot share because it gives access to real student records (FERPA). The extension includes a built-in demo that runs the same highlighting code on a made-up class:

1. Install the extension and click its toolbar icon.
2. Click "See it on a sample gradebook" (or open the options page and click "Try your settings on a sample gradebook").
3. The sample scoresheet shows score bands (red below 70%, yellow 70–80%) by default.
4. Click "Turn on all highlight types" to see flag colors, the M (Medical) score code, final-grade highlighting and split (multi-color) cells.
5. Click "Open settings" and change any color or threshold. The sample scoresheet updates immediately.

The content script only runs on https://*.powerschool.com/teachers/* pages. It makes no network requests of its own and does not load remote code.
```

## Distribution tab
- Visibility: Public (or Unlisted if you want to share the link with colleagues first)
- Regions: all regions
- Pricing: free
