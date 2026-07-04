/*
 * Functional tests (headless Edge/Chrome):
 *
 *  1. Cookie-wall removal + scroll restore (test/fixture.html).
 *  2. Regression for the "whole page turns white" bug on vg.no
 *     (test/fixture-content-root.html): a full-screen, high-z app shell that
 *     wraps the article must NOT be removed, while the consent wall still is.
 *
 * Run: node test/run.js
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const EDGE_CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
];

function findBrowser() {
  for (const p of EDGE_CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error("No Chromium-based browser found.");
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

function fileUrl(name) {
  return "file://" + path.join(__dirname, name).replace(/\\/g, "/");
}

const bookmarklet = fs.readFileSync(
  path.join(__dirname, "..", "bookmarklet", "bookmarklet.min.js"), "utf8"
);

// --- Scenario 1: basic cookie wall + scroll lock ---------------------------
async function testBasicWall(browser) {
  console.log("\n=== Scenario 1: cookie wall removal + scroll restore ===");
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto(fileUrl("fixture.html"), { waitUntil: "load" });

  console.log("Before running the bookmarklet:");
  const before = await page.evaluate(() => ({
    overlay: !!document.querySelector('#sp_message_container_920123'),
    veil: !!document.querySelector('.sp_veil'),
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyPosition: getComputedStyle(document.body).position,
    modalOpen: document.body.classList.contains('modal-open')
  }));
  assert(before.overlay, "consent dialog is present");
  assert(before.veil, "backdrop veil is present");
  assert(before.bodyOverflow === "hidden", "body overflow is locked (hidden)");
  assert(before.bodyPosition === "fixed", "body is position:fixed (scroll-locked)");

  const scrolledLocked = await page.evaluate(() => {
    window.scrollTo(0, 500);
    return window.scrollY;
  });
  assert(scrolledLocked === 0, "page cannot scroll while locked (scrollY stays 0)");

  await page.evaluate(bookmarklet);
  await new Promise((r) => setTimeout(r, 400));

  console.log("After running the bookmarklet:");
  const after = await page.evaluate(() => ({
    overlay: !!document.querySelector('#sp_message_container_920123'),
    veil: !!document.querySelector('.sp_veil'),
    bodyOverflow: getComputedStyle(document.body).overflow,
    htmlOverflow: getComputedStyle(document.documentElement).overflow,
    bodyPosition: getComputedStyle(document.body).position,
    modalOpen: document.body.classList.contains('modal-open')
  }));
  assert(!after.overlay, "consent dialog was removed");
  assert(!after.veil, "backdrop veil was removed");
  assert(after.bodyPosition === "static", "body position restored to static");
  assert(after.bodyOverflow !== "hidden", "body overflow unlocked (" + after.bodyOverflow + ")");
  assert(after.htmlOverflow !== "hidden", "html overflow unlocked (" + after.htmlOverflow + ")");
  assert(!after.modalOpen, "scroll-lock class removed");

  const scrolledAfter = await page.evaluate(() => {
    window.scrollTo(0, 500);
    return window.scrollY;
  });
  assert(scrolledAfter > 0, "page can scroll after unlock (scrollY=" + scrolledAfter + ")");

  const clickable = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const link = document.querySelector('#content a');
    const r = link.getBoundingClientRect();
    const topEl = document.elementFromPoint(r.left + 2, r.top + 2);
    return topEl === link || link.contains(topEl);
  });
  assert(clickable, "article content is clickable (no overlay intercepts)");
  await page.close();
}

// --- Scenario 2: white-page regression -------------------------------------
async function testContentRootNotRemoved(browser) {
  console.log("\n=== Scenario 2: white-page regression (content root preserved) ===");
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto(fileUrl("fixture-content-root.html"), { waitUntil: "load" });

  // Prove the fixture is a valid regression: the OLD >25-link heuristic WOULD
  // have removed the app shell (=> white page). Decision only, no mutation.
  const oldWouldRemove = await page.evaluate(() => {
    const el = document.querySelector('#app-shell');
    const cs = getComputedStyle(el);
    const z = parseInt(cs.zIndex, 10);
    const r = el.getBoundingClientRect();
    const full = r.width >= innerWidth * 0.85 && r.height >= innerHeight * 0.85;
    const vis = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;
    const geom = (cs.position === 'fixed' || cs.position === 'absolute') &&
      full && !isNaN(z) && z >= 1000 && cs.pointerEvents !== 'none' && vis;
    const WORDS = ['cookie','consent','gdpr','privacy','samtykke','informasjonskapsler','personvern'];
    const hay = (el.id + ' ' + el.className + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
    const consenty = WORDS.some(w => hay.indexOf(w) !== -1);
    const content = el.querySelectorAll('a,article,main,[role="main"]').length;
    // OLD rule: remove unless (content > 25 && !consenty)
    return geom && !(content > 25 && !consenty);
  });
  assert(oldWouldRemove, "old heuristic WOULD delete the app shell (reproduces white page)");

  // The other white-page bug: '.sp-message-open' used to be in the CMP removal
  // list, but Sourcepoint puts that class on <html>/<body>. querySelectorAll
  // would have matched <body>, so the old code deleted <body> -> white page.
  const oldCmpMatchedBody = await page.evaluate(
    () => [...document.querySelectorAll('.sp-message-open')].includes(document.body)
  );
  assert(oldCmpMatchedBody, "'.sp-message-open' matches <body> (old CMP list would delete it)");

  const before = await page.evaluate(() => ({
    shell: !!document.querySelector('#app-shell'),
    main: !!document.querySelector('#application'),
    wall: !!document.querySelector('#sp_message_container_920123'),
    veil: !!document.querySelector('.sp_veil')
  }));
  assert(before.shell && before.main, "app shell + article present before");
  assert(before.wall && before.veil, "consent wall present before");

  await page.evaluate(bookmarklet);
  await new Promise((r) => setTimeout(r, 400));

  const after = await page.evaluate(() => {
    const body = document.body;
    const main = document.querySelector('#application');
    const rect = main ? main.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      hasBody: !!body,
      shell: !!document.querySelector('#app-shell'),
      main: !!main,
      mainArea: Math.round(rect.width * rect.height),
      articleText: (main && main.textContent || '').indexOf('VM-suksess') !== -1,
      wall: !!document.querySelector('#sp_message_container_920123'),
      veil: !!document.querySelector('.sp_veil'),
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      bodyPosition: body ? getComputedStyle(body).position : 'NO_BODY'
    };
  });

  // The fix: content survives, wall is gone, page is unlocked (not white).
  assert(after.hasBody, "<body> PRESERVED (page not blanked to white)");
  assert(after.shell, "app shell PRESERVED");
  assert(after.main, "article <main> PRESERVED");
  assert(after.mainArea > 0, "article still occupies the viewport (area=" + after.mainArea + ")");
  assert(after.articleText, "article text still present");
  assert(!after.wall, "consent wall removed");
  assert(!after.veil, "backdrop veil removed");
  assert(after.bodyPosition === "static", "scroll lock released (body static)");
  assert(after.htmlOverflow !== "hidden", "html overflow unlocked");
  await page.close();
}

(async () => {
  const exe = findBrowser();
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: "new",
    args: ["--no-sandbox", "--window-size=1200,800"]
  });
  try {
    await testBasicWall(browser);
    await testContentRootNotRemoved(browser);
    console.log("\nALL TESTS PASSED ✓");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("\nTEST ERROR:", e.message);
  process.exit(1);
});
