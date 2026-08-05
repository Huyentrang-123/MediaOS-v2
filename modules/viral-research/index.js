/* ============================================================
   MediaOS — Viral Research: Module Entry
   Search-first UX. No mode tabs. No import UI here.
   ============================================================ */

'use strict';

const BACKEND_URL = '';
const SESSION_MAX = 50;

/* ---- Session search state ---- */
let _apiResults        = [];
let _searchState       = 'idle';   // 'idle' | 'loading' | 'done' | 'error'
let _fallback          = false;
let _hasMore           = false;
let _nextOffset        = null;
let _queryVariants     = [];
let _variantIndex      = 0;
let _currentQuery      = null;
let _seenIds           = new Set();
let _totalAnalyzed     = 0;
let _isLoadingMore     = false;
let _isExpandingSearch = false;

/* ---- Client-side display state (persists across searches) ---- */
let _sortBy      = 'score';  // 'score' | 'views' | 'likes' | 'comments' | 'newest'
let _filterDate  = 'all';   // 'all' | '7d' | '30d'
let _filterViews = 'all';   // 'all' | '100k' | '1m'

function _resetSearchState() {
  _apiResults = []; _searchState = 'idle'; _fallback = false;
  _hasMore = false; _nextOffset = null;
  _queryVariants = []; _variantIndex = 0; _currentQuery = null;
  _seenIds = new Set(); _totalAnalyzed = 0;
  _isLoadingMore = false; _isExpandingSearch = false;
}

/* Map backend video → card format */
function apiVideoToCard(v) {
  const gr = v.stats?.growthRate;
  return {
    id:           v.id,
    platform:     v.platform,
    region:       v.region || '',
    title:        v.caption || '(Không có tiêu đề)',
    thumbnail:    v.thumbnail || '',
    creator:      v.creatorHandle || v.creator || '',
    postedDate:   v.postedAt ? v.postedAt.slice(0, 10) : '',
    views:        v.stats?.views    || 0,
    likes:        v.stats?.likes    || 0,
    comments:     v.stats?.comments || 0,
    shares:       v.stats?.shares   || 0,
    viewsGrowth7d: gr ? parseFloat(gr) : null,
    viralScore:   v.viral?.score || 0,
    tags:         v.hashtags || [],
    url:          v.url || '#',
    matchedQuery: v.matchedQuery || '',
    _reference:   v._reference || false
  };
}

/* ============================================================
   RENDER — Main entry point
   ============================================================ */
function renderResearch(container) {
  const fs = state.viralResearch;

  container.innerHTML =
    '<div class="vr-page">' +
      _buildSearchSection(fs) +
      '<div id="vrResults">' + _buildResultsArea() + '</div>' +
    '</div>';

  _bindSearchEvents();
  if (_searchState === 'done') {
    _bindSortFilterEvents();
    _bindQueryChipEvents();
    _bindLoadMoreEvents();
    attachCardHandlers($('#vrGrid'), _apiResults);
  }
}

/* ============================================================
   SEARCH SECTION (always visible)
   ============================================================ */
function _buildSearchSection(fs) {
  const platformOpts = [
    { id: 'all',      icon: '',  label: 'Tất cả' },
    { id: 'tiktok',   icon: '♪', label: 'TikTok' },
    { id: 'douyin',   icon: '抖', label: 'Douyin' },
    { id: 'facebook', icon: 'f', label: 'Facebook' }
  ];

  const platformChips = platformOpts.map(function(p) {
    return '<button class="vr-chip' + (fs.platform === p.id ? ' active' : '') +
      '" data-platform="' + p.id + '">' +
      (p.icon ? '<span class="vr-chip-icon">' + p.icon + '</span>' : '') +
      p.label + '</button>';
  }).join('');

  const regionChips = CONFIG.regions.map(function(r) {
    return '<button class="vr-chip' + (fs.region === r.id ? ' active' : '') +
      '" data-region="' + r.id + '">' + r.label + '</button>';
  }).join('');

  const isLoading = _searchState === 'loading';

  return '<div class="vr-search-section">' +
    '<div class="vr-search-bar">' +
      '<div class="vr-search-input-wrap">' +
        '<span class="vr-search-icon">🔍</span>' +
        '<input type="text" id="vrKeyword" class="vr-search-input"' +
          ' placeholder="Nhập từ khóa: serum viral, kem nám, before after..."' +
          ' value="' + esc(fs.keyword) + '" autocomplete="off">' +
      '</div>' +
      '<button class="btn btn-primary vr-search-btn" id="vrSearchBtn"' +
        (isLoading ? ' disabled' : '') + '>' +
        (isLoading ? '⏳ Đang tìm...' : 'Phân tích') +
      '</button>' +
    '</div>' +
    '<div class="vr-filter-row">' +
      '<span class="vr-filter-label">Nền tảng</span>' +
      '<div class="vr-chip-group" id="platformChips">' + platformChips + '</div>' +
    '</div>' +
    '<div class="vr-filter-row">' +
      '<span class="vr-filter-label">Khu vực</span>' +
      '<div class="vr-chip-group" id="regionChips">' + regionChips + '</div>' +
    '</div>' +
  '</div>';
}

/* ============================================================
   RESULTS AREA
   ============================================================ */
function _buildResultsArea() {
  if (_searchState === 'idle')    return _buildIdleState();
  if (_searchState === 'loading') return _buildLoadingState();
  if (_searchState === 'error')   return '';
  return _buildResultsContent();
}

function _buildIdleState() {
  const kw = (state.viralResearch.keyword || '').trim();
  if (!kw) {
    return '<div class="vr-empty">' +
      '<div class="vr-empty-icon">🤖</div>' +
      '<div class="vr-empty-title">AI Viral Research Engine</div>' +
      '<div class="vr-empty-desc">Nhập từ khóa mỹ phẩm bạn muốn nghiên cứu, chọn nền tảng và khu vực, rồi bấm <strong>Phân tích</strong>.<br>' +
      'AI sẽ tìm kiếm và xếp hạng video đáng nghiên cứu nhất từ TikTok, Douyin và Facebook.</div>' +
    '</div>';
  }
  return '<div class="vr-empty">' +
    '<div class="vr-empty-icon">▶</div>' +
    '<div class="vr-empty-title">Bấm "Phân tích" để bắt đầu</div>' +
    '<div class="vr-empty-desc">Từ khóa: <strong>' + esc(kw) + '</strong></div>' +
  '</div>';
}

function _buildLoadingState() {
  const kw = (state.viralResearch.keyword || '').trim();
  const provider = state.viralResearch.region === 'cn' ? 'Douyin' : 'TikTok';
  return '<div class="vr-empty">' +
    '<div class="vr-empty-icon">⏳</div>' +
    '<div class="vr-empty-title">Đang phân tích video ' + provider + '...</div>' +
    '<div class="vr-empty-desc">Thu thập và xếp hạng video với từ khóa <strong>' + esc(kw) + '</strong></div>' +
  '</div>';
}

function _buildResultsContent() {
  const filtered = _getFilteredResults();
  const html = [];

  html.push(_buildSummaryRow(filtered.length));

  if (_queryVariants.length > 1) html.push(_buildQueryChips());

  html.push(_buildSortFilterBar());

  if (filtered.length === 0) {
    html.push('<div class="vr-empty">' +
      '<div class="vr-empty-icon">🔍</div>' +
      '<div class="vr-empty-title">Không có video phù hợp bộ lọc này</div>' +
      '<div class="vr-empty-desc">Thay đổi bộ lọc hoặc tìm từ khóa khác.</div>' +
    '</div>');
  } else {
    html.push('<div class="vr-grid" id="vrGrid">' +
      filtered.map(function(v) { return renderVideoCard(v); }).join('') +
    '</div>');
  }

  html.push(_buildLoadMoreBar());

  return html.join('');
}

/* ---- Summary Row ---- */
function _buildSummaryRow(shown) {
  const total    = _apiResults.length;
  const topScore = total > 0 ? Math.max.apply(null, _apiResults.map(function(v) { return v.viralScore || 0; })) : 0;
  const refCount = _apiResults.filter(function(v) { return v._reference; }).length;
  const viral    = total - refCount;

  const parts = [
    'Đã phân tích <strong>' + _totalAnalyzed + '</strong> video',
    'AI chọn <strong>' + viral + '</strong> đáng nghiên cứu' +
      (refCount > 0 ? ' · <span class="vr-ref-note">+' + refCount + ' tham khảo</span>' : ''),
    'Score cao nhất <strong>' + topScore + '/100</strong>'
  ];

  if (shown < total) {
    parts.push('Đang hiển thị <strong>' + shown + '</strong>/' + total + ' sau lọc');
  }

  return '<div class="vr-summary" id="vrSummary">' +
    parts.join('<span class="vr-summary-sep">·</span>') +
  '</div>';
}

function _updateSummaryRow() {
  const el = $('#vrSummary');
  if (!el) return;
  const filtered = _getFilteredResults();
  el.outerHTML = _buildSummaryRow(filtered.length);
}

/* ---- Query Suggestion Chips ---- */
function _buildQueryChips() {
  const variants = _queryVariants.slice(1, 9);
  if (variants.length === 0) return '';
  return '<div class="vr-suggestions">' +
    '<span class="vr-suggestions-label">Có thể bạn muốn tìm:</span>' +
    variants.map(function(q) {
      return '<button class="vr-suggestion-chip" data-query="' + esc(q) + '">' + esc(q) + '</button>';
    }).join('') +
  '</div>';
}

/* ---- Sort / Filter Bar ---- */
function _buildSortFilterBar() {
  const sorts = [
    { id: 'score',    label: 'Viral Score' },
    { id: 'views',    label: 'Views' },
    { id: 'likes',    label: 'Likes' },
    { id: 'comments', label: 'Bình luận' },
    { id: 'newest',   label: 'Mới nhất' }
  ];
  const dateFils = [
    { id: 'all', label: 'Mọi thời gian' },
    { id: '7d',  label: '7 ngày' },
    { id: '30d', label: '30 ngày' }
  ];
  const viewFils = [
    { id: 'all',  label: 'Mọi views' },
    { id: '100k', label: '>100K' },
    { id: '1m',   label: '>1M' }
  ];

  function mkGroup(label, items, attr) {
    return '<div class="vr-sort-group">' +
      '<span class="vr-sort-label">' + label + '</span>' +
      items.map(function(f) {
        let active;
        if (attr === 'sort')  active = _sortBy === f.id;
        if (attr === 'date')  active = _filterDate === f.id;
        if (attr === 'views') active = _filterViews === f.id;
        return '<button class="vr-sort-btn' + (active ? ' active' : '') +
          '" data-' + attr + '="' + f.id + '">' + f.label + '</button>';
      }).join('') +
    '</div>';
  }

  return '<div class="vr-sort-bar" id="vrSortBar">' +
    mkGroup('Sắp xếp', sorts, 'sort') +
    mkGroup('Thời gian', dateFils, 'date') +
    mkGroup('Views', viewFils, 'views') +
  '</div>';
}

/* ---- Client-side filter + sort ---- */
function _getFilteredResults() {
  const fs = state.viralResearch;
  let results = _apiResults.slice();

  if (fs.platform !== 'all') {
    const inc = fs.platform === 'tiktok' ? ['tiktok', 'douyin'] : [fs.platform];
    results = results.filter(function(v) { return inc.includes(v.platform); });
  }

  if (fs.region !== 'global') {
    results = results.filter(function(v) { return v.region === fs.region; });
  }

  if (_filterDate !== 'all') {
    const days   = _filterDate === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 86400 * 1000;
    results = results.filter(function(v) {
      return v.postedDate && new Date(v.postedDate).getTime() > cutoff;
    });
  }

  if (_filterViews === '100k')  results = results.filter(function(v) { return v.views >= 100000; });
  if (_filterViews === '1m')    results = results.filter(function(v) { return v.views >= 1000000; });

  results.sort(function(a, b) {
    if (_sortBy === 'views')    return b.views    - a.views;
    if (_sortBy === 'likes')    return b.likes    - a.likes;
    if (_sortBy === 'comments') return b.comments - a.comments;
    if (_sortBy === 'newest')   return new Date(b.postedDate) - new Date(a.postedDate);
    return b.viralScore - a.viralScore;
  });

  return results;
}

/* ---- Load More Bar ---- */
function _buildLoadMoreBar() {
  const atMax         = _apiResults.length >= SESSION_MAX;
  const noMorePages   = !_hasMore || _nextOffset === null;
  const noMoreVars    = _variantIndex >= _queryVariants.length - 1;
  const variantsLeft  = _queryVariants.length - 1 - _variantIndex;

  if (atMax) {
    return '<div class="vr-loadmore-bar"><span class="vr-loadmore-note">Đã đạt giới hạn ' + SESSION_MAX + ' video / phiên</span></div>';
  }

  return '<div class="vr-loadmore-bar" id="vrLoadMoreBar">' +
    '<div class="vr-loadmore-stats" id="vrLoadStats">' +
      'Đã tải ' + _apiResults.length + '/' + SESSION_MAX + ' video' +
      (variantsLeft > 0 ? ' · ' + variantsLeft + ' hướng tìm kiếm chưa khám phá' : '') +
    '</div>' +
    '<div class="vr-loadmore-btns">' +
      '<button id="vrLoadMoreBtn" class="btn btn-secondary"' + (noMorePages ? ' disabled' : '') + '>' +
        '↓ Xem thêm' +
      '</button>' +
      '<button id="vrExpandBtn" class="btn btn-outline"' + (noMoreVars ? ' disabled' : '') + '>' +
        '🔍 Tìm thêm gợi ý' +
      '</button>' +
    '</div>' +
    '<div id="vrLoadError" class="vr-load-error" style="display:none"></div>' +
  '</div>';
}

function _updateLoadMoreButtons() {
  const loadBtn  = $('#vrLoadMoreBtn');
  const expandBtn = $('#vrExpandBtn');
  const statsEl  = $('#vrLoadStats');
  if (!loadBtn || !expandBtn) return;

  const atMax        = _apiResults.length >= SESSION_MAX;
  const noMorePages  = !_hasMore || _nextOffset === null;
  const noMoreVars   = _variantIndex >= _queryVariants.length - 1;
  const variantsLeft = _queryVariants.length - 1 - _variantIndex;

  if (atMax) {
    loadBtn.style.display   = 'none';
    expandBtn.style.display = 'none';
    if (statsEl) statsEl.textContent = 'Đã đạt giới hạn ' + SESSION_MAX + ' video / phiên';
    return;
  }

  if (statsEl) {
    statsEl.textContent = 'Đã tải ' + _apiResults.length + '/' + SESSION_MAX + ' video' +
      (variantsLeft > 0 ? ' · ' + variantsLeft + ' hướng tìm kiếm chưa khám phá' : '');
  }

  loadBtn.disabled    = _isLoadingMore   || noMorePages;
  expandBtn.disabled  = _isExpandingSearch || noMoreVars;
  loadBtn.textContent  = _isLoadingMore    ? '⏳ Đang tải...' : '↓ Xem thêm';
  expandBtn.textContent = _isExpandingSearch ? '⏳ Đang tìm...' : '🔍 Tìm thêm gợi ý';
}

/* ============================================================
   FULL RE-RENDER (filter/sort changes)
   ============================================================ */
function _rerenderResults() {
  const container = $('#vrResults');
  if (!container) return;
  container.innerHTML = _buildResultsContent();
  _bindSortFilterEvents();
  _bindQueryChipEvents();
  _bindLoadMoreEvents();
  attachCardHandlers($('#vrGrid'), _apiResults);
}

/* ============================================================
   APPEND (load-more without full re-render)
   ============================================================ */
function _appendVideoCards(newVideos) {
  const bar  = $('#vrLoadMoreBar');
  const grid = $('#vrGrid');
  if (!bar || !grid) { _rerenderResults(); return; }

  /* Only append cards that pass current filters */
  const fs = state.viralResearch;
  const visible = newVideos.filter(function(v) {
    if (fs.platform !== 'all') {
      const inc = fs.platform === 'tiktok' ? ['tiktok', 'douyin'] : [fs.platform];
      if (!inc.includes(v.platform)) return false;
    }
    if (fs.region !== 'global' && v.region !== fs.region) return false;
    if (_filterDate !== 'all') {
      const days   = _filterDate === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 86400 * 1000;
      if (!v.postedDate || new Date(v.postedDate).getTime() <= cutoff) return false;
    }
    if (_filterViews === '100k' && v.views < 100000)  return false;
    if (_filterViews === '1m'   && v.views < 1000000) return false;
    return true;
  });

  if (visible.length > 0) {
    const temp = document.createElement('div');
    temp.innerHTML = visible.map(function(v) { return renderVideoCard(v); }).join('');
    attachCardHandlers(temp, _apiResults);

    const firstNew = temp.firstElementChild;
    while (temp.firstChild) bar.parentNode.insertBefore(temp.firstChild, bar);
    if (firstNew) firstNew.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _updateSummaryRow();
  _updateLoadMoreButtons();
}

function _showLoadError(msg) {
  const el = $('#vrLoadError');
  if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(function() { if (el) el.style.display = 'none'; }, 6000); }
}

/* ============================================================
   SEARCH (first search from button)
   ============================================================ */
async function _doSearch() {
  const input = $('#vrKeyword');
  if (input) {
    state.viralResearch.keyword = input.value;
    saveState();
  }

  const kw = (state.viralResearch.keyword || '').trim();
  if (!kw) return;
  if (_searchState === 'loading') return;

  _resetSearchState();
  _searchState = 'loading';

  /* Show loading state */
  const searchBtn = $('#vrSearchBtn');
  if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = '⏳ Đang tìm...'; }
  const resultsEl = $('#vrResults');
  if (resultsEl) resultsEl.innerHTML = _buildLoadingState();

  const fs       = state.viralResearch;
  const platform = (fs.platform === 'all' || fs.platform === 'facebook') ? 'tiktok' : fs.platform;

  try {
    const params = new URLSearchParams({ keyword: kw, platform, region: fs.region });
    const resp   = await fetch(BACKEND_URL + '/api/research?' + params);
    if (!resp.ok) {
      const e = await resp.json().catch(function() { return {}; });
      throw new Error(e.error || 'HTTP ' + resp.status);
    }
    const json  = await resp.json();
    const cards = (json.data || []).map(apiVideoToCard);
    cards.forEach(function(v) { _seenIds.add(String(v.id)); _apiResults.push(v); });

    _fallback      = json.fallback   || false;
    _hasMore       = json.hasMore    || false;
    _nextOffset    = json.nextOffset ?? null;
    _queryVariants = json.variants   || [];
    _variantIndex  = 0;
    _currentQuery  = _queryVariants[0] || kw;
    _totalAnalyzed = json.rawCount   || cards.length;
    _searchState   = 'done';
  } catch (err) {
    console.error('[VR] search error:', err);
    _searchState = 'error';
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="vr-empty">' +
        '<div class="vr-empty-icon">⚠️</div>' +
        '<div class="vr-empty-title">Không tải được kết quả</div>' +
        '<div class="vr-empty-desc">' + esc(err.message) + '</div>' +
      '</div>';
    }
  } finally {
    if (searchBtn) { searchBtn.disabled = false; searchBtn.textContent = 'Phân tích'; }
  }

  if (_searchState === 'done') _rerenderResults();
}

/* ============================================================
   LOAD MORE (paginate current query)
   ============================================================ */
async function loadMore() {
  if (_isLoadingMore || !_hasMore || _nextOffset === null || _apiResults.length >= SESSION_MAX) return;
  _isLoadingMore = true;
  _updateLoadMoreButtons();

  const fs       = state.viralResearch;
  const platform = (fs.platform === 'all' || fs.platform === 'facebook') ? 'tiktok' : fs.platform;

  try {
    const params = new URLSearchParams({
      keyword: fs.keyword.trim(),
      platform,
      region:  fs.region,
      query:   _currentQuery || '',
      offset:  String(_nextOffset)
    });
    const resp = await fetch(BACKEND_URL + '/api/research?' + params);
    if (!resp.ok) {
      const e = await resp.json().catch(function() { return {}; });
      throw new Error(e.error || 'HTTP ' + resp.status);
    }
    const json     = await resp.json();
    const newCards = (json.data || []).map(apiVideoToCard);
    const fresh    = newCards.filter(function(v) { return !_seenIds.has(String(v.id)); });
    fresh.forEach(function(v) { _seenIds.add(String(v.id)); _apiResults.push(v); });

    _hasMore       = json.hasMore  || false;
    _nextOffset    = json.nextOffset ?? null;
    _totalAnalyzed += json.rawCount || 0;

    _appendVideoCards(fresh);
  } catch (err) {
    console.error('[VR] loadMore error:', err);
    _showLoadError(err.message);
  } finally {
    _isLoadingMore = false;
    _updateLoadMoreButtons();
  }
}

/* ============================================================
   EXPAND SEARCH (fetch next query variant)
   ============================================================ */
async function expandSearch() {
  const nextIdx = _variantIndex + 1;
  if (_isExpandingSearch || nextIdx >= _queryVariants.length || _apiResults.length >= SESSION_MAX) return;
  _isExpandingSearch = true;
  _updateLoadMoreButtons();

  const nextQuery = _queryVariants[nextIdx];
  const fs        = state.viralResearch;
  const platform  = (fs.platform === 'all' || fs.platform === 'facebook') ? 'tiktok' : fs.platform;

  try {
    const params = new URLSearchParams({
      keyword: fs.keyword.trim(),
      platform,
      region:  fs.region,
      query:   nextQuery,
      offset:  '0'
    });
    const resp = await fetch(BACKEND_URL + '/api/research?' + params);
    if (!resp.ok) {
      const e = await resp.json().catch(function() { return {}; });
      throw new Error(e.error || 'HTTP ' + resp.status);
    }
    const json     = await resp.json();
    const newCards = (json.data || []).map(apiVideoToCard);
    const fresh    = newCards.filter(function(v) { return !_seenIds.has(String(v.id)); });
    fresh.forEach(function(v) { _seenIds.add(String(v.id)); _apiResults.push(v); });

    _variantIndex  = nextIdx;
    _currentQuery  = nextQuery;
    _hasMore       = json.hasMore  || false;
    _nextOffset    = json.nextOffset ?? null;
    _totalAnalyzed += json.rawCount || 0;

    if (fresh.length > 0) {
      _appendVideoCards(fresh);
    } else {
      _showLoadError('Không tìm thấy video mới cho "' + nextQuery + '"');
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

/* ============================================================
   EVENT BINDING
   ============================================================ */
function _bindSearchEvents() {
  const searchBtn = $('#vrSearchBtn');
  if (searchBtn) searchBtn.addEventListener('click', _doSearch);

  const input = $('#vrKeyword');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') _doSearch();
    });
    /* Focus shortcut: / or Ctrl+K */
    document.addEventListener('keydown', function _kh(e) {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* Platform chips — re-filter cached results immediately */
  $$('#platformChips .vr-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      state.viralResearch.platform = chip.dataset.platform;
      $$('#platformChips .vr-chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.platform === chip.dataset.platform);
      });
      if (_searchState === 'done') _rerenderResults();
    });
  });

  /* Region chips — re-filter cached results immediately */
  $$('#regionChips .vr-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      state.viralResearch.region = chip.dataset.region;
      $$('#regionChips .vr-chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.region === chip.dataset.region);
      });
      if (_searchState === 'done') _rerenderResults();
    });
  });
}

function _bindSortFilterEvents() {
  /* Sort buttons */
  $$('[data-sort]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _sortBy = btn.dataset.sort;
      _rerenderResults();
    });
  });

  /* Date filter */
  $$('[data-date]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _filterDate = btn.dataset.date;
      _rerenderResults();
    });
  });

  /* Views filter */
  $$('[data-views]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _filterViews = btn.dataset.views;
      _rerenderResults();
    });
  });
}

function _bindQueryChipEvents() {
  $$('.vr-suggestion-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      const query = chip.dataset.query;
      state.viralResearch.keyword = query;
      saveState();
      const input = $('#vrKeyword');
      if (input) input.value = query;
      _doSearch();
    });
  });
}

function _bindLoadMoreEvents() {
  const loadBtn   = $('#vrLoadMoreBtn');
  const expandBtn = $('#vrExpandBtn');
  if (loadBtn)   loadBtn.addEventListener('click', loadMore);
  if (expandBtn) expandBtn.addEventListener('click', expandSearch);
}
