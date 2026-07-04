/*
 * Cookie Popup Remover — bookmarklet source (self-contained).
 *
 * This is the readable source. The ready-to-use `javascript:` version is
 * generated from this file (see build.js) and embedded in bookmarklet.html.
 *
 * When clicked it:
 *   1. Removes known cookie-consent overlays + generic full-screen blockers.
 *   2. Restores scrolling and clicking on the page.
 *   3. Keeps watching for ~20s so late-loading popups are removed too.
 */
(function () {
  "use strict";

  var CMP = [
    '[id^="sp_message_container_"]', '[id^="sp_message_iframe_"]', '.sp_veil',
    'div[class*="message-overlay"]', '#onetrust-consent-sdk', '#onetrust-banner-sdk',
    '.onetrust-pc-dark-filter', '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay',
    '#CybotCookiebotDialogOverlay', '#qc-cmp2-container', '.qc-cmp2-container', '.qc-cmp-cleanslate',
    '#qc-cmp2-ui', '#truste-consent-track', '.truste_overlay', '.truste_box_overlay', '#didomi-host',
    '.didomi-popup-backdrop', '#usercentrics-root', '#usercentrics-cmp-ui', '[data-testid="uc-app-wrapper"]',
    '#cookie-information-template-wrapper', '.osano-cm-window', '.osano-cm-dialog',
    '#cmplz-cookiebanner-container', '.cmplz-blocked-content-notice', '.cky-consent-container',
    '.cky-overlay', '#gdpr-consent-tool-wrapper', '#gdpr-cookie-message', '.cookie-consent-overlay',
    '.cookie-overlay', '.consent-overlay', '.consent-modal', '#cookie-consent-banner'
  ];

  var LOCK = ['no-scroll','noscroll','no_scroll','no-scroll-y','scroll-lock','scroll-locked','scrolllock',
    'is-locked','modal-open','modal-active','has-modal','popup-open','overflow-hidden','overflowHidden','ovh',
    'body-locked','body-no-scroll','body-fixed','body--locked','sp-message-open','didomi-popup-open',
    'ReactModal__Body--open','cmplz-blocked','ucfullscreen','onetrust-pc-open','lock','locked','_locked',
    'stop-scrolling','stop-scroll'];

  var WORDS = ['cookie','consent','gdpr','privacy','samtykke','informasjonskapsler','personvern',
    'zustimmung','datenschutz','einwilligung','accepteren','cookies','ccpa'];

  function consenty(el) {
    var h = (el.id + ' ' + el.className + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
    for (var i = 0; i < WORDS.length; i++) { if (h.indexOf(WORDS[i]) !== -1) return true; }
    return false;
  }

  // Structural/content roots that must NEVER be removed. Removing one of these
  // blanks the page to white (the reported vg.no bug). This guard is based on
  // structure, not on how much of the SPA has hydrated, so it can't race.
  var ROOT_IDS = ['application','root','__next','app','main','content','page','hovedinnhold','gatsby-focus-wrapper'];
  var ROOT_TAGS = ['HTML','BODY','MAIN','ARTICLE','ASTRO-ISLAND'];
  function protect(el) {
    if (!el) return true;
    if (ROOT_TAGS.indexOf(el.tagName) !== -1) return true;
    if (el.getAttribute && el.getAttribute('role') === 'main') return true;
    var id = (el.id || '').toLowerCase();
    if (id && ROOT_IDS.indexOf(id) !== -1) return true;
    // A layout wrapper that contains the primary content is not an overlay.
    try { if (el.querySelector('main, article, [role="main"]')) return true; } catch (e) {}
    return false;
  }

  // A genuine consent/blocker overlay is either flagged as consenty by its
  // attributes, or holds little real text (a backdrop veil or thin dialog
  // wrapper — the message itself usually lives in a cross-origin iframe).
  // Anything full-screen packed with real text is page content, not an overlay.
  function overlayish(el) {
    if (consenty(el)) return true;
    return (el.textContent || '').trim().length < 2000;
  }

  function rm(el) {
    if (!el || !el.parentNode) return 0;
    // Hard safety net: never delete the document/content roots. Some CMPs put
    // their state class (e.g. sp-message-open) on <html>/<body>; deleting those
    // blanks the whole page to white. Scroll locks are undone by unlock().
    if (el === document.documentElement || el === document.body) return 0;
    try { el.parentNode.removeChild(el); return 1; }
    catch (e) { try { el.style.setProperty('display', 'none', 'important'); return 1; } catch (e2) { return 0; } }
  }

  function unlock() {
    [document.documentElement, document.body].forEach(function (el) {
      if (!el) return;
      var s = el.style;
      s.setProperty('overflow', 'auto', 'important');
      s.setProperty('overflow-y', 'auto', 'important');
      s.setProperty('position', 'static', 'important');
      s.setProperty('height', 'auto', 'important');
      s.setProperty('max-height', 'none', 'important');
      s.setProperty('inset', 'auto', 'important');
      ['top', 'left', 'right', 'bottom'].forEach(function (p) { s.removeProperty(p); });
      s.setProperty('pointer-events', 'auto', 'important');
      s.setProperty('touch-action', 'auto', 'important');
      s.setProperty('padding-right', '0', 'important');
      LOCK.forEach(function (c) { el.classList.remove(c); });
    });
    var id = '__cr_unlock';
    if (!document.getElementById(id)) {
      var st = document.createElement('style');
      st.id = id;
      st.textContent = 'html,body{overflow-y:auto!important;position:static!important;height:auto!important;max-height:none!important}';
      (document.head || document.documentElement).appendChild(st);
    }
  }

  function run() {
    var n = 0, i, nodes, j;
    for (i = 0; i < CMP.length; i++) {
      try { nodes = document.querySelectorAll(CMP[i]); } catch (e) { continue; }
      for (j = 0; j < nodes.length; j++) { n += rm(nodes[j]); }
    }
    var dlg = document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open]');
    for (i = 0; i < dlg.length; i++) {
      if (protect(dlg[i])) continue;
      if (consenty(dlg[i]) || (dlg[i].textContent || '').length < 3000) n += rm(dlg[i]);
    }
    var vw = innerWidth, vh = innerHeight, all = document.body ? document.body.querySelectorAll('*') : [];
    for (i = 0; i < all.length; i++) {
      var el = all[i], cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      if (!cs || (cs.position !== 'fixed' && cs.position !== 'absolute')) continue;
      var z = parseInt(cs.zIndex, 10), r = el.getBoundingClientRect();
      var full = r.width >= vw * 0.85 && r.height >= vh * 0.85;
      var vis = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;
      if (full && !isNaN(z) && z >= 1000 && cs.pointerEvents !== 'none' && vis) {
        if (protect(el)) continue;
        if (overlayish(el)) n += rm(el);
      }
    }
    unlock();
    return n;
  }

  var total = run();

  // Re-run for ~20s to catch popups that appear late.
  var end = Date.now() + 20000, timer = setInterval(function () {
    run();
    if (Date.now() > end) clearInterval(timer);
  }, 800);
  try {
    var moOpts = { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] };
    var moLast = 0;
    // Disconnect while re-running so our own style/class edits don't
    // retrigger the observer (which would cause an infinite loop).
    var mo = new MutationObserver(function () {
      var now = Date.now();
      if (now - moLast < 300) return;
      moLast = now;
      mo.disconnect();
      run();
      try { mo.observe(document.documentElement, moOpts); } catch (e) {}
    });
    mo.observe(document.documentElement, moOpts);
    setTimeout(function () { mo.disconnect(); }, 20000);
  } catch (e) {}

  // Brief visual confirmation.
  try {
    var t = document.createElement('div');
    t.textContent = '🍪 Pop-up removed — scroll unlocked';
    t.style.cssText = 'position:fixed;z-index:2147483647;left:50%;bottom:24px;transform:translateX(-50%);' +
      'background:#222;color:#fff;padding:10px 16px;border-radius:8px;font:14px/1.2 sans-serif;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.35);pointer-events:none;opacity:1;transition:opacity .4s';
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, 1800);
    setTimeout(function () { rm(t); }, 2400);
  } catch (e) {}
})();
