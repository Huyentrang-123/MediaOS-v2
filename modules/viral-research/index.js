/* ============================================================
   MediaOS — Viral Research: Module Entry
   ============================================================ */

'use strict';

const BACKEND_URL = 'http://localhost:3001';

/* Module-level state for API results */
let _apiResults  = [];
let _searchState = 'idle'; // 'idle' | 'loading' | 'done' | 'error'

/* Map backend response to renderVideoCard() format */
function apiVideoToCard(v) {
  const gr = v.stats?.growthRate;
  return {
    id:            v.id,
    platform:      v.platform,
    region:        v.region    || '',
    title:         v.caption   || '(Không có tiêu đề)',
    thumbnail:     v.thumbnail || '',
    creator:       v.creatorHandle || v.creator || '',
    postedDate:    v.postedAt  ? v.postedAt.slice(0, 10) : '',
    views:         v.stats?.views    || 0,
    likes:         v.stats?.likes    || 0,
    comments:      v.stats?.comments || 0,
    shares:        v.stats?.shares   || 0,
    viewsGrowth7d: gr ? parseFloat(gr) : null,
    viralScore:    v.viral?.score    || 0,
    tags:          v.hashtags        || [],
    url:           v.url             || '#'
  };
}

function renderResearch(container) {
  const fs = state.viralResearch;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">🔍 AI Viral Research Engine</div>
      <div class="page-subtitle">Nhập từ khóa — AI tự động phân tích, đánh giá và chọn lọc những video đáng nghiên cứu nhất trên TikTok và Facebook</div>
    </div>

    ${buildStatsBar()}
    ${buildFilterBar(fs)}

    <div class="section-header">
      <div class="section-title">
        🏆 Top video đáng nghiên cứu nhất
        <span class="count-badge" id="vrCount">–</span>
      </div>
      <div style="font-size:12px;color:var(--text-3)" id="vrAiLabel"></div>
    </div>

    <div class="vr-grid" id="vrGrid"></div>
  `;

  renderGrid();
  bindFilterEvents();
}

/* ---- Stats Bar ---- */
function buildStatsBar() {
  const total    = VR_DATA.length;
  const tiktok   = VR_DATA.filter(v => v.platform === 'tiktok').length;
  const fb       = VR_DATA.filter(v => v.platform === 'facebook').length;
  const topScore = Math.max(...VR_DATA.map(v => calculateViralScore(v, VR_DATA)));

  return `
    <div class="vr-stats-bar">
      <div class="vr-stat-card">
        <div class="vr-stat-icon">📊</div>
        <div>
          <div class="vr-stat-value">${total}</div>
          <div class="vr-stat-label">Video đang theo dõi</div>
        </div>
      </div>
      <div class="vr-stat-card">
        <div class="vr-stat-icon">♪</div>
        <div>
          <div class="vr-stat-value">${tiktok}</div>
          <div class="vr-stat-label">Video TikTok</div>
        </div>
      </div>
      <div class="vr-stat-card">
        <div class="vr-stat-icon">f</div>
        <div>
          <div class="vr-stat-value">${fb}</div>
          <div class="vr-stat-label">Video Facebook</div>
        </div>
      </div>
      <div class="vr-stat-card">
        <div class="vr-stat-icon">🔥</div>
        <div>
          <div class="vr-stat-value">${topScore}/100</div>
          <div class="vr-stat-label">Viral score cao nhất</div>
        </div>
      </div>
    </div>`;
}

/* ---- Filter Bar ---- */
function buildFilterBar(fs) {
  const platformChips = CONFIG.platforms.map(p => `
    <button class="chip ${fs.platform === p.id ? 'active' : ''}" data-platform="${p.id}">
      ${p.id === 'tiktok' ? '♪ ' : p.id === 'facebook' ? 'f ' : ''}${p.label}
    </button>`).join('');

  const regionChips = CONFIG.regions.map(r => `
    <button class="chip ${fs.region === r.id ? 'active' : ''}" data-region="${r.id}">
      ${r.label}
    </button>`).join('');

  return `
    <div class="vr-filters">
      <div class="vr-filter-row">
        <div class="vr-search-box">
          <input type="text" id="vrKeyword" class="vr-search-input"
            placeholder="Nhập từ khóa: serum viral, kem nám, before after skincare, 美白精华..."
            value="${esc(fs.keyword)}">
          <button class="btn btn-primary" id="vrSearchBtn">🔍 Phân tích</button>
        </div>
      </div>
      <div class="vr-filter-row">
        <span class="vr-filter-label">NỀN TẢNG</span>
        <div class="chip-group" id="platformChips">${platformChips}</div>
      </div>
      <div class="vr-filter-row">
        <span class="vr-filter-label">KHU VỰC</span>
        <div class="chip-group" id="regionChips">${regionChips}</div>
      </div>
    </div>`;
}

/* ---- Grid Render ---- */
async function renderGrid(triggerSearch = false) {
  const fs   = state.viralResearch;
  const grid = $('#vrGrid');
  if (!grid) return;

  /* No keyword → reset, show prompt */
  if (!fs.keyword || !fs.keyword.trim()) {
    _apiResults  = [];
    _searchState = 'idle';
    _updateGridMeta(0, 0);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🤖</div>
        <div class="empty-title">Nhập từ khóa để AI bắt đầu phân tích</div>
        <div class="empty-desc">Gõ từ khóa mỹ phẩm bạn muốn nghiên cứu, chọn nền tảng và khu vực, rồi bấm Phân tích.</div>
      </div>`;
    return;
  }

  /* Ignore chip changes while a fetch is in progress */
  if (_searchState === 'loading' && !triggerSearch) return;

  /* Fetch from backend when explicitly triggered */
  if (triggerSearch) {
    if (_searchState === 'loading') return;
    _searchState = 'loading';
    _apiResults  = [];

    /* Phase 1: Facebook connector not yet implemented — fall back to TikTok */
    const platform = (fs.platform === 'all' || fs.platform === 'facebook')
      ? 'tiktok' : fs.platform;

    const searchBtn = $('#vrSearchBtn');
    if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = '⏳ Đang phân tích...'; }

    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⏳</div>
        <div class="empty-title">MediaOS đang phân tích video TikTok...</div>
        <div class="empty-desc">Đang thu thập và xếp hạng video với từ khóa <strong>${esc(fs.keyword.trim())}</strong></div>
      </div>`;

    try {
      const params = new URLSearchParams({
        keyword:  fs.keyword.trim(),
        platform,
        region:   fs.region
      });
      const resp = await fetch(`${BACKEND_URL}/api/research?${params}`);
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      const json   = await resp.json();
      _apiResults  = (json.data || []).map(apiVideoToCard);
      _searchState = 'done';
    } catch (err) {
      console.error('[VR] Backend error:', err);
      _searchState = 'error';
      _updateGridMeta(0, 0);
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Không thể kết nối đến backend</div>
          <div class="empty-desc">
            ${esc(err.message)}<br>
            Đảm bảo backend đang chạy: <code>npm run dev</code>
          </div>
        </div>`;
    } finally {
      if (searchBtn) { searchBtn.disabled = false; searchBtn.textContent = '🔍 Phân tích'; }
    }

    if (_searchState === 'error') return;
  }

  /* Keyword present but no search yet */
  if (_searchState === 'idle') {
    _updateGridMeta(0, 0);
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Bấm "Phân tích" để bắt đầu</div>
        <div class="empty-desc">AI sẽ tìm kiếm và phân tích video với từ khóa <strong>${esc(fs.keyword)}</strong></div>
      </div>`;
    return;
  }

  /* Keep error state visible when chips change (don't replace with nothing) */
  if (_searchState === 'error') {
    _updateGridMeta(0, 0);
    return;
  }

  /* _searchState === 'done' — client-side filter on cached results */
  let results = _apiResults.slice();
  if (fs.platform !== 'all') {
    results = results.filter(v => v.platform === fs.platform);
  }
  if (fs.region !== 'global') {
    results = results.filter(v => v.region === fs.region);
  }

  _updateGridMeta(results.length, _apiResults.length);

  if (results.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Không tìm thấy video phù hợp</div>
        <div class="empty-desc">Hãy thử từ khóa hoặc khu vực khác.</div>
      </div>`;
    return;
  }

  grid.innerHTML = results.map(v => renderVideoCard(v)).join('');
  attachCardHandlers(grid);
}

function _updateGridMeta(shown, total) {
  const countEl = $('#vrCount');
  const aiLabel = $('#vrAiLabel');
  if (countEl) countEl.textContent = shown > 0 ? shown : '–';
  if (aiLabel) {
    aiLabel.textContent = total > 0
      ? `AI đã phân tích ${total} video — hiển thị ${shown} video đáng nghiên cứu nhất`
      : '';
  }
}

/* ---- Events ---- */
function bindFilterEvents() {
  const doSearch = () => {
    const input = $('#vrKeyword');
    if (input) {
      state.viralResearch.keyword = input.value;
      saveState();
    }
    renderGrid(true);
  };

  const searchBtn = $('#vrSearchBtn');
  if (searchBtn) searchBtn.addEventListener('click', doSearch);

  const input = $('#vrKeyword');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });
  }

  /* Platform chips — filter cached results immediately, no re-fetch */
  $$('#platformChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.viralResearch.platform = chip.dataset.platform;
      $$('#platformChips .chip').forEach(c =>
        c.classList.toggle('active', c.dataset.platform === chip.dataset.platform)
      );
      renderGrid(false);
    });
  });

  /* Region chips — filter cached results immediately, no re-fetch */
  $$('#regionChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.viralResearch.region = chip.dataset.region;
      $$('#regionChips .chip').forEach(c =>
        c.classList.toggle('active', c.dataset.region === chip.dataset.region)
      );
      renderGrid(false);
    });
  });
}
