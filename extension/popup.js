/* Cookie Popup Remover — popup UI logic. */
(function () {
  "use strict";

  var DEFAULTS = { enabled: true, aggressive: false, disabledHosts: [] };

  var els = {
    removeNow: document.getElementById("removeNow"),
    status: document.getElementById("status"),
    enabled: document.getElementById("enabled"),
    aggressive: document.getElementById("aggressive"),
    disableHost: document.getElementById("disableHost"),
    hostName: document.getElementById("hostName")
  };

  var currentHost = "";

  function hostFromUrl(url) {
    try { return new URL(url).hostname; } catch (e) { return ""; }
  }

  function getActiveTab(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      cb(tabs && tabs[0] ? tabs[0] : null);
    });
  }

  function load() {
    getActiveTab(function (tab) {
      currentHost = tab ? hostFromUrl(tab.url) : "";
      els.hostName.textContent = currentHost || "this site";
      chrome.storage.local.get(DEFAULTS, function (s) {
        els.enabled.checked = !!s.enabled;
        els.aggressive.checked = !!s.aggressive;
        els.disableHost.checked = (s.disabledHosts || []).indexOf(currentHost) !== -1;
      });
    });
  }

  function save(patch) {
    chrome.storage.local.get(DEFAULTS, function (s) {
      var next = Object.assign({}, s, patch);
      chrome.storage.local.set(next);
    });
  }

  function toggleDisabledHost(disabled) {
    chrome.storage.local.get(DEFAULTS, function (s) {
      var list = (s.disabledHosts || []).slice();
      var i = list.indexOf(currentHost);
      if (disabled && i === -1 && currentHost) list.push(currentHost);
      if (!disabled && i !== -1) list.splice(i, 1);
      chrome.storage.local.set({ disabledHosts: list });
    });
  }

  function setStatus(text) {
    els.status.textContent = text;
  }

  els.removeNow.addEventListener("click", function () {
    setStatus("Working…");
    getActiveTab(function (tab) {
      if (!tab) { setStatus("No active tab."); return; }
      chrome.tabs.sendMessage(tab.id, { type: "run-now", aggressive: true }, function (resp) {
        if (chrome.runtime.lastError || !resp) {
          // Content script not present — inject and run directly.
          chrome.scripting.executeScript(
            { target: { tabId: tab.id, allFrames: true }, files: ["core.js"] },
            function () {
              chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: function () {
                  if (window.__cookieRemover) {
                    window.__cookieRemover.run({ aggressive: true });
                    window.__cookieRemover.startWatching({ aggressive: true });
                  }
                }
              }, function () {
                setStatus(chrome.runtime.lastError ? "Can't run on this page." : "Done ✓");
              });
            }
          );
          return;
        }
        var st = resp.stats || {};
        var total = (st.known || 0) + (st.overlays || 0) + (st.dialogs || 0);
        setStatus(total > 0 ? ("Removed " + total + " overlay(s) ✓") : "Cleaned & scroll unlocked ✓");
      });
    });
  });

  els.enabled.addEventListener("change", function () {
    save({ enabled: els.enabled.checked });
  });
  els.aggressive.addEventListener("change", function () {
    save({ aggressive: els.aggressive.checked });
  });
  els.disableHost.addEventListener("change", function () {
    toggleDisabledHost(els.disableHost.checked);
  });

  load();
})();
