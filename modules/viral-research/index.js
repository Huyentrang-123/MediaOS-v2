/* ============================================================
   MediaOS — Viral Research: Browser-Assisted Engine
   Keyword → Open platform → Extension collects DOM → Render
   No API calls. No Library. No mock data.
   ============================================================ */

'use strict';

/* ── Module state ──────────────────────────────────────── */
var _videos       = [];    /* scored video array */
var _sortBy       = 'score';
var _hasSearched  = false; /* user has clicked Tìm kiếm at least once */
var _lastKeyword  = '';
var _lastQuery    = '';
var _lastMarket   = 'global';
var _lastPlatform = 'all';

/* ============================================================
   RENDER — router entry point
   ============================================================ */
function renderResearch(container) {
  var fs = state.viralResearch;

  container.innerHTML =
    '<div class="vr-page">' +
      _buildSearchSection(fs) +
      '<div id="vrResults">' + _buildResultsArea() + '</div>' +
    '</div>';

  _bindSearchEvents();
  if (_hasSearched) _bindResultEvents();

  /* Listen for extension data (auto-triggered by bridge or hash) */
  window.addEventListener('mediaos:import', _onExtensionImport, { once: false });
}

/* ============================================================
   SEARCH SECTION
   ============================================================ */
function _buildSearchSection(fs) {
  var platformOpts = [
    { id: 'all',      label: 'Tất cả' },
    { id: 'tiktok',   label: 'TikTok' },
    { id: 'facebook', label: 'Facebook' }
  ];

  var platformChips = platformOpts.map(function(p) {
    return '<button class="vr-chip' + (fs.platform === p.id ? ' active' : '') +
      '" data-platform="' + p.id + '">' + p.label + '</button>';
  }).join('');

  var regionChips = CONFIG.regions.map(function(r) {
    return '<button class="vr-chip' + (fs.region === r.id ? ' active' : '') +
      '" data-region="' + r.id + '">' + r.label + '</button>';
  }).join('');

  return '<div class="vr-search-section">' +
    '<div class="vr-search-bar">' +
      '<div class="vr-search-input-wrap">' +
        '<span class="vr-search-icon">🔍</span>' +
        '<input type="text" id="vrKeyword" class="vr-search-input"' +
          ' placeholder="Nhập từ khóa: serum nám, kem dưỡng, before after..."' +
          ' value="' + esc(fs.keyword) + '" autocomplete="off">' +
      '</div>' +
      '<button class="btn btn-primary vr-search-btn" id="vrSearchBtn">Tìm kiếm</button>' +
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
  if (!_hasSearched)           return _buildIdleState();
  if (_videos.length === 0)    return _buildReadyState();
  return _buildResultsContent();
}

function _buildIdleState() {
  return '<div class="vr-empty">' +
    '<div class="vr-empty-icon">🔍</div>' +
    '<div class="vr-empty-title">Bắt đầu nghiên cứu viral</div>' +
    '<div class="vr-empty-desc">' +
      'Nhập từ khóa, chọn nền tảng và thị trường, rồi bấm <strong>Tìm kiếm</strong>.' +
    '</div>' +
  '</div>';
}

function _buildReadyState() {
  var kw      = _lastKeyword;
  var market  = _lastMarket;
  var platform = _lastPlatform;
  var query   = _lastQuery;

  var isTikTok  = platform === 'all' || platform === 'tiktok';
  var isFacebook = platform === 'all' || platform === 'facebook';

  var tiktokUrl  = 'https://www.tiktok.com/search/video?q=' + encodeURIComponent(query);
  var facebookUrl = 'https://www.facebook.com/search/videos/?q=' + encodeURIComponent(query);

  var btns = '';
  if (isTikTok)   btns += '<a class="btn btn-primary vr-open-btn" href="' + tiktokUrl  + '" target="_blank" rel="noopener noreferrer">Mở TikTok Search ↗</a>';
  if (isFacebook) btns += '<a class="btn btn-outline vr-open-btn" href="' + facebookUrl + '" target="_blank" rel="noopener noreferrer">Mở Facebook Videos ↗</a>';

  var queryDisplay = query !== kw
    ? '<div class="vr-query-display">Từ khóa: <strong>' + esc(kw) + '</strong> → <strong>' + esc(query) + '</strong></div>'
    : '<div class="vr-query-display">Từ khóa: <strong>' + esc(query) + '</strong></div>';

  return queryDisplay +
    '<div class="vr-platform-btns">' + btns + '</div>' +
    '<div class="vr-instructions">' +
      '<div class="vr-instructions-title">📌 Hướng dẫn</div>' +
      '<ol class="vr-instructions-list">' +
        '<li>Bấm nút bên trên để mở trang tìm kiếm trên nền tảng.</li>' +
        '<li>Trang tìm kiếm tải xong → bấm extension <strong>MediaOS</strong> trên thanh Chrome.</li>' +
        '<li>Bấm <strong>"Thu thập kết quả đang hiển thị"</strong>.</li>' +
        '<li>Extension tự động gửi dữ liệu về đây.</li>' +
      '</ol>' +
      '<div class="vr-waiting-indicator">⏳ Đang chờ dữ liệu từ Extension...</div>' +
      '<button class="btn btn-outline btn-sm vr-manual-import" id="vrManualImport" style="margin-top:10px">' +
        'Nhận kết quả từ Extension thủ công' +
      '</button>' +
    '</div>';
}

function _buildResultsContent() {
  var sorted = _sortResults(_videos);
  var html   = [];

  /* Summary + sort bar */
  html.push(
    '<div class="vr-summary-bar">' +
      '<span class="vr-summary-text">Tìm thấy <strong>' + _videos.length + '</strong> video' +
        (_videos.length >= 100 ? ' (tối đa 100)' : '') +
      '</span>' +
      _buildSortBar() +
    '</div>'
  );

  /* Grid */
  html.push('<div class="vr-grid" id="vrGrid">' +
    sorted.map(function(v) { return renderVideoCard(v); }).join('') +
  '</div>');

  /* Action bar: collect more + query variants */
  html.push(_buildActionBar());

  return html.join('');
}

function _buildSortBar() {
  var sorts = [{ id: 'score', label: 'Viral Score' }, { id: 'views', label: 'Views' }, { id: 'newest', label: 'Mới nhất' }];
  return '<div class="vr-sort-group">' +
    '<span class="vr-sort-label">Sắp xếp:</span>' +
    sorts.map(function(s) {
      return '<button class="vr-sort-btn' + (_sortBy === s.id ? ' active' : '') +
        '" data-sort="' + s.id + '">' + s.label + '</button>';
    }).join('') +
  '</div>';
}

function _buildActionBar() {
  var query   = _lastQuery;
  var market  = _lastMarket;
  var platform = _lastPlatform;

  var isTikTok   = platform === 'all' || platform === 'tiktok';
  var isFacebook = platform === 'all' || platform === 'facebook';
  var tiktokUrl  = 'https://www.tiktok.com/search/video?q=' + encodeURIComponent(query);
  var facebookUrl = 'https://www.facebook.com/search/videos/?q=' + encodeURIComponent(query);

  var openLinks = '';
  if (isTikTok)   openLinks += '<a class="btn btn-outline btn-sm" href="' + tiktokUrl  + '" target="_blank" rel="noopener noreferrer">TikTok ↗</a> ';
  if (isFacebook) openLinks += '<a class="btn btn-outline btn-sm" href="' + facebookUrl + '" target="_blank" rel="noopener noreferrer">Facebook ↗</a>';

  /* Query expansion chips */
  var variants = typeof vrAllVariants === 'function' ? vrAllVariants(_lastKeyword, _lastMarket) : [];
  var chips    = variants.slice(1, 7).map(function(q) {
    return '<button class="vr-suggestion-chip" data-query="' + esc(q) + '">' + esc(q) + '</button>';
  }).join('');

  return '<div class="vr-action-bar">' +
    '<div class="vr-action-row">' +
      '<span class="vr-action-label">Thu thập thêm →</span>' +
      openLinks +
      '<span class="vr-action-hint">Cuộn thêm rồi bấm extension lần nữa.</span>' +
    '</div>' +
    (chips ? '<div class="vr-suggestions"><span class="vr-suggestions-label">Thử thêm:</span>' + chips + '</div>' : '') +
    '<div class="vr-action-row" style="margin-top:8px">' +
      '<button class="btn btn-outline btn-sm" id="vrClearBtn">Xóa tất cả kết quả</button>' +
    '</div>' +
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
   EXTENSION IMPORT — receive data from bridge
   ============================================================ */
function _onExtensionImport(e) {
  var incoming = (e.detail && e.detail.videos) || [];
  if (incoming.length === 0) return;
  _mergeAndProcess(incoming);
}

function _mergeAndProcess(incoming) {
  var existingIds = new Set(_videos.map(function(v) { return v.id; }));

  /* Assign market and matchedQuery if missing */
  var enriched = incoming.map(function(v) {
    var hoursOld = v.postedAt ? Math.max(1, (Date.now() - new Date(v.postedAt).getTime()) / 3600000) : null;
    var vph      = (hoursOld && v.views) ? v.views / hoursOld : null;
    return Object.assign({}, v, {
      market:         v.market       || _lastMarket,
      matchedQuery:   v.matchedQuery || _lastQuery || _lastKeyword,
      viewsPerHour:   v.viewsPerHour || vph
    });
  });

  var added   = enriched.filter(function(v) { return !existingIds.has(v.id); });
  var merged  = _videos.concat(added).slice(0, 100);

  /* Client-side viral scoring */
  var scored  = scoreVideos(merged);
  _videos     = scored.map(function(v) {
    return Object.assign({}, v, { whyViral: getWhyViral(v) });
  });

  _hasSearched = true;
  _rerenderResults();

  if (added.length > 0) {
    toast('Nhận được ' + added.length + ' video từ Extension', 'success');
  } else {
    toast('Không có video mới (đã có hết trong danh sách)', 'info');
  }
}

/* ============================================================
   DO SEARCH — sets up query and opens platform links
   ============================================================ */
function _doSearch() {
  var input = $('#vrKeyword');
  if (input) {
    state.viralResearch.keyword = input.value;
    saveState();
  }

  var kw = (state.viralResearch.keyword || '').trim();
  if (!kw) { toast('Hãy nhập từ khóa', 'info'); return; }

  var fs    = state.viralResearch;
  _lastKeyword  = kw;
  _lastMarket   = fs.region   || 'global';
  _lastPlatform = fs.platform || 'all';

  /* Localized query via query-expansion module */
  _lastQuery = (typeof vrLocalizeQuery === 'function')
    ? vrLocalizeQuery(kw, _lastMarket)
    : kw;

  _hasSearched = true;

  /* Keep existing results, just rebuild UI */
  _rerenderResults();

  /* Auto-trigger bridge check in case extension already stored data */
  window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
}

/* ============================================================
   RE-RENDER
   ============================================================ */
function _rerenderResults() {
  var el = $('#vrResults');
  if (!el) return;
  el.innerHTML = _buildResultsArea();
  _bindResultEvents();
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function _bindSearchEvents() {
  var btn = $('#vrSearchBtn');
  if (btn) btn.addEventListener('click', _doSearch);

  var input = $('#vrKeyword');
  if (input) {
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') _doSearch(); });
    document.addEventListener('keydown', function(e) {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== input) {
        e.preventDefault(); input.focus();
      }
    });
  }

  $$('#platformChips .vr-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      state.viralResearch.platform = chip.dataset.platform;
      $$('#platformChips .vr-chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.platform === chip.dataset.platform);
      });
    });
  });

  $$('#regionChips .vr-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      state.viralResearch.region = chip.dataset.region;
      $$('#regionChips .vr-chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.region === chip.dataset.region);
      });
    });
  });
}

function _bindResultEvents() {
  /* Sort buttons */
  $$('[data-sort]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _sortBy = btn.dataset.sort;
      $$('[data-sort]').forEach(function(b) { b.classList.toggle('active', b.dataset.sort === _sortBy); });
      var grid = $('#vrGrid');
      if (grid) grid.innerHTML = _sortResults(_videos).map(function(v) { return renderVideoCard(v); }).join('');
    });
  });

  /* Query variant chips */
  $$('.vr-suggestion-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var q     = chip.dataset.query;
      _lastQuery = q;
      var input  = $('#vrKeyword');
      if (input) input.value = q;
      state.viralResearch.keyword = q;
      saveState();
      /* Open platform with new query */
      var isTikTok   = _lastPlatform === 'all' || _lastPlatform === 'tiktok';
      var isFacebook = _lastPlatform === 'all' || _lastPlatform === 'facebook';
      if (isTikTok)   window.open('https://www.tiktok.com/search/video?q=' + encodeURIComponent(q), '_blank', 'noopener');
      else if (isFacebook) window.open('https://www.facebook.com/search/videos/?q=' + encodeURIComponent(q), '_blank', 'noopener');
      _rerenderResults();
    });
  });

  /* Manual import button */
  var manualBtn = $('#vrManualImport');
  if (manualBtn) {
    manualBtn.addEventListener('click', function() {
      window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
      toast('Đang kiểm tra dữ liệu từ Extension...', 'info');
    });
  }

  /* Clear all */
  var clearBtn = $('#vrClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      _videos = [];
      _rerenderResults();
    });
  }
}

/* ============================================================
   HASH-BASED AUTO-IMPORT (triggered by extension opening this URL)
   ============================================================ */
(function _watchHash() {
  function onHash() {
    if (window.location.hash.includes('import')) {
      window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
    }
  }
  window.addEventListener('hashchange', onHash);
  /* Check once on module load */
  if (window.location.hash.includes('import')) {
    setTimeout(function() {
      window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
    }, 300);
  }
})();
