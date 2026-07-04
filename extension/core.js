/*
 * Cookie Popup Remover — core logic
 * Shared by the extension (content.js) and the bookmarklet.
 *
 * Two jobs:
 *   1. Remove the consent popup / backdrop overlay.
 *   2. Restore normal page usage (scrolling + clicking), which most
 *      consent frameworks disable by locking <html>/<body>.
 *
 * Exposes: window.__cookieRemover.run({ aggressive: true|false })
 */
(function () {
  "use strict";

  if (window.__cookieRemover && window.__cookieRemover.__loaded) {
    return; // already installed on this page
  }

  // Known Consent Management Platform (CMP) selectors — overlays + dialogs.
  // These are removed even in "safe" (auto) mode.
  var CMP_SELECTORS = [
    // Sourcepoint (used by vg.no / Schibsted, many news sites)
    '[id^="sp_message_container_"]',
    '[id^="sp_message_iframe_"]',
    '.sp_veil',
    'div[class*="message-overlay"]',
    // OneTrust
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '.onetrust-pc-dark-filter',
    // Cookiebot
    '#CybotCookiebotDialog',
    '#CybotCookiebotDialogBodyUnderlay',
    '#CybotCookiebotDialogOverlay',
    // Quantcast Choice
    '#qc-cmp2-container',
    '.qc-cmp2-container',
    '.qc-cmp-cleanslate',
    '#qc-cmp2-ui',
    // TrustArc
    '#truste-consent-track',
    '.truste_overlay',
    '.truste_box_overlay',
    // Didomi
    '#didomi-host',
    '.didomi-popup-backdrop',
    // Usercentrics
    '#usercentrics-root',
    '#usercentrics-cmp-ui',
    '[data-testid="uc-app-wrapper"]',
    // Cookie Information
    '#cookie-information-template-wrapper',
    // Osano
    '.osano-cm-window',
    '.osano-cm-dialog',
    // Complianz
    '#cmplz-cookiebanner-container',
    '.cmplz-blocked-content-notice',
    // CookieYes
    '.cky-consent-container',
    '.cky-overlay',
    // Generic ids/classes seen in the wild
    '#gdpr-consent-tool-wrapper',
    '#gdpr-cookie-message',
    '.cookie-consent-overlay',
    '.cookie-overlay',
    '.consent-overlay',
    '.consent-modal',
    '#cookie-consent-banner'
  ];

  // CSS classes that frameworks add to <html>/<body> to lock scrolling.
  var SCROLL_LOCK_CLASSES = [
    'no-scroll', 'noscroll', 'no_scroll', 'no-scroll-y',
    'scroll-lock', 'scroll-locked', 'scrolllock', 'is-locked',
    'modal-open', 'modal-active', 'has-modal', 'popup-open',
    'overflow-hidden', 'overflowHidden', 'ovh',
    'body-locked', 'body-no-scroll', 'body-fixed', 'body--locked',
    'sp-message-open', 'didomi-popup-open', 'ReactModal__Body--open',
    'cmplz-blocked', 'ucfullscreen', 'onetrust-pc-open',
    'lock', 'locked', '_locked', 'stop-scrolling', 'stop-scroll'
  ];

  var CONSENT_WORDS = [
    'cookie', 'consent', 'gdpr', 'privacy', 'samtykke', 'informasjonskapsler',
    'personvern', 'zustimmung', 'datenschutz', 'einwilligung',
    'accepteren', 'cookies', 'ccpa'
  ];

  function textOf(el) {
    return (el.textContent || '').toLowerCase();
  }

  function looksLikeConsent(el) {
    var hay = (el.id + ' ' + el.className + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
    for (var i = 0; i < CONSENT_WORDS.length; i++) {
      if (hay.indexOf(CONSENT_WORDS[i]) !== -1) return true;
    }
    return false;
  }

  // Structural/content roots that must NEVER be removed. Deleting one blanks
  // the page to white (the reported vg.no bug). Structure-based so it can't
  // race the SPA's progressive hydration.
  var ROOT_IDS = [
    'application', 'root', '__next', 'app', 'main', 'content', 'page',
    'hovedinnhold', 'gatsby-focus-wrapper'
  ];
  var ROOT_TAGS = ['HTML', 'BODY', 'MAIN', 'ARTICLE', 'ASTRO-ISLAND'];
  function isProtectedRoot(el) {
    if (!el) return true;
    if (ROOT_TAGS.indexOf(el.tagName) !== -1) return true;
    if (el.getAttribute && el.getAttribute('role') === 'main') return true;
    var id = (el.id || '').toLowerCase();
    if (id && ROOT_IDS.indexOf(id) !== -1) return true;
    // A layout wrapper that contains the primary content is not an overlay.
    try { if (el.querySelector('main, article, [role="main"]')) return true; } catch (e) {}
    return false;
  }

  function safeRemove(el) {
    if (!el || !el.parentNode) return false;
    // Hard safety net: never delete the document/content roots. Some CMPs put
    // their state class (e.g. sp-message-open) on <html>/<body>; deleting those
    // blanks the whole page to white. Scroll locks are undone by unlockScroll().
    if (el === document.documentElement || el === document.body) return false;
    try {
      el.parentNode.removeChild(el);
      return true;
    } catch (e) {
      try { el.style.setProperty('display', 'none', 'important'); return true; }
      catch (e2) { return false; }
    }
  }

  // 1) Remove known CMP overlays/dialogs.
  function removeKnownOverlays() {
    var removed = 0;
    for (var i = 0; i < CMP_SELECTORS.length; i++) {
      var nodes;
      try { nodes = document.querySelectorAll(CMP_SELECTORS[i]); }
      catch (e) { continue; }
      for (var j = 0; j < nodes.length; j++) {
        if (safeRemove(nodes[j])) removed++;
      }
    }
    return removed;
  }

  // 2) Remove generic full-screen blocking overlays/backdrops.
  //    Conservative by default; broader when aggressive.
  function removeBlockingOverlays(aggressive) {
    var removed = 0;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var all = document.body ? document.body.querySelectorAll('*') : [];

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var cs;
      try { cs = getComputedStyle(el); } catch (e) { continue; }
      if (!cs) continue;
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;

      var z = parseInt(cs.zIndex, 10);
      var rect = el.getBoundingClientRect();
      var coversWidth = rect.width >= vw * 0.85;
      var coversHeight = rect.height >= vh * 0.85;
      var fullScreen = coversWidth && coversHeight;
      var highZ = !isNaN(z) && z >= 1000;
      var blocksClicks = cs.pointerEvents !== 'none';
      var visible = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.01;

      if (!visible) continue;
      if (isProtectedRoot(el)) continue;

      var isVeil = fullScreen && highZ && blocksClicks;
      // A genuine overlay is consenty by attributes, or holds little real text
      // (a backdrop veil / thin dialog wrapper — the message itself usually
      // lives in a cross-origin iframe). Full-screen elements packed with real
      // text are page content, not overlays.
      var consenty = looksLikeConsent(el) || textOf(el).length < 2000;

      if (isVeil && (consenty || aggressive)) {
        if (safeRemove(el)) removed++;
      }
    }
    return removed;
  }

  // Handle aria modal dialogs that are clearly consent related.
  function removeConsentDialogs(aggressive) {
    var removed = 0;
    var candidates = document.querySelectorAll('[role="dialog"], [aria-modal="true"], dialog[open]');
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (isProtectedRoot(el)) continue;
      if (looksLikeConsent(el) || (aggressive && textOf(el).length < 3000)) {
        if (safeRemove(el)) removed++;
      }
    }
    return removed;
  }

  // 3) Restore scrolling + interaction on the page.
  function unlockScroll() {
    var targets = [document.documentElement, document.body];
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      if (!el) continue;
      var s = el.style;

      // Undo the "position:fixed; top:-Ypx" scroll-lock trick and restore scroll.
      s.setProperty('overflow', 'auto', 'important');
      s.setProperty('overflow-x', 'hidden', 'important');
      s.setProperty('overflow-y', 'auto', 'important');
      s.setProperty('position', 'static', 'important');
      s.setProperty('height', 'auto', 'important');
      s.setProperty('min-height', '0', 'important');
      s.setProperty('max-height', 'none', 'important');
      s.setProperty('inset', 'auto', 'important');
      s.removeProperty('top');
      s.removeProperty('left');
      s.removeProperty('right');
      s.removeProperty('bottom');
      s.setProperty('pointer-events', 'auto', 'important');
      s.setProperty('touch-action', 'auto', 'important');
      s.setProperty('padding-right', '0', 'important');

      for (var c = 0; c < SCROLL_LOCK_CLASSES.length; c++) {
        el.classList.remove(SCROLL_LOCK_CLASSES[c]);
      }
    }

    // Some sites disable pointer events on a wrapper. Re-enable common ones.
    var wrappers = document.querySelectorAll('#__next, #root, #app, #main, .app, .wrapper, [data-reactroot]');
    for (var w = 0; w < wrappers.length; w++) {
      try { wrappers[w].style.setProperty('pointer-events', 'auto', 'important'); } catch (e) {}
    }
  }

  // Inject a stylesheet that forces scrolling on, in case the site keeps
  // re-adding inline overflow:hidden. Idempotent.
  function injectUnlockStyle() {
    var id = '__cookie_remover_unlock_style';
    if (document.getElementById(id)) return;
    var css =
      'html, body { overflow-y: auto !important; position: static !important; ' +
      'height: auto !important; max-height: none !important; }';
    var style = document.createElement('style');
    style.id = id;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    (document.head || document.documentElement).appendChild(style);
  }

  function run(opts) {
    opts = opts || {};
    var aggressive = !!opts.aggressive;
    var stats = { known: 0, overlays: 0, dialogs: 0 };
    try {
      injectUnlockStyle();
      stats.known = removeKnownOverlays();
      stats.dialogs = removeConsentDialogs(aggressive);
      stats.overlays = removeBlockingOverlays(aggressive);
      unlockScroll();
    } catch (e) {
      if (window.console && console.warn) console.warn('[cookie-remover]', e);
    }
    return stats;
  }

  // Watch for popups that load after the first pass and re-apply.
  var observer = null;
  var watchTimer = null;
  function startWatching(opts) {
    stopWatching();
    var deadline = Date.now() + 20000; // actively re-run for 20s
    var lastRun = 0;

    var moOpts = {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style']
    };
    observer = new MutationObserver(function () {
      var now = Date.now();
      if (now - lastRun < 300) return; // throttle
      lastRun = now;
      // Disconnect while re-running so our own style/class edits don't
      // retrigger the observer (which would cause an infinite loop).
      try { observer.disconnect(); } catch (e) {}
      run(opts);
      try { observer.observe(document.documentElement, moOpts); } catch (e) {}
    });
    try {
      observer.observe(document.documentElement, moOpts);
    } catch (e) {}

    // Belt-and-suspenders: periodic re-run for the first 20 seconds.
    watchTimer = setInterval(function () {
      run(opts);
      if (Date.now() > deadline) {
        clearInterval(watchTimer);
        watchTimer = null;
      }
    }, 1000);
  }

  function stopWatching() {
    if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
  }

  window.__cookieRemover = {
    __loaded: true,
    run: run,
    startWatching: startWatching,
    stopWatching: stopWatching
  };
})();
