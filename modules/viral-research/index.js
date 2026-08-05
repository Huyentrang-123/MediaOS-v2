/* ============================================================
   MediaOS — Viral Research: Search-first Engine
   Keyword → /api/search → rank → render
   No IndexedDB. No Library. No mock data.
   ============================================================ */

'use strict';

/* ---- Module state ---- */
var _results      = [];   /* current video array */
var _variants     = [];   /* query expansion chips */
var _searchState  = 'idle'; /* 'idle' | 'searching' | 'done' | 'error' */
var _sortBy       = 'score';
var _hasMore      = false;
var _nextOffset   = null;
var _lastKeyword  = '';
var _lastQuery    = '';
var _lastMarket   = '';
var _lastPlatform = '';

function _reset() {
  _results     = [];
  _variants    = [];
  _searchState = 'idle';
  _hasMore     = false;
  _nextOffset  = null;
}

/* ============================================================
   RENDER — main entry point called by router
   ============================================================ */
function renderResearch(container) {
  var fs = state.viralResearch;

  container.innerHTML =
    '<div class="vr-page">' +
      _buildSearchSection(fs) +
      '<div id="vrResults">' + _buildResultsArea() + '</div>' +
    '</div>';

  _bindSearchEvents();
  if (_searchState === 'done') {
    _bindSortEvents();
    _bindVariantEvents();
    _bindPaginationEvents();
  }
}

/* ============================================================
   SEARCH SECTION
   ============================================================ */
function _buildSearchSection(fs) {
  var platformOpts = [
    { id: 'all',     label: 'Tất cả' },
    { id: 'tiktok',  label: 'TikTok' },
    { id: 'youtube', label: 'YouTube' }
  ];

  var platformChips = platformOpts.map(function(p) {
    return '<button class="vr-chip' + (fs.platform === p.id ? ' active' : '') +
      '" data-platform="' + p.id + '">' + p.label + '</button>';
  }).join('');

  var regionChips = CONFIG.regions.map(function(r) {
    return '<button class="vr-chip' + (fs.region === r.id ? ' active' : '') +
      '" data-region="' + r.id + '">' + r.label + '</button>';
  }).join('');

  var isSearching = _searchState === 'searching';

  return '<div class="vr-search-section">' +
    '<div class="vr-search-bar">' +
      '<div class="vr-search-input-wrap">' +
        '<span class="vr-search-icon">🔍</span>' +
        '<input type="text" id="vrKeyword" class="vr-search-input"' +
          ' placeholder="Nhập từ khóa: serum nám, kem dưỡng, before after..."' +
          ' value="' + esc(fs.keyword) + '" autocomplete="off">' +
      '</div>' +
      '<button class="btn btn-primary vr-search-btn" id="vrSearchBtn"' +
        (isSearching ? ' disabled' : '') + '>' +
        (isSearching ? '⏳ Đang tìm...' : 'Phân tích') +
      '</button>' +
    '</div>' +
    '<div class="vr-filter-row">' +
      '<span class="vr-filter-label">Nền tảng</span>' +
      '<div class="vr-chip-group" id="platformChips">' + platformChips + '</div>' +
    '</div>' +
    '<div class="vr-filter-row">' +
      '<span class="vr-filter-label">Thị trường</span>' +
      '<div class="vr-chip-group" id="regionChips">' + regionChips + '</div>' +
    '</div>' +
  '</div>';
}

/* ============================================================
   RESULTS AREA
   ============================================================ */
function _buildResultsArea() {
  if (_searchState === 'idle')      return _buildIdleState();
  if (_searchState === 'searching') return _buildSearchingState();
  if (_searchState === 'error')     return _buildErrorState();
  return _buildResultsContent();
}

function _buildIdleState() {
  return '<div class="vr-empty">' +
    '<div class="vr-empty-icon">🔍</div>' +
    '<div class="vr-empty-title">Tìm video viral theo từ khóa</div>' +
    '<div class="vr-empty-desc">' +
      'Nhập từ khóa, chọn nền tảng và thị trường, rồi bấm <strong>Phân tích</strong>.<br>' +
      'MediaOS sẽ tìm kiếm trực tiếp từ TikTok và YouTube.' +
    '</div>' +
  '</div>';
}

function _buildSearchingState() {
  return '<div class="vr-empty">' +
    '<div class="vr-empty-icon">⏳</div>' +
    '<div class="vr-empty-title">Đang tìm kiếm...</div>' +
    '<div class="vr-empty-desc">Đang truy vấn nguồn dữ liệu thật. Vui lòng chờ.</div>' +
  '</div>';
}

var _lastError = '';
function _buildErrorState() {
  return '<div class="vr-empty">' +
    '<div class="vr-empty-icon">⚠️</div>' +
    '<div class="vr-empty-title">Không tải được kết quả</div>' +
    '<div class="vr-empty-desc">' + esc(_lastError) + '</div>' +
    '<button class="btn btn-primary btn-sm" id="vrRetryBtn" style="margin-top:12px">Thử lại</button>' +
  '</div>';
}

function _buildResultsContent() {
  var sorted = _sortResults(_results);
  var html   = [];

  /* Summary bar */
  html.push(
    '<div class="vr-summary">' +
    'Tìm thấy <strong>' + _results.length + '</strong> video cho "<strong>' + esc(_lastQuery) + '</strong>"' +
    '</div>'
  );

  /* Sort bar */
  if (_results.length > 1) html.push(_buildSortBar());

  /* Video grid */
  if (sorted.length > 0) {
    html.push('<div class="vr-grid" id="vrGrid">' +
      sorted.map(function(v) { return renderVideoCard(v); }).join('') +
    '</div>');
  } else {
    html.push(
      '<div class="vr-lib-empty">' +
        '<div class="vr-empty-icon">🤷</div>' +
        '<div class="vr-empty-title">Không có kết quả</div>' +
        '<div class="vr-empty-desc">Hãy thử từ khóa khác hoặc đổi thị trường.</div>' +
      '</div>'
    );
  }

  /* Pagination buttons */
  html.push(_buildPaginationRow());

  /* Query variant chips */
  if (_variants.length > 1) html.push(_buildVariantChips());

  return html.join('');
}

function _buildSortBar() {
  var sorts = [
    { id: 'score',  label: 'Viral Score' },
    { id: 'views',  label: 'Views' },
    { id: 'newest', label: 'Mới nhất' }
  ];
  return '<div class="vr-sort-bar" id="vrSortBar">' +
    '<span class="vr-sort-label">Sắp xếp</span>' +
    sorts.map(function(s) {
      return '<button class="vr-sort-btn' + (_sortBy === s.id ? ' active' : '') +
        '" data-sort="' + s.id + '">' + s.label + '</button>';
    }).join('') +
  '</div>';
}

function _buildPaginationRow() {
  var btns = [];
  if (_hasMore && _nextOffset != null) {
    btns.push('<button class="btn btn-outline vr-load-more" id="vrLoadMore">Xem thêm kết quả ↓</button>');
  }
  if (_variants.length > 0) {
    btns.push('<button class="btn btn-outline vr-next-variant" id="vrNextVariant">Tìm thêm gợi ý →</button>');
  }
  if (btns.length === 0) return '';
  return '<div class="vr-pagination-row">' + btns.join('') + '</div>';
}

function _buildVariantChips() {
  var chips = _variants.slice(1, 9);
  if (chips.length === 0) return '';
  return '<div class="vr-suggestions">' +
    '<span class="vr-suggestions-label">Tìm thêm với:</span>' +
    chips.map(function(q, i) {
      return '<button class="vr-suggestion-chip" data-query="' + esc(q) + '" data-variant-idx="' + i + '">' + esc(q) + '</button>';
    }).join('') +
  '</div>';
}

/* ============================================================
   SORT
   ============================================================ */
function _sortResults(arr) {
  var copy = arr.slice();
  if (_sortBy === 'views')  return copy.sort(function(a, b) { return (b.views || 0) - (a.views || 0); });
  if (_sortBy === 'newest') return copy.sort(function(a, b) {
    return new Date(b.postedAt || 0) - new Date(a.postedAt || 0);
  });
  return copy.sort(function(a, b) { return (b.viralScore || 0) - (a.viralScore || 0); });
}

/* ============================================================
   FETCH — calls /api/search
   ============================================================ */
async function _fetchSearch({ keyword, query, market, platform, offset }) {
  var params = new URLSearchParams({
    keyword:  keyword,
    query:    query,
    market:   market,
    platform: platform,
    offset:   String(offset || 0)
  });
  var res  = await fetch('/api/search?' + params);
  var json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Lỗi server');
  return json;
}

/* ============================================================
   DO SEARCH (fresh)
   ============================================================ */
async function _doSearch() {
  var input = $('#vrKeyword');
  if (input) {
    state.viralResearch.keyword = input.value;
    saveState();
  }

  var kw = (state.viralResearch.keyword || '').trim();
  if (!kw) return;
  if (_searchState === 'searching') return;

  var fs  = state.viralResearch;
  _reset();
  _lastKeyword  = kw;
  _lastQuery    = kw;
  _lastMarket   = fs.region   || 'global';
  _lastPlatform = fs.platform || 'all';

  _setSearching(true);
  var resultsEl = $('#vrResults');
  if (resultsEl) resultsEl.innerHTML = _buildSearchingState();

  try {
    var json = await _fetchSearch({
      keyword:  kw,
      query:    kw,
      market:   _lastMarket,
      platform: _lastPlatform,
      offset:   0
    });
    _results    = json.data    || [];
    _variants   = json.variants || [];
    _hasMore    = json.hasMore  || false;
    _nextOffset = json.nextOffset != null ? json.nextOffset : null;
    _searchState = 'done';
  } catch (err) {
    console.error('[VR] search error:', err);
    _lastError   = err.message;
    _searchState = 'error';
  } finally {
    _setSearching(false);
  }

  _rerenderResults();
}

/* ============================================================
   LOAD MORE (same query, next offset)
   ============================================================ */
async function _loadMore() {
  if (!_hasMore || _nextOffset == null) return;

  var btn = $('#vrLoadMore');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tải...'; }

  try {
    var json = await _fetchSearch({
      keyword:  _lastKeyword,
      query:    _lastQuery,
      market:   _lastMarket,
      platform: _lastPlatform,
      offset:   _nextOffset
    });
    var newVideos   = json.data || [];
    var existingIds = new Set(_results.map(function(v) { return v.id; }));
    var added       = newVideos.filter(function(v) { return !existingIds.has(v.id); });

    _results    = _results.concat(added);
    _hasMore    = json.hasMore   || false;
    _nextOffset = json.nextOffset != null ? json.nextOffset : null;
    _rerenderResults();
  } catch (err) {
    toast('Lỗi tải thêm: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Xem thêm kết quả ↓'; }
  }
}

/* ============================================================
   NEXT VARIANT (query expansion)
   ============================================================ */
var _variantIdx = 1;

async function _loadNextVariant() {
  if (_variantIdx >= _variants.length) _variantIdx = 1;
  var nextQuery = _variants[_variantIdx] || _lastKeyword;
  _variantIdx++;

  _lastQuery  = nextQuery;
  _hasMore    = false;
  _nextOffset = null;
  _searchState = 'done';

  var btn = $('#vrNextVariant');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tìm...'; }

  try {
    var json = await _fetchSearch({
      keyword:  _lastKeyword,
      query:    nextQuery,
      market:   _lastMarket,
      platform: _lastPlatform,
      offset:   0
    });
    var newVideos   = json.data || [];
    var existingIds = new Set(_results.map(function(v) { return v.id; }));
    var added       = newVideos.filter(function(v) { return !existingIds.has(v.id); });

    _results    = _results.concat(added);
    _hasMore    = json.hasMore   || false;
    _nextOffset = json.nextOffset != null ? json.nextOffset : null;
    _rerenderResults();
  } catch (err) {
    toast('Lỗi mở rộng từ khóa: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Tìm thêm gợi ý →'; }
  }
}

/* ============================================================
   RE-RENDER
   ============================================================ */
function _rerenderResults() {
  var el = $('#vrResults');
  if (!el) return;
  el.innerHTML = _buildResultsArea();
  if (_searchState === 'done') {
    _bindSortEvents();
    _bindVariantEvents();
    _bindPaginationEvents();
  }
  if (_searchState === 'error') {
    var retryBtn = $('#vrRetryBtn');
    if (retryBtn) retryBtn.addEventListener('click', _doSearch);
  }
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function _setSearching(on) {
  _searchState = on ? 'searching' : _searchState;
  var btn = $('#vrSearchBtn');
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? '⏳ Đang tìm...' : 'Phân tích';
}

function _bindSearchEvents() {
  var btn = $('#vrSearchBtn');
  if (btn) btn.addEventListener('click', _doSearch);

  var input = $('#vrKeyword');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') _doSearch();
    });
    document.addEventListener('keydown', function _kh(e) {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  $$('#platformChips .vr-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      state.viralResearch.platform = chip.dataset.platform;
      $$('#platformChips .vr-chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.platform === chip.dataset.platform);
      });
      if (_searchState === 'done') _doSearch();
    });
  });

  $$('#regionChips .vr-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      state.viralResearch.region = chip.dataset.region;
      $$('#regionChips .vr-chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.region === chip.dataset.region);
      });
      if (_searchState === 'done') _doSearch();
    });
  });
}

function _bindSortEvents() {
  $$('[data-sort]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _sortBy = btn.dataset.sort;
      $$('[data-sort]').forEach(function(b) {
        b.classList.toggle('active', b.dataset.sort === _sortBy);
      });
      var grid = $('#vrGrid');
      if (grid) {
        grid.innerHTML = _sortResults(_results).map(function(v) { return renderVideoCard(v); }).join('');
      }
    });
  });
}

function _bindVariantEvents() {
  $$('.vr-suggestion-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var query = chip.dataset.query;
      _lastQuery = query;
      var input  = $('#vrKeyword');
      if (input) input.value = query;

      var existing = new Set(_results.map(function(v) { return v.id; }));
      _fetchSearch({
        keyword:  _lastKeyword,
        query:    query,
        market:   _lastMarket,
        platform: _lastPlatform,
        offset:   0
      }).then(function(json) {
        var added = (json.data || []).filter(function(v) { return !existing.has(v.id); });
        _results  = _results.concat(added);
        _hasMore  = json.hasMore   || false;
        _nextOffset = json.nextOffset != null ? json.nextOffset : null;
        _rerenderResults();
      }).catch(function(err) {
        toast('Lỗi: ' + err.message, 'error');
      });
    });
  });
}

function _bindPaginationEvents() {
  var loadMoreBtn = $('#vrLoadMore');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', _loadMore);

  var nextVariantBtn = $('#vrNextVariant');
  if (nextVariantBtn) nextVariantBtn.addEventListener('click', _loadNextVariant);
}
