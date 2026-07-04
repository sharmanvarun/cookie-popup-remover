# 🍪 Cookie Popup Remover

If you are not comfortable with GitHub or code, start here:

- **Beginner guide:** [USER-GUIDE.md](USER-GUIDE.md)

This tool removes cookie pop-ups and restores normal use of the page — scrolling
and clicking — on sites that block the page until you accept cookies.

Deleting the popup by hand does not always help, because the site may also lock
scrolling. This tool removes the popup *and* undoes that lock.

The easiest way to use it is the **bookmarklet**. It does not need any browser
extension install and works in Chrome, Edge, and Firefox. An optional extension
is included for personal/unmanaged browsers.

---

## ✅ Recommended: the bookmarklet

### Install (drag & drop)

1. Open **`bookmarklet/bookmarklet.html`** in your browser
   (double‑click the file, or drag it into a browser tab).
2. Show the bookmarks bar: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>.
3. Drag the brown **“🍪 Remove cookie pop‑up”** button onto your bookmarks bar.

### Install (manual, if you can't drag)

1. Right‑click the bookmarks bar → **Add page / New bookmark**.
2. Name it `Remove cookie pop-up`.
3. For the **URL**, paste the whole `javascript:…` string shown on
   `bookmarklet.html` (there's a **Copy to clipboard** button), or copy it from
   [`bookmarklet/bookmarklet.min.js`](bookmarklet/bookmarklet.min.js) and prefix
   it with `javascript:`.

### Use

Open a page with a cookie wall (e.g. `vg.no`) and **click the bookmark**.
The popup disappears, scrolling is restored, and you'll see a brief
“🍪 Pop‑up removed — scroll unlocked” confirmation.

The bookmarklet also keeps watching for ~20 seconds, so popups that load a
moment later are removed too.

---

## What it does

When run, the bookmarklet:

1. **Removes known consent overlays** — Sourcepoint (used by vg.no / Schibsted),
   OneTrust, Cookiebot, Quantcast, TrustArc, Didomi, Usercentrics, Osano,
   Complianz, CookieYes, and more.
2. **Removes generic full‑screen blockers** — any fixed/absolute, high‑`z-index`
   element that covers the viewport and intercepts clicks (with a guard so it
   won't nuke the actual article content).
3. **Restores the page** — resets `overflow`, `position`, `height` and
   `pointer-events` on `<html>`/`<body>`, undoes the `position: fixed; top: -Ypx`
   scroll‑lock trick, and strips scroll‑lock CSS classes (`modal-open`,
   `no-scroll`, `sp-message-open`, …).
4. **Keeps watching** for ~20 s via a `MutationObserver` + interval to catch
   late‑loading popups.

> Note: this hides the consent dialog; it does not submit a choice on your
> behalf. Some sites store no consent cookie, so the wall may reappear on the
> next visit — just click the bookmark again.

---

## Project layout

```
cookie-remover/
├─ bookmarklet/
│  ├─ bookmarklet.src.js   # readable source (edit this)
│  ├─ bookmarklet.min.js   # minified output (generated)
│  ├─ bookmarklet.html     # drag‑to‑install page (generated)
│  └─ build.js             # minifies src -> min + html
├─ extension/              # optional browser extension (Chrome, Edge, Firefox)
│  ├─ manifest.json
│  ├─ core.js              # shared removal engine
│  ├─ content.js           # auto‑runs on each page
│  ├─ background.js        # Alt+Shift+C keyboard shortcut
│  ├─ popup.html / popup.js
│  └─ icons/
├─ test/
│  ├─ fixture.html         # fake vg.no‑style cookie wall
│  └─ run.js               # headless test of the bookmarklet
└─ package.json
```

---

## Development

```powershell
# Rebuild the bookmarklet after editing bookmarklet/bookmarklet.src.js
npm run build

# Run the automated test (drives a headless Chromium/Edge)
npm test
```

The test loads a fake cookie wall that locks scrolling exactly like vg.no,
runs the bookmarklet, and asserts the popup is gone and the page scrolls and is
clickable again.

---

## Optional: the browser extension

Only usable if your browser allows **unpacked/developer extensions** (many
managed/work machines block this — which is why the bookmarklet exists).

### Chrome / Edge

1. Go to `edge://extensions` or `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the **`extension/`** folder.

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Choose the **`extension/manifest.json`** file.

It then cleans cookie walls **automatically** on every page, adds a toolbar
button (“Remove pop‑up now”, plus toggles), and a keyboard shortcut
(<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>). The extension and the bookmarklet
share the same removal logic.
