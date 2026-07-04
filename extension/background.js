/*
 * Cookie Popup Remover — background script.
 * Handles the keyboard shortcut (Alt+Shift+C) to force a removal pass.
 */
chrome.commands.onCommand.addListener(function (command) {
  if (command !== "remove-now") return;
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0]) return;
    var tabId = tabs[0].id;
    chrome.tabs.sendMessage(tabId, { type: "run-now", aggressive: true }, function () {
      // If the content script wasn't there (e.g. injected after load), inject and retry.
      if (chrome.runtime.lastError) {
        chrome.tabs.executeScript(tabId, { file: "core.js", allFrames: true }, function () {
          chrome.tabs.executeScript(tabId, {
            code: "if (window.__cookieRemover) { window.__cookieRemover.run({ aggressive: true }); window.__cookieRemover.startWatching({ aggressive: true }); }",
            allFrames: true
          });
        });
      }
    });
  });
});
