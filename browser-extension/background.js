/* MediaOS Extension — Background Service Worker */

const MEDIAOS_URLS = [
  'http://localhost:3001',
  'http://localhost:3000'
];

/* Store collected videos; append on each collection */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
      sendResponse({ ok: true, videos, meta });
      /* Clear after delivery */
      chrome.storage.local.remove(['pendingVideos', 'pendingMeta']);
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
});

/* Open or focus MediaOS tab, then navigate to import hash */
export async function openMediaOS(path = '#research/import') {
  const tabs = await chrome.tabs.query({});
  const mediaosTab = tabs.find(t => MEDIAOS_URLS.some(u => t.url && t.url.startsWith(u)));
  if (mediaosTab) {
    await chrome.tabs.update(mediaosTab.id, { active: true, url: mediaosTab.url.split('#')[0] + path });
    await chrome.windows.update(mediaosTab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: MEDIAOS_URLS[0] + '/' + path });
  }
}
