/*
 * Cookie Popup Remover — content script.
 * Reads user settings and drives the shared core (core.js).
 */
(function () {
  "use strict";

  var DEFAULTS = { enabled: true, aggressive: false, disabledHosts: [] };
  var host = location.hostname || "";

  function getSettings(cb) {
    try {
      chrome.storage.local.get(DEFAULTS, function (s) {
        cb(s || DEFAULTS);
      });
    } catch (e) {
      cb(DEFAULTS);
    }
  }

  function isDisabledHere(s) {
    return !s.enabled || (s.disabledHosts || []).indexOf(host) !== -1;
  }

  function start(s) {
    if (isDisabledHere(s)) return;
    var opts = { aggressive: !!s.aggressive };
    // Immediate pass + keep watching for late-loading popups.
    window.__cookieRemover.run(opts);
    window.__cookieRemover.startWatching(opts);

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        window.__cookieRemover.run(opts);
      });
    }
    window.addEventListener("load", function () {
      window.__cookieRemover.run(opts);
    });
  }

  getSettings(start);

  // Manual triggers from the popup / keyboard shortcut.
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || !msg.type) return;
      if (msg.type === "run-now") {
        var stats = window.__cookieRemover.run({ aggressive: msg.aggressive !== false });
        window.__cookieRemover.startWatching({ aggressive: msg.aggressive !== false });
        sendResponse({ ok: true, stats: stats, host: host });
        return true;
      }
      if (msg.type === "ping") {
        sendResponse({ ok: true, host: host });
        return true;
      }
    });
  } catch (e) {}
})();
