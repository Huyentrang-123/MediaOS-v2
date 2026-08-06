/* Node.js test: run parser logic against fixture HTML using JSDOM */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const html   = readFileSync('/home/user/mediaos-v2/fixture-tiktok.html', 'utf8');
const dom    = new JSDOM(html, { url: 'https://www.tiktok.com/search?q=serum+nam' });
const { document, location } = dom.window;

/* ── inline parser logic (same as tiktok-parser.js, minus chrome.*) ── */

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

function findCard(anchor) {
  let el = anchor;
  for (let i = 0; i < 12; i++) {
    el = el.parentElement;
    if (!el) break;
    const imgs  = el.querySelectorAll('img');
    const links = el.querySelectorAll('a[href*="/video/"]');
    if (imgs.length >= 1 && links.length === 1) return el;
    if (el.dataset && /search|video|item/.test(el.dataset.e2e || '')) return el;
  }
  return anchor.parentElement;
}

function extractStats(card) {
  if (!card) return {};
  const viewsEl    = card.querySelector('[data-e2e*="view"],[data-e2e="video-views"]');
  const likesEl    = card.querySelector('[data-e2e*="like"],[data-e2e="like-count"]');
  const commentsEl = card.querySelector('[data-e2e*="comment"],[data-e2e="comment-count"]');

  let views    = parseCount(viewsEl?.textContent);
  let likes    = parseCount(likesEl?.textContent);
  let comments = parseCount(commentsEl?.textContent);

  if (views === null && likes === null) {
    const numEls = Array.from(card.querySelectorAll('strong, span'))
      .map(el => ({ el, val: parseCount(el.textContent.trim()) }))
      .filter(x => x.val !== null && x.val > 0)
      .sort((a, b) => b.val - a.val);
    if (numEls.length >= 1) views    = numEls[0].val;
    if (numEls.length >= 2) likes    = numEls[1].val;
    if (numEls.length >= 3) comments = numEls[2].val;
  }
  return { views, likes, comments };
}

function parsePage() {
  const seen = new Set(), results = [];
  document.querySelectorAll('a[href*="/video/"]').forEach(anchor => {
    const url = absUrl(anchor.getAttribute('href'));
    if (!url) return;
    const m = url.match(/tiktok\.com\/@([^/?#]+)\/video\/(\d+)/);
    if (!m) return;
    const [, handle, videoId] = m;
    if (seen.has(videoId)) return;
    seen.add(videoId);
    const card = findCard(anchor);
    const { views, likes, comments } = extractStats(card);
    const statsAvailable = views !== null || likes !== null || comments !== null;
    results.push({ id: `tiktok:${videoId}`, platform: 'tiktok', url, handle, views, likes, comments, statsAvailable });
  });
  return results;
}

const results = parsePage();
console.log('=== TikTok Parser Test ===');
console.log('Cards found:', results.length);
results.forEach((r, i) => {
  console.log(`\nCard ${i+1}: ${r.id}`);
  console.log('  url:', r.url);
  console.log('  views:', r.views, '| likes:', r.likes, '| comments:', r.comments);
  console.log('  statsAvailable:', r.statsAvailable);
});

const allHaveId  = results.every(r => r.id.startsWith('tiktok:'));
const card1Stats = results[0]?.views === 2300000 && results[0]?.likes === 450000;
const card3Included = results.some(r => r.id === 'tiktok:7345678901234567892');

console.log('\n=== Assertions ===');
console.log('All have tiktok: prefix:', allHaveId ? 'PASS' : 'FAIL');
console.log('Card 1 stats parsed (2.3M views, 450K likes):', card1Stats ? 'PASS' : 'FAIL');
console.log('Card 3 (no stats) still included:', card3Included ? 'PASS' : 'FAIL');
console.log('Total cards (expect 3):', results.length === 3 ? 'PASS' : 'FAIL (got ' + results.length + ')');
