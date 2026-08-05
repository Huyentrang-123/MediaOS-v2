/* MediaOS Extension — Facebook Video Search Parser */
(function () {
  'use strict';

  /* ── helpers ─────────────────────────────────────── */

  function parseCount(text) {
    if (!text) return null;
    /* Handle Vietnamese: "1,2 nghìn", "1,5 triệu" etc. */
    const vn = text.match(/([\d,]+(?:[.,]\d+)?)\s*(nghìn|triệu|tỷ)/i);
    if (vn) {
      const n   = parseFloat(vn[1].replace(',', '.'));
      const mul = { nghìn: 1e3, triệu: 1e6, tỷ: 1e9 }[vn[2].toLowerCase()];
      return Math.round(n * mul);
    }
    const s = text.replace(/,/g, '').trim();
    const m = s.match(/^([\d.]+)\s*([KkMmBb]?)$/);
    if (!m) return null;
    const n   = parseFloat(m[1]);
    if (isNaN(n)) return null;
    const mul = { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] || 1;
    return Math.round(n * mul);
  }

  function parseCountFromAriaLabel(label) {
    if (!label) return null;
    const m = label.match(/([\d,.]+(?:\s*[KkMmBbTt])?)\s*(reaction|like|comment|share|view)/i);
    if (!m) return null;
    return parseCount(m[1].trim());
  }

  /* ── find card container ───────────────────────────── */

  function findCard(anchor) {
    let el = anchor;
    for (let i = 0; i < 15; i++) {
      el = el.parentElement;
      if (!el) break;
      if (el.getAttribute('role') === 'article') return el;
      const tag = el.tagName?.toLowerCase();
      if ((tag === 'article' || tag === 'div') && el.querySelectorAll('a[href]').length >= 2) return el;
    }
    return anchor.parentElement;
  }

  /* ── normalise Facebook video URL ─────────────────── */

  function normaliseUrl(href) {
    if (!href) return null;
    try {
      const u = new URL(href, 'https://www.facebook.com');
      /* Remove tracking params */
      ['__cft__', '__tn__', 'mibextid', 'ref', 'notif_id', 'notif_t'].forEach(k => u.searchParams.delete(k));
      return u.toString();
    } catch {
      return href;
    }
  }

  function extractVideoId(url) {
    if (!url) return null;
    const reels  = url.match(/\/reel\/(\d+)/);
    if (reels)  return `reel:${reels[1]}`;
    const watch  = url.match(/\/watch\/?\?v=(\d+)/);
    if (watch)  return `watch:${watch[1]}`;
    const videos = url.match(/\/videos\/(\d+)/);
    if (videos) return `video:${videos[1]}`;
    const path   = url.match(/facebook\.com\/[^/]+\/videos\/([^/?]+)/);
    if (path)   return `video:${path[1]}`;
    return null;
  }

  /* ── extract stats ─────────────────────────────────── */

  function extractStats(card) {
    let views    = null;
    let likes    = null;
    let comments = null;
    let shares   = null;

    if (!card) return { views, likes, comments, shares };

    /* Aria-label scan (reliable when present) */
    card.querySelectorAll('[aria-label]').forEach(el => {
      const label = el.getAttribute('aria-label') || '';
      const lc    = label.toLowerCase();
      const val   = parseCountFromAriaLabel(label);
      if (val == null) return;
      if (/view/.test(lc) && views    == null) { views    = val; return; }
      if (/reaction|like/.test(lc) && likes    == null) { likes    = val; return; }
      if (/comment/.test(lc) && comments == null) { comments = val; return; }
      if (/share/.test(lc) && shares   == null) { shares   = val; return; }
    });

    /* Text scan fallback */
    if (views === null && likes === null) {
      card.querySelectorAll('span, div').forEach(el => {
        if (el.children.length > 1) return;
        const t = el.textContent.trim();
        if (!t || t.length > 30) return;
        if (/lượt xem|lượt đã xem|views?/i.test(t)) {
          const n = parseCount(t.replace(/lượt.*/i, '').trim());
          if (n && views == null) views = n;
        } else if (/phản ứng|reaction|like/i.test(t)) {
          const n = parseCount(t.replace(/phản.*/i, '').trim());
          if (n && likes == null) likes = n;
        } else if (/bình luận|comment/i.test(t)) {
          const n = parseCount(t.replace(/bình.*/i, '').trim());
          if (n && comments == null) comments = n;
        } else if (/lượt chia sẻ|share/i.test(t)) {
          const n = parseCount(t.replace(/lượt.*/i, '').trim());
          if (n && shares == null) shares = n;
        }
      });
    }

    return { views, likes, comments, shares };
  }

  /* ── extract thumbnail ─────────────────────────────── */

  function extractThumb(card) {
    if (!card) return '';
    const img = card.querySelector('img[src*="fbcdn"], img[src*="facebook"]') || card.querySelector('img');
    return img?.src || '';
  }

  /* ── extract caption ───────────────────────────────── */

  function extractCaption(card) {
    if (!card) return '';
    const spans = Array.from(card.querySelectorAll('span, div'));
    let best = '';
    for (const el of spans) {
      if (el.children.length > 3) continue;
      const t = el.textContent.trim();
      if (t.length > 20 && t.length < 500 && t.length > best.length && !/^\d/.test(t)) {
        best = t;
      }
    }
    return best;
  }

  /* ── extract creator ───────────────────────────────── */

  function extractCreator(card, url) {
    if (!card) return { creator: '', creatorHandle: '' };
    /* Look for profile links */
    const profileLinks = Array.from(card.querySelectorAll('a[href*="facebook.com/"], a[href^="/"]'))
      .filter(a => {
        const h = a.getAttribute('href') || '';
        return !h.includes('/video') && !h.includes('/reel') && !h.includes('/watch') && !h.includes('/search');
      });
    const creatorLink = profileLinks[0];
    const creator     = creatorLink?.textContent?.trim() || '';
    /* Try to derive handle from profile URL */
    const m = (creatorLink?.href || '').match(/facebook\.com\/([^/?#]+)/);
    const handle = m ? m[1] : '';
    return { creator, creatorHandle: handle ? `@${handle}` : '' };
  }

  /* ── extract date ──────────────────────────────────── */

  function extractDate(card) {
    if (!card) return null;
    const timeEl = card.querySelector('abbr[data-utime], [data-utime]');
    if (timeEl?.dataset?.utime) return new Date(parseInt(timeEl.dataset.utime) * 1000).toISOString();
    const timeEl2 = card.querySelector('time');
    if (timeEl2?.dateTime) return new Date(timeEl2.dateTime).toISOString();
    return null;
  }

  /* ── main parser ───────────────────────────────────── */

  function parsePage() {
    const seen    = new Set();
    const results = [];

    const selectors = [
      'a[href*="/reel/"]',
      'a[href*="/watch"]',
      'a[href*="/videos/"]'
    ];

    const allLinks = Array.from(document.querySelectorAll(selectors.join(',')));

    for (const anchor of allLinks) {
      const rawHref = anchor.getAttribute('href');
      if (!rawHref) continue;
      const url     = normaliseUrl(rawHref.startsWith('http') ? rawHref : 'https://www.facebook.com' + rawHref);
      if (!url) continue;
      const videoId = extractVideoId(url);
      if (!videoId) continue;
      if (seen.has(videoId)) continue;
      seen.add(videoId);

      const card = findCard(anchor);
      const { views, likes, comments, shares } = extractStats(card);
      const { creator, creatorHandle } = extractCreator(card, url);
      const caption   = extractCaption(card);
      const postedAt  = extractDate(card);
      const thumbnail = extractThumb(card);

      const statsAvailable = views !== null || likes !== null || comments !== null;

      results.push({
        id:             `facebook:${videoId}`,
        platform:       'facebook',
        market:         null,
        url,
        thumbnail,
        caption,
        creator,
        creatorHandle,
        postedAt,
        views,
        likes,
        comments,
        shares,
        matchedQuery:   null,
        statsAvailable,
        sourceProvider: 'facebook-extension'
      });
    }

    return results;
  }

  /* ── message listener ──────────────────────────────── */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'collect') return false;
    try {
      const videos = parsePage();
      sendResponse({ ok: true, videos, url: location.href, platform: 'facebook' });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true;
  });
})();
