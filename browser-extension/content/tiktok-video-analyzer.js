/* MediaOS Extension — TikTok Single Video Page Analyzer */
(function () {
  'use strict';

  function extractHashtags() {
    const seen = new Set();
    const tags = [];
    document.querySelectorAll('a[href*="/tag/"]').forEach(function(a) {
      const m = a.href.match(/\/tag\/([^/?#]+)/);
      if (!m) return;
      const tag = decodeURIComponent(m[1]).toLowerCase();
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push('#' + tag);
      }
    });
    return tags;
  }

  function extractCaption() {
    const selectors = [
      '[data-e2e="browse-video-desc"]',
      '[data-e2e="video-desc"]',
      '[data-e2e="search-card-desc"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      const el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim().length > 0) return el.textContent.trim().slice(0, 500);
    }
    return '';
  }

  function extractCreator() {
    const selectors = [
      '[data-e2e="browse-username"]',
      '[data-e2e="video-author-uniqueid"]',
      '[data-e2e="user-title"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      const el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    /* Fallback: extract @handle from URL */
    const m = location.href.match(/tiktok\.com\/@([^/?#]+)/);
    return m ? '@' + m[1] : '';
  }

  chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
    if (msg.action !== 'analyze') return false;
    try {
      const hashtags = extractHashtags();
      const caption  = extractCaption();
      const creator  = extractCreator();
      sendResponse({ ok: true, url: location.href, caption, hashtags, creator });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  });
})();
