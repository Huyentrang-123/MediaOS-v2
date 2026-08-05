/* MediaOS Extension — Popup Controller */
'use strict';

const MEDIAOS_ORIGINS = ['http://localhost:3001', 'http://localhost:3000'];

const $ = id => document.getElementById(id);

let currentTab  = null;
let platform    = null; /* 'tiktok' | 'facebook' | null */

/* ── Detect current tab ─────────────────────────────── */

function detectPlatform(url) {
  if (!url) return null;
  if (url.includes('tiktok.com/search'))                     return 'tiktok';
  if (url.includes('facebook.com/search/videos') ||
      url.includes('facebook.com/watch'))                    return 'facebook';
  return null;
}

function isMediaOS(url) {
  if (!url) return false;
  return MEDIAOS_ORIGINS.some(o => url.startsWith(o));
}

/* ── UI helpers ─────────────────────────────────────── */

function setStatus(msg, cls) {
  const el  = $('statusBar');
  el.textContent = msg;
  el.className   = 'status-bar ' + cls;
}

function setCollectEnabled(enabled) {
  $('collectBtn').disabled = !enabled;
}

/* ── Pending badge ──────────────────────────────────── */

function refreshPendingBadge() {
  chrome.runtime.sendMessage({ type: 'peekPendingResults' }, resp => {
    if (chrome.runtime.lastError || !resp) return;
    const count = (resp.videos || []).length;
    const bar   = $('pendingBar');
    if (count > 0) {
      bar.style.display   = 'flex';
      $('pendingLabel').textContent = count + ' video đang chờ trong MediaOS';
    } else {
      bar.style.display   = 'none';
    }
  });
}

/* ── Collect ────────────────────────────────────────── */

async function collect() {
  if (!currentTab || !platform) return;

  setCollectEnabled(false);
  setStatus('Đang đọc kết quả đang hiển thị...', 'status-collecting');

  let resp;
  try {
    resp = await chrome.tabs.sendMessage(currentTab.id, { action: 'collect' });
  } catch (err) {
    setStatus('Không thể đọc trang. Hãy tải lại trang tìm kiếm.', 'status-error');
    setCollectEnabled(true);
    return;
  }

  if (!resp || !resp.ok) {
    const msg = resp?.error || 'Không đọc được kết quả từ giao diện hiện tại. Cấu trúc trang có thể đã thay đổi.';
    setStatus(msg, 'status-error');
    setCollectEnabled(true);
    return;
  }

  const videos = resp.videos || [];

  if (videos.length === 0) {
    setStatus('Không tìm thấy video nào trên trang. Thử cuộn xuống thêm.', 'status-unsupported');
    setCollectEnabled(true);
    return;
  }

  /* Store in background */
  chrome.runtime.sendMessage({ type: 'storePendingResults', videos, meta: { sourceUrl: resp.url, platform } }, storeResp => {
    const total = storeResp?.total || videos.length;
    setStatus(`✅ Đã thu thập ${total} video. Bấm "Mở MediaOS" để xem.`, 'status-done');
    setCollectEnabled(true);
    refreshPendingBadge();
  });
}

/* ── Open MediaOS ───────────────────────────────────── */

async function openMediaOS() {
  const tabs   = await chrome.tabs.query({});
  const existing = tabs.find(t => isMediaOS(t.url || ''));

  if (existing) {
    /* Focus and navigate to import hash */
    const base = (existing.url || '').split('#')[0];
    await chrome.tabs.update(existing.id, { active: true, url: base + '#research/import' });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: MEDIAOS_ORIGINS[0] + '/#research/import' });
  }
  window.close();
}

/* ── Clear pending ──────────────────────────────────── */

$('clearPendingBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'clearPending' }, () => refreshPendingBadge());
});

/* ── Init ───────────────────────────────────────────── */

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab  = tab;
  platform    = detectPlatform(tab?.url || '');

  if (platform === 'tiktok') {
    setStatus('TikTok Search — sẵn sàng thu thập kết quả.', 'status-supported');
    setCollectEnabled(true);
  } else if (platform === 'facebook') {
    setStatus('Facebook Videos — sẵn sàng thu thập kết quả.', 'status-supported');
    setCollectEnabled(true);
  } else if (isMediaOS(tab?.url || '')) {
    setStatus('MediaOS đang mở — thu thập từ TikTok/Facebook trước.', 'status-unsupported');
  } else {
    setStatus('Mở trang TikTok Search hoặc Facebook Videos để bắt đầu.', 'status-unsupported');
  }

  refreshPendingBadge();
}

$('collectBtn').addEventListener('click', collect);
$('openMediaOSBtn').addEventListener('click', openMediaOS);

init();
