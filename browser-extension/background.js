/* MediaOS Extension — Background Service Worker */
'use strict';

/* Store collected videos; append on each collection, cap at 100 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'storePendingResults') {
    chrome.storage.local.get(['pendingVideos'], (existing) => {
      const prev     = existing.pendingVideos || [];
      const seenIds  = new Set(prev.map(v => v.id));
      const incoming = (msg.videos || []).filter(v => !seenIds.has(v.id));
      const merged   = prev.concat(incoming).slice(0, 100);
      chrome.storage.local.set({ pendingVideos: merged, pendingMeta: msg.meta || {} }, () => {
        sendResponse({ ok: true, total: merged.length });
      });
    });
    return true;
  }

  if (msg.type === 'getPendingResults') {
    chrome.storage.local.get(['pendingVideos', 'pendingMeta'], (data) => {
      const videos = data.pendingVideos || [];
      const meta   = data.pendingMeta   || {};
      chrome.storage.local.remove(['pendingVideos', 'pendingMeta']);
      sendResponse({ ok: true, videos, meta });
    });
    return true;
  }

  if (msg.type === 'peekPendingResults') {
    chrome.storage.local.get(['pendingVideos', 'pendingMeta'], (data) => {
      sendResponse({ ok: true, videos: data.pendingVideos || [], meta: data.pendingMeta || {} });
    });
    return true;
  }

  if (msg.type === 'clearPending') {
    chrome.storage.local.remove(['pendingVideos', 'pendingMeta'], () => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'storeVideoMeta') {
    chrome.storage.local.set({ pendingVideoMeta: msg.meta || {} }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'getVideoMeta') {
    chrome.storage.local.get(['pendingVideoMeta'], (data) => {
      const meta = data.pendingVideoMeta || null;
      chrome.storage.local.remove(['pendingVideoMeta']);
      sendResponse({ ok: true, meta });
    });
    return true;
  }

  if (msg.type === 'peekVideoMeta') {
    chrome.storage.local.get(['pendingVideoMeta'], (data) => {
      sendResponse({ ok: true, meta: data.pendingVideoMeta || null });
    });
    return true;
  }
});
