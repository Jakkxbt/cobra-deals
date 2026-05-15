/**
 * CobraDeals — Background Service Worker
 * Minimal: handles install notification.
 */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: "popup.html?welcome=1" });
  }
});

// Allow content script to open multiple tabs at once
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "open_tabs" && Array.isArray(msg.urls)) {
    msg.urls.forEach((url, i) => {
      setTimeout(() => chrome.tabs.create({ url, active: i === 0 }), i * 200);
    });
    sendResponse({ ok: true });
  }
  return true;
});
