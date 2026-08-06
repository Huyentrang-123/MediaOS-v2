/* Node.js test: Facebook parser logic against fixture HTML using JSDOM */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const html = readFileSync('/home/user/mediaos-v2/fixture-facebook.html', 'utf8');
const dom  = new JSDOM(html, { url: 'https://www.facebook.com/search/videos/?q=serum+nam' });
const { document } = dom.window;

/* ── inline parser logic (mirrors facebook-parser.js exactly) ── */

function parseCount(text) {
  if (!text) return null;
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

function normaliseUrl(href) {
  if (!href) return null;
  try {
    const u = new URL(href, 'https://www.facebook.com');
    ['__cft__', '__tn__', 'mibextid', 'ref'].forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch { return href; }
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

function extractStats(card) {
  let views = null, likes = null, comments = null, shares = null;
  if (!card) return { views, likes, comments, shares };

  /* Aria-label scan (primary — mirrors real parser) */
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

  /* Vietnamese text scan fallback (mirrors real parser) */
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

function parsePage() {
  const seen    = new Set();
  const results = [];
  const selectors = ['a[href*="/reel/"]', 'a[href*="/watch"]', 'a[href*="/videos/"]'];
  const allLinks  = Array.from(document.querySelectorAll(selectors.join(',')));

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
    const statsAvailable = views !== null || likes !== null || comments !== null;

    results.push({ id: `facebook:${videoId}`, platform: 'facebook', url, views, likes, comments, shares, statsAvailable });
  }
  return results;
}

const results = parsePage();
console.log('=== Facebook Parser Test ===');
console.log('Cards found:', results.length);
results.forEach((r, i) => {
  console.log(`\nCard ${i+1}: ${r.id}`);
  console.log('  url:', r.url);
  console.log('  views:', r.views, '| likes:', r.likes, '| comments:', r.comments, '| shares:', r.shares);
  console.log('  statsAvailable:', r.statsAvailable);
});

/* Assertions */
const allFacebook   = results.every(r => r.id.startsWith('facebook:'));
const card1Views    = results[0]?.views === 1200000;   /* 1.2M */
const card1Likes    = results[0]?.likes === 45000;     /* 45K */
const card1Shares   = results[0]?.shares === 890;
const card2Views    = results[1]?.views === 1500000;   /* 1,5 triệu */
const card2Likes    = results[1]?.likes === 12000;     /* 12 nghìn */
const card2Comments = results[1]?.comments === 1200;   /* 1,2 nghìn */
const card3Included = results.some(r => r.id === 'facebook:video:111222333444555');
const card3NoStats  = results.find(r => r.id === 'facebook:video:111222333444555')?.statsAvailable === false;

console.log('\n=== Assertions ===');
console.log('All have facebook: prefix:', allFacebook ? 'PASS' : 'FAIL');
console.log('Card 1 views = 1.2M:', card1Views ? 'PASS' : 'FAIL (got ' + results[0]?.views + ')');
console.log('Card 1 likes = 45K:', card1Likes ? 'PASS' : 'FAIL (got ' + results[0]?.likes + ')');
console.log('Card 1 shares = 890:', card1Shares ? 'PASS' : 'FAIL (got ' + results[0]?.shares + ')');
console.log('Card 2 views = 1.5M (triệu):', card2Views ? 'PASS' : 'FAIL (got ' + results[1]?.views + ')');
console.log('Card 2 likes = 12K (nghìn):', card2Likes ? 'PASS' : 'FAIL (got ' + results[1]?.likes + ')');
console.log('Card 2 comments = 1.2K (nghìn):', card2Comments ? 'PASS' : 'FAIL (got ' + results[1]?.comments + ')');
console.log('Card 3 (/videos/) included:', card3Included ? 'PASS' : 'FAIL');
console.log('Card 3 statsAvailable=false:', card3NoStats ? 'PASS' : 'FAIL');
console.log('Total cards (expect 3):', results.length === 3 ? 'PASS' : 'FAIL (got ' + results.length + ')');
