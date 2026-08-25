/* MediaOS Extension — TikTok Search Page Parser */
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────── */

  function parseCount(text) {
    if (!text) return null;
    const s = text.replace(/,/g, '').trim();
    const m = s.match(/^([\d.]+)\s*([KkMmBbTt]?)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (isNaN(n)) return null;
    const mul = { k: 1e3, m: 1e6, b: 1e9, t: 1e9 }[m[2].toLowerCase()] || 1;
    return Math.round(n * mul);
  }

  function absUrl(href) {
    if (!href) return null;
    if (href.startsWith('http')) return href;
    return 'https://www.tiktok.com' + href;
  }

  function parseRelativeDate(text) {
    if (!text) return null;
    const m = text.match(/(\d+)\s*(s(?:ec)?|m(?:in)?|h(?:r|our)?|d(?:ay)?|w(?:k|eek)?|mo(?:nth)?|y(?:r|ear)?)/i);
    if (!m) return null;
    const n    = parseInt(m[1]);
    const unit = m[2][0].toLowerCase();
    const ms   = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 }[unit];
    if (!ms) return null;
    return new Date(Date.now() - n * ms).toISOString();
  }

  /* ── find card container ───────────────────────────── */

  function findCard(anchor) {
    let el = anchor;
    for (let i = 0; i < 12; i++) {
      el = el.parentElement;
      if (!el) break;
      /* Stop at a container that wraps an image + some text */
      const imgs = el.querySelectorAll('img');
      const links = el.querySelectorAll('a[href*="/video/"]');
      if (imgs.length >= 1 && links.length === 1) return el;
      /* data-e2e markers */
      if (el.dataset && /search|video|item/.test(el.dataset.e2e || '')) return el;
    }
    return anchor.parentElement;
  }

  /* ── extract stats from card ───────────────────────── */

  function extractStats(card) {
    if (!card) return {};

    /* Try data-e2e attributes first (most reliable when present) */
    const viewsEl    = card.querySelector('[data-e2e*="view"],[data-e2e="video-views"]');
    const likesEl    = card.querySelector('[data-e2e*="like"],[data-e2e="like-count"]');
    const commentsEl = card.querySelector('[data-e2e*="comment"],[data-e2e="comment-count"]');

    /* views only when selector explicitly found — TikTok Search cards do NOT show
       view counts on thumbnails; the visible number is always likes (heart icon).
       Never infer views from an unattributed number. */
    let views    = viewsEl    ? parseCount(viewsEl.textContent)    : null;
    let likes    = likesEl    ? parseCount(likesEl.textContent)    : null;
    let comments = commentsEl ? parseCount(commentsEl.textContent) : null;

    /* Fallback: when no data-e2e like selector matched, scan for formatted numbers.
       On TikTok Search page the only stat visible on a card thumbnail is the
       like count (heart icon). Assign numbers to likes only — never to views. */
    if (likes === null) {
      const numEls = Array.from(card.querySelectorAll('strong, span'))
        .map(el => ({ el, val: parseCount(el.textContent.trim()) }))
        .filter(x => x.val !== null && x.val > 0)
        .sort((a, b) => b.val - a.val);

      if (numEls.length >= 1) likes = numEls[0].val;
      /* Do NOT assign views or comments from unattributed numbers */
    }

    return { views, likes, comments };
  }

  /* ── extract caption ───────────────────────────────── */

  function extractCaption(card, anchor) {
    if (!card) return anchor?.textContent?.trim() || '';
    /* data-e2e desc/title */
    const descEl = card.querySelector('[data-e2e*="desc"],[data-e2e*="title"],[data-e2e*="caption"]');
    if (descEl && descEl.textContent.trim().length > 5) return descEl.textContent.trim();
    /* Largest text block that isn't a number or handle */
    let best = '';
    card.querySelectorAll('span, p, h3').forEach(el => {
      if (el.children.length > 2) return;
      const t = el.textContent.trim();
      if (t.length > best.length && t.length > 8 && !/^\d/.test(t) && !t.startsWith('@')) {
        best = t;
      }
    });
    return best.slice(0, 300);
  }

  /* ── extract posted date ───────────────────────────── */

  function extractDate(card) {
    if (!card) return null;
    const timeEl = card.querySelector('time');
    if (timeEl?.dateTime) return new Date(timeEl.dateTime).toISOString();
    const spans = Array.from(card.querySelectorAll('span'));
    for (const el of spans) {
      const d = parseRelativeDate(el.textContent.trim());
      if (d) return d;
    }
    return null;
  }

  /* ── extract thumbnail ─────────────────────────────── */

  function extractThumb(card) {
    if (!card) return '';
    const img = card.querySelector('img');
    return img?.src || img?.dataset?.src || '';
  }

  /* ── main parser ───────────────────────────────────── */

  function parsePage() {
    const seen    = new Set();
    const results = [];

    /* All anchors that link to a TikTok video */
    document.querySelectorAll('a[href*="/video/"]').forEach(anchor => {
      const url = absUrl(anchor.getAttribute('href'));
      if (!url) return;

      const m = url.match(/tiktok\.com\/@([^/?#]+)\/video\/(\d+)/);
      if (!m) return;

      const [, handle, videoId] = m;
      if (seen.has(videoId)) return;
      seen.add(videoId);

      const card = findCard(anchor);

      /* Creator display name */
      const creatorAnchor = card?.querySelector(`a[href*="/@${handle}"]`) || anchor;
      const creator       = creatorAnchor?.textContent?.trim() || handle;

      const { views, likes, comments } = extractStats(card);
      const caption   = extractCaption(card, anchor);
      const postedAt  = extractDate(card);
      const thumbnail = extractThumb(card);

      const statsAvailable = views !== null || likes !== null || comments !== null;

      const video = {
        id:             `tiktok:${videoId}`,
        platform:       'tiktok',
        market:         null,
        url,
        thumbnail,
        caption,
        creator:        creator || handle,
        creatorHandle:  `@${handle}`,
        postedAt,
        views,
        likes,
        comments,
        shares:         null,
        matchedQuery:   null,
        statsAvailable,
        sourceProvider: 'tiktok-extension'
      };

      if (results.length < 3) {
        console.log('[MediaOS debug]', { url: video.url, views: video.views, likes: video.likes, comments: video.comments, shares: video.shares, statsAvailable: video.statsAvailable });
      }

      results.push(video);
    });

    return results;
  }

  /* ── message listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'collect') return false;
    try {
      const videos = parsePage();
      sendResponse({ ok: true, videos, url: location.href, platform: 'tiktok' });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  });
})();
