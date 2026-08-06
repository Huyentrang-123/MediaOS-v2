/* Extension messaging test — simulates chrome.storage + onMessage handler */

/* ── Mock chrome API ─────────────────────────────────────── */
let _store = {};

const chrome = {
  storage: {
    local: {
      get(keys, cb) {
        const result = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => { result[k] = _store[k]; });
        cb(result);
      },
      set(obj, cb) { Object.assign(_store, obj); if (cb) cb(); },
      remove(keys, cb) {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => delete _store[k]);
        if (cb) cb();
      }
    }
  },
  runtime: {
    lastError: null,
    onMessage: {
      _listeners: [],
      addListener(fn) { this._listeners.push(fn); },
      _dispatch(msg) {
        return new Promise(resolve => {
          for (const fn of this._listeners) {
            let resolved = false;
            const sendResponse = (resp) => { if (!resolved) { resolved = true; resolve(resp); } };
            const ret = fn(msg, {}, sendResponse);
            if (ret === true) return; /* async */
          }
        });
      }
    }
  }
};

/* ── Load background.js logic (inlined) ─────────────────── */
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
});

/* ── Tests ───────────────────────────────────────────────── */
let pass = 0, fail = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) console.log(`    got: ${JSON.stringify(got)}, expected: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

const testVideos = [
  { id: 'tiktok:111', platform: 'tiktok', views: 1000000, statsAvailable: true },
  { id: 'tiktok:222', platform: 'tiktok', views: 500000,  statsAvailable: true },
  { id: 'tiktok:333', platform: 'tiktok', views: null,    statsAvailable: false }
];

const dispatch = msg => chrome.runtime.onMessage._dispatch(msg);

console.log('\n=== Extension Messaging Tests ===');

/* Test 1: Store videos */
const r1 = await dispatch({ type: 'storePendingResults', videos: testVideos, meta: { sourceUrl: 'https://tiktok.com/search' } });
check('storePendingResults: ok=true', r1.ok, true);
check('storePendingResults: total=3', r1.total, 3);

/* Test 2: Peek (does not clear) */
const r2 = await dispatch({ type: 'peekPendingResults' });
check('peekPendingResults: ok=true', r2.ok, true);
check('peekPendingResults: length=3', r2.videos.length, 3);

/* Test 3: Peek again — still there */
const r3 = await dispatch({ type: 'peekPendingResults' });
check('peek again: still 3', r3.videos.length, 3);

/* Test 4: Get (clears after) */
const r4 = await dispatch({ type: 'getPendingResults' });
check('getPendingResults: ok=true', r4.ok, true);
check('getPendingResults: length=3', r4.videos.length, 3);

/* Test 5: Get again — should be empty */
const r5 = await dispatch({ type: 'getPendingResults' });
check('getPendingResults after clear: length=0', r5.videos.length, 0);

/* Test 6: Dedup — store same videos again, then store overlap */
await dispatch({ type: 'storePendingResults', videos: testVideos });
const r6 = await dispatch({ type: 'storePendingResults', videos: [
  { id: 'tiktok:111', platform: 'tiktok', views: 999 }, /* dup — should be ignored */
  { id: 'tiktok:444', platform: 'tiktok', views: 200000, statsAvailable: true }
] });
check('dedup: total=4 (not 5)', r6.total, 4);
await dispatch({ type: 'clearPending' });

/* Test 7: Cap at 100 */
const bulk = Array.from({ length: 110 }, (_, i) => ({ id: `tiktok:${i}`, platform: 'tiktok' }));
const r7 = await dispatch({ type: 'storePendingResults', videos: bulk });
check('cap at 100: total=100', r7.total, 100);
await dispatch({ type: 'clearPending' });

console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
