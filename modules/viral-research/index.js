/* ============================================================
   MediaOS — Viral Research: Module Entry
   ============================================================ */

'use strict';

const BACKEND_URL = '';
const SESSION_MAX = 50;

/* ---- Session state ---- */
let _apiResults        = [];
let _searchState       = 'idle'; // 'idle' | 'loading' | 'done' | 'error'
let _fallback          = false;
let _hasMore           = false;
let _nextOffset        = null;
let _queryVariants     = [];   // allVariants from backend response
let _variantIndex      = 0;    // which variant is currently active
let _currentQuery      = null; // localized query being paginated
let _seenIds           = new Set();
let _totalAnalyzed     = 0;
let _isLoadingMore     = false;
let _isExpandingSearch = false;

function _resetSearchState() {
  _apiResults        = [];
  _searchState       = 'idle';
  _fallback          = false;
  _hasMore           = false;
  _nextOffset        = null;
  _queryVariants     = [];
  _variantIndex      = 0;
  _currentQuery      = null;
  _seenIds           = new Set();
  _totalAnalyzed     = 0;
  _isLoadingMore     = false;
  _isExpandingSearch = false;
}

/* Map backend response item to renderVideoCard() format */
function apiVideoToCard(v) {
  const gr = v.stats?.growthRate;
  return {
    id:            v.id,
    platform:      v.platform,
    region:        v.region         || '',
    title:         v.caption        || '(Không có tiêu đề)',
    thumbnail:     v.thumbnail      || '',
    creator:       v.creatorHandle  || v.creator || '',
    postedDate:    v.postedAt       ? v.postedAt.slice(0, 10) : '',
    views:         v.stats?.views    || 0,
    likes:         v.stats?.likes    || 0,
    comments:      v.stats?.comments || 0,
    shares:        v.stats?.shares   || 0,
    viewsGrowth7d: gr ? parseFloat(gr) : null,
    viralScore:    v.viral?.score    || 0,
    tags:          v.hashtags        || [],
    url:           v.url             || '#',
    matchedQuery:  v.matchedQuery    || '',
    _reference:    v._reference      || false
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
  return `
    <div class="vr-stats-bar">
      <div class="vr-stat-card">
        <div class="vr-stat-icon">📊</div>
        <div>
          <div class="vr-stat-value" id="vrStatTotal">0</div>
          <div class="vr-stat-label">Video đang theo dõi</div>
        </div>
      </div>
      <div class="vr-stat-card">
        <div class="vr-stat-icon">♪</div>
        <div>
          <div class="vr-stat-value" id="vrStatTiktok">0</div>
          <div class="vr-stat-label">TikTok / Douyin</div>
        </div>
      </div>
      <div class="vr-stat-card">
        <div class="vr-stat-icon">f</div>
        <div>
          <div class="vr-stat-value" id="vrStatFb">0</div>
          <div class="vr-stat-label">Video Facebook</div>
        </div>
      </div>
      <div class="vr-stat-card">
        <div class="vr-stat-icon">🔥</div>
        <div>
          <div class="vr-stat-value" id="vrStatTopScore">–</div>
          <div class="vr-stat-label">Viral score cao nhất</div>
        </div>
      </div>
    </div>`;
}

function _updateStatsBar() {
  const total    = _apiResults.length;
  const shortVid = _apiResults.filter(v => v.platform === 'tiktok' || v.platform === 'douyin').length;
  const fb       = _apiResults.filter(v => v.platform === 'facebook').length;
  const topScore = total > 0 ? Math.max(..._apiResults.map(v => v.viralScore || 0)) : 0;

  const set = (id, val) => { const el = $(`#${id}`); if (el) el.textContent = val; };
  set('vrStatTotal',    total);
  set('vrStatTiktok',   shortVid);
  set('vrStatFb',       fb);
  set('vrStatTopScore', total > 0 ? `${topScore}/100` : '–');
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

/* ---- Load-More Bar ---- */
function _buildLoadMoreBar() {
  const remaining = SESSION_MAX - _apiResults.length;
  const variantsLeft = _queryVariants.length - 1 - _variantIndex;
  return `
    <div id="vrLoadMoreBar" style="grid-column:1/-1;text-align:center;padding:16px 0 8px">
      <div id="vrLoadStats" style="font-size:12px;color:var(--text-3);margin-bottom:10px">
        Đã tải <strong>${_apiResults.length}</strong>/${SESSION_MAX} video trong phiên này
        ${variantsLeft > 0 ? `· còn ${variantsLeft} biến thể từ khóa` : ''}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button id="vrLoadMoreBtn" class="btn btn-secondary" style="font-size:13px">
          📥 Xem tiếp
        </button>
        <button id="vrExpandBtn" class="btn btn-outline" style="font-size:13px">
          🔍 Tìm thêm gợi ý
        </button>
      </div>
      <div id="vrLoadError" style="display:none;margin-top:8px;font-size:13px;color:var(--color-error,#e74c3c)"></div>
    </div>`;
}

function _updateLoadMoreButtons() {
  const loadBtn   = $('#vrLoadMoreBtn');
  const expandBtn = $('#vrExpandBtn');
  const statsEl   = $('#vrLoadStats');
  const barEl     = $('#vrLoadMoreBar');

  if (!loadBtn || !expandBtn) return;

  const atMax        = _apiResults.length >= SESSION_MAX;
  const noMorePages  = !_hasMore || _nextOffset === null;
  const noMoreVariants = _variantIndex >= _queryVariants.length - 1;

  if (atMax) {
    if (statsEl) {
      statsEl.innerHTML = `Đã đạt giới hạn <strong>${SESSION_MAX}</strong> video cho phiên tìm kiếm này.`;
    }
    loadBtn.style.display   = 'none';
    expandBtn.style.display = 'none';
    return;
  }

  const variantsLeft = _queryVariants.length - 1 - _variantIndex;
  if (statsEl) {
    statsEl.innerHTML = `Đã tải <strong>${_apiResults.length}</strong>/${SESSION_MAX} video trong phiên này`
      + (variantsLeft > 0 ? ` · còn ${variantsLeft} biến thể từ khóa` : '');
  }

  loadBtn.disabled   = _isLoadingMore   || noMorePages;
  expandBtn.disabled = _isExpandingSearch || noMoreVariants;

  loadBtn.textContent   = _isLoadingMore     ? '⏳ Đang tải...'     : '📥 Xem tiếp';
  expandBtn.textContent = _isExpandingSearch ? '⏳ Đang tìm...'     : '🔍 Tìm thêm gợi ý';
}

function _bindLoadMoreEvents() {
  const loadBtn   = $('#vrLoadMoreBtn');
  const expandBtn = $('#vrExpandBtn');
  if (loadBtn)   loadBtn.addEventListener('click',   loadMore);
  if (expandBtn) expandBtn.addEventListener('click', expandSearch);
}

/* ---- Append Cards (without full re-render) ---- */
function _appendVideoCards(newVideos) {
  const bar  = $('#vrLoadMoreBar');
  const grid = $('#vrGrid');
  if (!bar || !grid) return;

  const temp = document.createElement('div');
  temp.innerHTML = newVideos.map(v => renderVideoCard(v)).join('');
  attachCardHandlers(temp, _apiResults);

  const firstNewNode = temp.firstElementChild;
  while (temp.firstChild) {
    bar.parentNode.insertBefore(temp.firstChild, bar);
  }

  if (firstNewNode) firstNewNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _showLoadError(message) {
  const el = $('#vrLoadError');
  if (el) {
    el.textContent    = message;
    el.style.display  = 'block';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 6000);
  }
}

/* ---- Load More (paginate current query) ---- */
async function loadMore() {
  if (_isLoadingMore || !_hasMore || _nextOffset === null || _apiResults.length >= SESSION_MAX) return;

  _isLoadingMore = true;
  _updateLoadMoreButtons();

  try {
    const fs = state.viralResearch;
    const platform = (fs.platform === 'all' || fs.platform === 'facebook') ? 'tiktok' : fs.platform;
    const params = new URLSearchParams({
      keyword:  fs.keyword.trim(),
      platform,
      region:   fs.region,
      query:    _currentQuery || '',
      offset:   String(_nextOffset)
    });

    const resp = await fetch(`${BACKEND_URL}/api/research?${params}`);
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || `HTTP ${resp.status}`);
    }

    const json      = await resp.json();
    const newVideos = (json.data || []).map(apiVideoToCard);

    const fresh = newVideos.filter(v => !_seenIds.has(String(v.id)));
    fresh.forEach(v => { _seenIds.add(String(v.id)); _apiResults.push(v); });

    _hasMore       = json.hasMore  || false;
    _nextOffset    = json.nextOffset ?? null;
    _totalAnalyzed += json.rawCount || 0;

    _updateGridMeta(_apiResults.length, _apiResults.length);
    _updateStatsBar();

    if (fresh.length > 0) {
      _appendVideoCards(fresh);
    }
    _updateLoadMoreButtons();
  } catch (err) {
    console.error('[VR] loadMore error:', err);
    _showLoadError(err.message);
  } finally {
    _isLoadingMore = false;
    _updateLoadMoreButtons();
  }
}

/* ---- Expand Search (fetch next query variant) ---- */
async function expandSearch() {
  const nextIdx = _variantIndex + 1;
  if (_isExpandingSearch || nextIdx >= _queryVariants.length || _apiResults.length >= SESSION_MAX) return;

  _isExpandingSearch = true;
  _updateLoadMoreButtons();

  const nextQuery = _queryVariants[nextIdx];

  try {
    const fs = state.viralResearch;
    const platform = (fs.platform === 'all' || fs.platform === 'facebook') ? 'tiktok' : fs.platform;
    const params = new URLSearchParams({
      keyword:  fs.keyword.trim(),
      platform,
      region:   fs.region,
      query:    nextQuery,
      offset:   '0'
    });

    const resp = await fetch(`${BACKEND_URL}/api/research?${params}`);
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || `HTTP ${resp.status}`);
    }

    const json      = await resp.json();
    const newVideos = (json.data || []).map(apiVideoToCard);

    const fresh = newVideos.filter(v => !_seenIds.has(String(v.id)));
    fresh.forEach(v => { _seenIds.add(String(v.id)); _apiResults.push(v); });

    /* Advance variant tracking only on success */
    _variantIndex  = nextIdx;
    _currentQuery  = nextQuery;
    _hasMore       = json.hasMore  || false;
    _nextOffset    = json.nextOffset ?? null;
    _totalAnalyzed += json.rawCount || 0;

    _updateGridMeta(_apiResults.length, _apiResults.length);
    _updateStatsBar();

    if (fresh.length > 0) {
      _appendVideoCards(fresh);
    } else {
      _showLoadError(`Không tìm thấy video mới cho từ khóa "${nextQuery}"`);
    }
    _updateLoadMoreButtons();
  } catch (err) {
    console.error('[VR] expandSearch error:', err);
    _showLoadError(err.message);
  } finally {
    _isExpandingSearch = false;
    _updateLoadMoreButtons();
  }
}

/* ---- Grid Render ---- */
async function renderGrid(triggerSearch = false) {
  const fs   = state.viralResearch;
  const grid = $('#vrGrid');
  if (!grid) return;

  /* No keyword → reset, show prompt */
  if (!fs.keyword || !fs.keyword.trim()) {
    _resetSearchState();
    _updateStatsBar();
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

    _resetSearchState();
    _searchState = 'loading';

    const platform = (fs.platform === 'all' || fs.platform === 'facebook') ? 'tiktok' : fs.platform;
    const providerLabel = fs.region === 'cn' ? 'Douyin' : 'TikTok';

    const searchBtn = $('#vrSearchBtn');
    if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = '⏳ Đang phân tích...'; }

    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⏳</div>
        <div class="empty-title">MediaOS đang phân tích video ${providerLabel}...</div>
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
      const json = await resp.json();

      const cards = (json.data || []).map(apiVideoToCard);
      cards.forEach(v => { _seenIds.add(String(v.id)); _apiResults.push(v); });

      _fallback       = json.fallback   || false;
      _hasMore        = json.hasMore    || false;
      _nextOffset     = json.nextOffset ?? null;
      _queryVariants  = json.variants   || [];
      _variantIndex   = 0;
      _currentQuery   = _queryVariants[0] || fs.keyword.trim();
      _totalAnalyzed  = json.rawCount   || cards.length;
      _searchState    = 'done';
    } catch (err) {
      console.error('[VR] Backend error:', err);
      _searchState = 'error';
      _updateGridMeta(0, 0);
      _updateStatsBar();
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Không tải được kết quả</div>
          <div class="empty-desc">${esc(err.message)}</div>
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

  if (_searchState === 'error') {
    _updateGridMeta(0, 0);
    return;
  }

  /* _searchState === 'done' — client-side filter on cached results */
  let results = _apiResults.slice();
  if (fs.platform !== 'all') {
    const include = fs.platform === 'tiktok' ? ['tiktok', 'douyin'] : [fs.platform];
    results = results.filter(v => include.includes(v.platform));
  }
  if (fs.region !== 'global') {
    results = results.filter(v => v.region === fs.region);
  }

  _updateGridMeta(results.length, _apiResults.length);
  _updateStatsBar();

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
  grid.insertAdjacentHTML('beforeend', _buildLoadMoreBar());
  attachCardHandlers(grid, _apiResults);
  _bindLoadMoreEvents();
  _updateLoadMoreButtons();
}

function _updateGridMeta(shown, total) {
  const countEl = $('#vrCount');
  const aiLabel = $('#vrAiLabel');
  if (countEl) countEl.textContent = shown > 0 ? shown : '–';
  if (aiLabel) {
    aiLabel.textContent = total > 0
      ? `AI đã phân tích ${_totalAnalyzed} video — hiển thị ${shown} video đáng nghiên cứu nhất`
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
