# Chrome Web Store review analysis — Gradebook Enhancer 1.0

_Reviewed: 2026-11-10, against the code on branch v1.03_

## Bottom line
**Estimated chance of approval on the first submission: about 85–90%.** This is a judgment from how the store reviews extensions like this one, not a number Google publishes.

The extension is close to the easiest kind to approve:
- one narrow purpose
- one permission (`storage`)
- one site pattern
- no network calls, no remote code and no data collection

The biggest risks were the **name** (trademark) and the **page-script XHR wrapper**. Both are fixed on this branch.

What's left are mostly paperwork mistakes in the dashboard. `store/LISTING.md` covers those field by field.

Expect a review time of **a few days to about 2 weeks**. The wildcard site pattern (`*.powerschool.com`) can trigger Google's more careful "in-depth review", which takes longer but isn't a mark against the extension.

## What reviewers check, and where this extension stands

| Area | Policy | Status | Notes |
|---|---|---|---|
| Name and branding | Impersonation / intellectual property | ⚠️→✅ Fixed | "PowerSchool Enhancer" read as an official PowerSchool product. Renamed to **Gradebook Enhancer for PowerTeacher Pro**; "for <product>" is how compatibility is normally stated. The summary, options page, description and privacy policy all say it isn't affiliated with PowerSchool. The icon uses no PowerSchool logo or colors. |
| Single purpose | Single-purpose policy | ✅ | Everything serves one job: coloring the PowerTeacher scoresheet. The unlinked demo page exists only so reviewers can test it. |
| Permissions | Use the narrowest permissions | ✅ | Only `storage`. No `tabs`, `scripting`, `<all_urls>` or `host_permissions`. The content script is limited to `/teachers/*`. |
| Site access | Broad host access gets extra review | 🟡 Low risk | `https://*.powerschool.com/teachers/*` is a wildcard subdomain because every district has its own. The justification text is ready in LISTING.md. |
| Remote code | MV3 ban on remote code | ✅ | No `eval`, `new Function`, remote `<script>` or fetched code. `injected.js` is packaged with the extension and loaded with `chrome.runtime.getURL`. |
| Page-script injection | Not banned, but reviewers look at it | ⚠️→✅ Fixed | `injected.js` wraps `XMLHttpRequest.send` in the page. **Before:** it re-broadcast every JSON response, including student data, as a page event. **Now:** it pulls out only assignment ID → points pairs and sends nothing else, and it no longer wraps `open()`. content.js also re-validates those pairs. A reviewer reading the file can see the data is reduced to point values. |
| User data / privacy | User Data Policy, Limited Use | ✅ | No collection, transmission, analytics or third parties. Settings use `chrome.storage.sync` and contain no student data. The privacy policy (PRIVACY.md) matches the code exactly, which is what Google checks. |
| Privacy policy | Required when an extension handles user data | ✅ Ready | You publish PRIVACY.md as a Google Sites page (see the steps below). Its contact email still needs filling in. |
| Data disclosure form | Must match real behavior | ✅ | Leave every data type unchecked; see the note below. |
| Functionality / testability | "Minimum functionality" and reviewers able to verify the extension works | ⚠️→✅ Fixed | Reviewers can't sign in to PowerTeacher. The **demo page** (`demo.html`) runs the real content.js, injected.js and settings on a made-up class. It ships unlinked (no menu entry for teachers); the test instructions give reviewers its chrome-extension:// address. Remember to fill in the real extension ID after the first upload. Without it, "could not verify functionality" was a real rejection risk. |
| Listing quality | Spam, keyword stuffing, misleading claims | ✅ | The description is plain, lists real features and repeats no keywords. The screenshots show the real UI with made-up students only. |
| Required assets | Icon, 1+ screenshot | ✅ | 128 icon, four 1280×800 screenshots, and a 440×280 promo tile. The manifest now declares icons; it had none before, which would have shown a generic puzzle piece. |
| Code quality | Readable, not obfuscated | ✅ | Plain, commented source with no minification or build step. |
| Content Security Policy | MV3 default CSP for extension pages | ✅ | No inline scripts. The demo page's inline `<style>` is allowed. |
| Children / education | Extra care for student data | ✅ | The extension is for teachers, and no student data leaves the tab. The policy says so explicitly. |
| Deceptive install / affiliate | — | ✅ | None. |

## Remaining risks, ranked

1. **Data-disclosure checkbox judgment (low).** The extension *reads* grades on the page but never transmits them. In Google's FAQ, "collecting" data means it leaves the user's device, so leaving the boxes unchecked is accurate. If a reviewer disagrees, the usual result is a request to change the form, not a ban.
   - The cautious alternative is to check only **"Website content"** and confirm the three certifications. That's also truthful, and it costs nothing except a line on the listing.
2. **"PowerTeacher" in the name (low, longer-term).** Naming the product you work with is normal. The bigger risk is not Google's review but a trademark complaint from PowerSchool after launch, which could get the listing taken down.
   - The disclaimers make that unlikely. If it ever happens, renaming to something like "Gradebook Enhancer for Teachers" would fix it.
3. **In-depth review delay (not a rejection).** This comes from the wildcard subdomain. Nothing to do but wait.
4. **School-managed browsers (not a store issue).** Some districts block extensions that aren't on an allowlist. Teachers there would need IT to approve it. Worth a line on your support page later.

## Things reviewers sometimes flag that this extension avoids
- Asking for `tabs` or `<all_urls>` "just in case"
- Minified or obfuscated JavaScript
- A listing description that doesn't match what the code does
- A privacy policy URL that's broken or is a generic template
- Leftover debug or unused permissions
- Bundling third-party libraries without license notes (this extension uses none)

## Before you click Submit
- [ ] Load `extension/` unpacked in Chrome and try it on a real scoresheet:
  - [ ] colors appear
  - [ ] popup and options save
  - [ ] chrome-extension://<ID>/demo.html opens the demo
  - [ ] "Turn on all highlight types" works
- [ ] Create the privacy page on your Google Site from PRIVACY.md and fill in the contact email.
- [ ] Build the zip: `py tools/package.py` → `dist/gradebook-enhancer-1.0.zip`.
- [ ] In the dashboard, paste everything from `store/LISTING.md`.
- [ ] Publish from your **personal** developer account, the one you used for Math Input for Google Forms. A school-managed (Workspace) account can be blocked by the district admin, and ownership would be tied to your employer.

## After approval
- Every update needs a higher `version` in manifest.json (1.0 → 1.0.1 or 1.1).
- If you ever add permissions, Chrome disables the extension for existing users until they approve the change. Avoid adding them unless there's a strong reason.
