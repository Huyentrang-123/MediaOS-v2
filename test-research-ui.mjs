/* Research UI tests — covers computeResearchRank, filter, badges, dedup, NaN */

/* ── Inline copies of viral-score logic ─────────────────── */

const SCORE_WEIGHTS = { shareRate: 0.35, commentRate: 0.30, views: 0.25, viewsPerHour: 0.10 };

function _normalize(val, arr) {
  const min = Math.min(...arr), max = Math.max(...arr);
  if (max === min) return 0.5;
  return (val - min) / (max - min);
}

function scoreVideos(videos) {
  if (!videos || !videos.length) return videos || [];
  const scorable = videos.filter(v => v.statsAvailable);
  const noStats  = videos.filter(v => !v.statsAvailable);

  const withRates = scorable.map(v => {
    const views    = v.views || 0;
    const hoursOld = v.postedAt ? Math.max(1, (Date.now() - new Date(v.postedAt).getTime()) / 3600000) : null;
    const vph      = (hoursOld && views) ? views / hoursOld : 0;
    return { ...v, _sr: views > 0 && v.shares   != null ? v.shares   / views : 0,
                     _cr: views > 0 && v.comments != null ? v.comments / views : 0,
                     _v:  views, _vph: v.viewsPerHour || vph };
  });

  const scored = withRates.length ? (() => {
    const srs  = withRates.map(v => v._sr);
    const crs  = withRates.map(v => v._cr);
    const vs   = withRates.map(v => v._v);
    const vphs = withRates.map(v => v._vph);
    return withRates.map(v => {
      const score =
        SCORE_WEIGHTS.shareRate    * _normalize(v._sr,  srs)  +
        SCORE_WEIGHTS.commentRate  * _normalize(v._cr,  crs)  +
        SCORE_WEIGHTS.views        * _normalize(v._v,   vs)   +
        SCORE_WEIGHTS.viewsPerHour * _normalize(v._vph, vphs);
      const r = { ...v, viralScore: Math.round(score * 100) };
      delete r._sr; delete r._cr; delete r._v; delete r._vph;
      return r;
    });
  })() : [];

  const nulled = noStats.map(v => ({ ...v, viralScore: null }));
  return scored.concat(nulled);
}

function computeResearchRank(videos, prioritizeComments) {
  if (!videos || !videos.length) return videos || [];

  const W = prioritizeComments
    ? { v: 0.35, c: 0.50, l: 0.10, f: 0.05 }
    : { v: 0.45, c: 0.35, l: 0.15, f: 0.05 };

  const now = Date.now();
  const raw = videos.map(v => {
    const ageH  = v.postedAt ? (now - new Date(v.postedAt).getTime()) / 3600000 : null;
    const fresh = ageH != null ? Math.max(0, 168 - ageH) : null;
    return {
      v: v.views    != null ? Math.log1p(v.views)    : null,
      c: v.comments != null ? Math.log1p(v.comments) : null,
      l: v.likes    != null ? Math.log1p(v.likes)    : null,
      f: fresh      != null ? Math.log1p(fresh)      : null
    };
  });

  function mmArr(arr, key) {
    const vals = arr.map(x => x[key]).filter(x => x != null);
    if (!vals.length) return arr.map(() => null);
    const min = Math.min(...vals), max = Math.max(...vals), range = max - min;
    return arr.map(x => x[key] == null ? null : (range === 0 ? 0.5 : (x[key] - min) / range));
  }

  const nv = mmArr(raw, 'v'), nc = mmArr(raw, 'c'), nl = mmArr(raw, 'l'), nf = mmArr(raw, 'f');
  const bW = {
    v: nv.some(x => x != null) ? W.v : 0,
    c: nc.some(x => x != null) ? W.c : 0,
    l: nl.some(x => x != null) ? W.l : 0,
    f: nf.some(x => x != null) ? W.f : 0
  };

  return videos.map((v, i) => {
    const pvW = {
      v: (bW.v > 0 && nv[i] != null) ? bW.v : 0,
      c: (bW.c > 0 && nc[i] != null) ? bW.c : 0,
      l: (bW.l > 0 && nl[i] != null) ? bW.l : 0,
      f: (bW.f > 0 && nf[i] != null) ? bW.f : 0
    };
    const pvTotal = pvW.v + pvW.c + pvW.l + pvW.f;
    if (pvTotal === 0) return { ...v, researchRank: null };

    let rank = 0;
    if (pvW.v > 0) rank += (pvW.v / pvTotal) * nv[i];
    if (pvW.c > 0) rank += (pvW.c / pvTotal) * nc[i];
    if (pvW.l > 0) rank += (pvW.l / pvTotal) * nl[i];
    if (pvW.f > 0) rank += (pvW.f / pvTotal) * nf[i];
    if (isNaN(rank)) rank = 0;
    return { ...v, researchRank: Math.round(rank * 100) };
  });
}

function computeBadges(videos) {
  const vVals = videos.filter(v => v.views    != null).map(v => v.views).sort((a,b) => b-a);
  const cVals = videos.filter(v => v.comments != null).map(v => v.comments).sort((a,b) => b-a);
  const vTopN = Math.ceil(vVals.length * 0.20);
  const cTopN = Math.ceil(cVals.length * 0.20);
  const vThresh = vTopN > 0 ? vVals[vTopN - 1] : null;
  const cThresh = cTopN > 0 ? cVals[cTopN - 1] : null;
  return videos.map(v => ({
    ...v,
    _badgeViewTop: vThresh != null && v.views    != null && v.views    >= vThresh,
    _badgeCmtTop:  cThresh != null && v.comments != null && v.comments >= cThresh
  }));
}

function applyFilters(videos, opts) {
  const { minViews=0, minCmt=0, onlyStats=false, hideDup=false } = opts;
  const seen = {};
  return videos.filter(v => {
    if (minViews > 0 && (v.views    == null || v.views    < minViews)) return false;
    if (minCmt   > 0 && (v.comments == null || v.comments < minCmt))   return false;
    if (onlyStats && !v.statsAvailable) return false;
    if (hideDup) {
      const key = (v.caption || '').trim().toLowerCase();
      if (key && seen[key]) return false;
      if (key) seen[key] = true;
    }
    return true;
  });
}

/* ── 8-video fixture ─────────────────────────────────────── */

const now = Date.now();
const h = 3600000;

const fixtures = [
  /* 1. High everything, very recent — should rank #1 */
  { id: 'tt:001', platform: 'tiktok',   url: 'https://www.tiktok.com/@a/video/001',
    views: 5000000, likes: 200000, comments: 15000, shares: 30000,
    postedAt: new Date(now - 3*h).toISOString(), statsAvailable: true,
    caption: 'Serum nám hàng đầu', creator: '@creator1' },

  /* 2. High views, moderate engagement */
  { id: 'tt:002', platform: 'tiktok',   url: 'https://www.tiktok.com/@b/video/002',
    views: 2000000, likes: 80000, comments: 5000, shares: null,
    postedAt: new Date(now - 24*h).toISOString(), statsAvailable: true,
    caption: 'Review kem chống nắng', creator: '@creator2' },

  /* 3. No stats — viralScore and researchRank must be null */
  { id: 'fb:003', platform: 'facebook', url: 'https://www.facebook.com/video/003',
    views: null, likes: null, comments: null, shares: null,
    postedAt: null, statsAvailable: false,
    caption: 'Video FB không có stats', creator: 'Page FB' },

  /* 4. Low views but very high comment rate */
  { id: 'tt:004', platform: 'tiktok',   url: 'https://www.tiktok.com/@d/video/004',
    views: 50000, likes: 3000, comments: 2500, shares: 500,
    postedAt: new Date(now - 10*h).toISOString(), statsAvailable: true,
    caption: 'Tip làm đẹp cực hay', creator: '@creator4' },

  /* 5. Mid range */
  { id: 'tt:005', platform: 'tiktok',   url: 'https://www.tiktok.com/@e/video/005',
    views: 300000, likes: 12000, comments: 800, shares: 200,
    postedAt: new Date(now - 48*h).toISOString(), statsAvailable: true,
    caption: 'Before after serum', creator: '@creator5' },

  /* 6. Very low — below 100K views threshold */
  { id: 'tt:006', platform: 'tiktok',   url: 'https://www.tiktok.com/@f/video/006',
    views: 5000, likes: 100, comments: 20, shares: 5,
    postedAt: new Date(now - 72*h).toISOString(), statsAvailable: true,
    caption: 'Nội dung ít tương tác', creator: '@creator6' },

  /* 7. Views only (no comments/likes) — tests weight redistribution */
  { id: 'fb:007', platform: 'facebook', url: 'https://www.facebook.com/video/007',
    views: 800000, likes: null, comments: null, shares: null,
    postedAt: new Date(now - 36*h).toISOString(), statsAvailable: true,
    caption: 'FB video chỉ có views', creator: 'Creator7' },

  /* 8. Same caption as #5 — tests hideDup filter */
  { id: 'tt:008', platform: 'tiktok',   url: 'https://www.tiktok.com/@h/video/008',
    views: 150000, likes: 6000, comments: 400, shares: 100,
    postedAt: new Date(now - 60*h).toISOString(), statsAvailable: true,
    caption: 'Before after serum', creator: '@creator8' }
];

/* ── Test runner ─────────────────────────────────────────── */

let pass = 0, fail = 0;

function check(label, got, expected, extra) {
  if (got === expected) {
    console.log('  PASS:', label, '→', got, extra || '');
    pass++;
  } else {
    console.log('  FAIL:', label, '→ got', got, 'expected', expected, extra || '');
    fail++;
  }
}

function checkTrue(label, condition, note) {
  check(label, !!condition, true, note || '');
}

console.log('\n=== Test 1: NaN prevention — researchRank must never be NaN ===');
const ranked = computeResearchRank(scoreVideos(fixtures), false);
ranked.forEach(v => {
  checkTrue('No NaN rank for ' + v.id, v.researchRank == null || !isNaN(v.researchRank));
});

console.log('\n=== Test 2: viralScore null for !statsAvailable ===');
const scored = scoreVideos(fixtures);
const noStatVid = scored.find(v => v.id === 'fb:003');
check('fb:003 viralScore', noStatVid.viralScore, null);

console.log('\n=== Test 3: researchRank null for no-stats video ===');
const noStatRanked = ranked.find(v => v.id === 'fb:003');
check('fb:003 researchRank', noStatRanked.researchRank, null);

console.log('\n=== Test 4: Sort by researchRank (default "relevant") — top video first ===');
const sortedByRank = ranked.filter(v => v.researchRank != null).sort((a,b) => b.researchRank - a.researchRank);
checkTrue('First by rank is tt:001', sortedByRank[0].id === 'tt:001', 'rank=' + sortedByRank[0].researchRank);

console.log('\n=== Test 5: Sort by views — tt:001 (5M) first ===');
const sortedByViews = ranked.slice().sort((a,b) => (b.views||0) - (a.views||0));
check('First by views', sortedByViews[0].id, 'tt:001');

console.log('\n=== Test 6: Filter by views > 100K ===');
const filtered100k = applyFilters(ranked, { minViews: 100000 });
checkTrue('tt:006 (5K views) excluded', !filtered100k.find(v => v.id === 'tt:006'));
checkTrue('tt:004 (50K views) excluded', !filtered100k.find(v => v.id === 'tt:004'));
checkTrue('tt:001 (5M views) included', !!filtered100k.find(v => v.id === 'tt:001'));
check('Filter count > 100K views', filtered100k.length, 5);

console.log('\n=== Test 7: Filter by comments > 500 ===');
const filteredCmt = applyFilters(ranked, { minCmt: 500 });
checkTrue('tt:006 (20 cmt) excluded',  !filteredCmt.find(v => v.id === 'tt:006'));
checkTrue('tt:008 (400 cmt) excluded', !filteredCmt.find(v => v.id === 'tt:008'));
checkTrue('fb:007 (null cmt) excluded',!filteredCmt.find(v => v.id === 'fb:007'));
checkTrue('tt:001 (15K cmt) included', !!filteredCmt.find(v => v.id === 'tt:001'));
checkTrue('tt:004 (2.5K cmt) included',!!filteredCmt.find(v => v.id === 'tt:004'));

console.log('\n=== Test 8: Filter onlyStats — only fb:003 excluded ===');
const filteredStats = applyFilters(ranked, { onlyStats: true });
checkTrue('fb:003 excluded by onlyStats', !filteredStats.find(v => v.id === 'fb:003'));
check('onlyStats count', filteredStats.length, fixtures.length - 1);

console.log('\n=== Test 9: Batch dedup — adding same videos again keeps same count ===');
const batch1 = ranked;
const existingIds = {};
batch1.forEach(v => { existingIds[v.id] = true; });
const batch2 = fixtures.slice(0, 3); /* first 3 are already in batch1 */
const added  = batch2.filter(v => !existingIds[v.id]);
check('Added count from duplicate batch', added.length, 0);

console.log('\n=== Test 10: Badge percentile — top 20% of 8 = top 2 by views ===');
const badged = computeBadges(ranked);
/* Top 2 by views: tt:001 (5M) and tt:002 (2M) */
const b001 = badged.find(v => v.id === 'tt:001');
const b002 = badged.find(v => v.id === 'tt:002');
const b006 = badged.find(v => v.id === 'tt:006'); /* 5K views — not top 20% */
checkTrue('tt:001 gets view badge', b001._badgeViewTop);
checkTrue('tt:002 gets view badge', b002._badgeViewTop);
checkTrue('tt:006 no view badge',  !b006._badgeViewTop);

console.log('\n=== Test 11: Comment badge — top 20% of 6 with comments = top 2 (15K + 5K) ===');
/* 6 videos have comments: 15K,5K,2.5K,800,400,20. ceil(6*0.2)=2. threshold=5K (tt:002). */
const bc001 = badged.find(v => v.id === 'tt:001');
const bc002 = badged.find(v => v.id === 'tt:002');
const bc004 = badged.find(v => v.id === 'tt:004'); /* 2500 < threshold 5000 */
const bc006 = badged.find(v => v.id === 'tt:006'); /* 20 */
checkTrue('tt:001 gets comment badge', bc001._badgeCmtTop);
checkTrue('tt:002 gets comment badge (threshold=5K)', bc002._badgeCmtTop);
checkTrue('tt:004 no comment badge (2500 < threshold)', !bc004._badgeCmtTop);
checkTrue('tt:006 no comment badge',  !bc006._badgeCmtTop);

console.log('\n=== Test 12: hideDup filter — tt:008 hidden (same caption as tt:005) ===');
const filteredDup = applyFilters(ranked, { hideDup: true });
const has005 = !!filteredDup.find(v => v.id === 'tt:005');
const has008 = !!filteredDup.find(v => v.id === 'tt:008');
checkTrue('tt:005 kept (first with caption)', has005);
checkTrue('tt:008 hidden (duplicate caption)', !has008);

console.log('\n=== Test 13: Prioritize comments changes ranking ===');
const rankedDefault = computeResearchRank(scored, false);
const rankedPriCmt  = computeResearchRank(scored, true);
/* tt:004 has very high comments/views ratio — should rank higher with priCmt */
const rank004Default = rankedDefault.find(v => v.id === 'tt:004').researchRank;
const rank007Default = rankedDefault.find(v => v.id === 'fb:007').researchRank;
const rank004PriCmt  = rankedPriCmt.find( v => v.id === 'tt:004').researchRank;
const rank007PriCmt  = rankedPriCmt.find( v => v.id === 'fb:007').researchRank;
/* With priCmt, tt:004 (lots of comments) should gain rank relative to fb:007 (only views) */
const defaultDiff = rank004Default - rank007Default;
const priCmtDiff  = rank004PriCmt  - rank007PriCmt;
checkTrue('tt:004 gains on fb:007 when comments prioritised', priCmtDiff > defaultDiff,
  'default diff=' + defaultDiff + ' priCmt diff=' + priCmtDiff);

console.log('\n=== Test 14: Weight redistribution — fb:007 (views only) gets rank != null ===');
const fb007 = ranked.find(v => v.id === 'fb:007');
checkTrue('fb:007 researchRank not null (weight redistributed to views)', fb007.researchRank != null);
checkTrue('fb:007 researchRank not NaN', !isNaN(fb007.researchRank));

console.log('\n=== Test 15: All video URLs start with http ===');
fixtures.forEach(v => {
  checkTrue(v.id + ' URL starts with http', v.url.startsWith('http'));
});

console.log('\n─────────────────────────────────');
console.log('TOTAL:', pass + fail, '  PASS:', pass, '  FAIL:', fail);
if (fail > 0) process.exit(1);
