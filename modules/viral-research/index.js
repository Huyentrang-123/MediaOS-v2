/* ============================================================
   MediaOS — Viral Research: Browser-Assisted Engine
   Keyword → Open platform → Extension collects DOM → Render
   No API calls. No Library. No mock data.
   ============================================================ */

'use strict';

/* ── Module state ──────────────────────────────────────── */
var _videos             = [];   /* scored + ranked + badged video array */
var _hasSearched        = false;
var _lastKeyword        = '';
var _lastQuery          = '';
var _lastMarket         = 'global';
var _lastPlatform       = 'all';
var _totalCollectedCount = 0;   /* cumulative unique adds (before 100-cap) */

/* Filter / sort state */
var _sortBy          = 'relevant'; /* 'relevant'|'views'|'comments'|'likes'|'score'|'newest' */
var _filterMinViews  = 0;
var _filterMinCmt    = 0;
var _filterOnlyStats = false;
var _filterPriCmt    = false;
var _filterHideDup   = false;
var _page            = 1;
var _pageSize        = 30;

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

  window.addEventListener('mediaos:import', _onExtensionImport, { once: false });
}

/* ============================================================
   SEARCH SECTION
   ============================================================ */
function _buildSearchSection(fs) {
  var platformChips = CONFIG.platforms.map(function(p) {
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
  if (!_hasSearched)        return _buildIdleState();
  if (_videos.length === 0) return _buildReadyState();
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
  var query   = _lastQuery;
  var platform = _lastPlatform;

  var isTikTok  = platform === 'all' || platform === 'tiktok';
  var isFacebook = platform === 'all' || platform === 'facebook';

  var tiktokUrl  = 'https://www.tiktok.com/search/video?q=' + encodeURIComponent(query);
  var facebookUrl = 'https://www.facebook.com/search/videos/?q=' + encodeURIComponent(query);

  var btns = '';
  if (isTikTok)   btns += '<a class="btn btn-primary vr-open-btn" href="' + tiktokUrl + '" target="_blank" rel="noopener noreferrer">Mở TikTok Search ↗</a>';
  if (isFacebook) btns += '<a class="btn btn-outline vr-open-btn" href="' + facebookUrl + '" target="_blank" rel="noopener noreferrer">Mở Facebook Videos ↗</a>';

  var queryDisplay = query !== kw
    ? '<div class="vr-query-display">Từ khóa: <strong>' + esc(kw) + '</strong> → <strong>' + esc(query) + '</strong></div>'
    : '<div class="vr-query-display">Từ khóa: <strong>' + esc(query) + '</strong></div>';

  var tipRows = '';
  if (isTikTok)   tipRows += '<div class="vr-tip-row">📱 <strong>TikTok:</strong> Sau khi trang tải → bấm <strong>↕ Sort</strong> → chọn <strong>"Likes"</strong> hoặc <strong>"Views"</strong> → cuộn xuống 2–3 màn hình.</div>';
  if (isFacebook) tipRows += '<div class="vr-tip-row">📘 <strong>Facebook:</strong> Chọn tab <strong>"Videos"</strong> → bộ lọc <strong>"Most Viewed"</strong> hoặc dùng trang <strong>Watch</strong> để lấy video nhiều view hơn.</div>';

  var tipBox = '<div class="vr-tip-box">' +
    '<div class="vr-tip-title">💡 Để lấy video triệu view — đừng bỏ qua bước này</div>' +
    tipRows +
  '</div>';

  var sortStep = '';
  if (isTikTok && isFacebook) {
    sortStep = 'TikTok → bấm <strong>Sort → Likes</strong>. Facebook → chọn <strong>Videos → Most Viewed</strong>.';
  } else if (isTikTok) {
    sortStep = 'Bấm <strong>↕ Sort</strong> → chọn <strong>"Likes"</strong> để lấy video nhiều tương tác nhất.';
  } else if (isFacebook) {
    sortStep = 'Chọn tab <strong>"Videos"</strong> → bộ lọc <strong>"Most Viewed"</strong>.';
  }

  return queryDisplay +
    '<div class="vr-platform-btns">' + btns + '</div>' +
    tipBox +
    '<div class="vr-instructions">' +
      '<div class="vr-instructions-title">📌 Hướng dẫn từng bước</div>' +
      '<ol class="vr-instructions-list">' +
        '<li>Bấm nút bên trên để mở trang tìm kiếm trên nền tảng.</li>' +
        '<li><strong>⚡ Quan trọng — sort trước khi thu thập:</strong> ' + sortStep + '</li>' +
        '<li>Cuộn xuống <strong>2–3 màn hình</strong> để load nhiều video hơn.</li>' +
        '<li>Bấm extension <strong>MediaOS</strong> trên thanh Chrome → <strong>"Thu thập kết quả đang hiển thị"</strong>.</li>' +
      '</ol>' +
      '<div class="vr-waiting-indicator">⏳ Đang chờ dữ liệu từ Extension...</div>' +
      '<button class="btn btn-outline btn-sm" id="vrManualImport" style="margin-top:10px">' +
        'Nhận kết quả từ Extension thủ công' +
      '</button>' +
    '</div>';
}

/* ============================================================
   RESULTS CONTENT (has videos)
   ============================================================ */
function _buildResultsContent() {
  var filtered = _applyFilters(_videos);
  var sorted   = _sortResults(filtered);
  var total    = filtered.length;
  var startIdx = (_page - 1) * _pageSize;
  var paged    = sorted.slice(startIdx, startIdx + _pageSize);

  var html = [];

  html.push(_buildStatsRow(filtered));
  html.push(_buildFilterBar());

  if (paged.length === 0) {
    html.push(
      '<div class="vr-filter-empty">' +
        'Không có video nào phù hợp bộ lọc. ' +
        '<button class="btn btn-sm btn-outline vr-reset-filter-btn" id="vrResetFilter2">Đặt lại bộ lọc</button>' +
      '</div>'
    );
  } else {
    html.push('<div class="vr-grid" id="vrGrid">' +
      paged.map(function(v) { return renderVideoCard(v); }).join('') +
    '</div>');
  }

  html.push(_buildPagination(total));
  html.push(_buildActionBar());

  return html.join('');
}

/* ============================================================
   STATS ROW
   ============================================================ */
function _buildStatsRow(filtered) {
  var all = _videos;
  var maxV = null, maxC = null, over100k = 0, over500c = 0;

  all.forEach(function(v) {
    if (v.views != null) {
      if (maxV == null || v.views > maxV) maxV = v.views;
      if (v.views > 100000) over100k++;
    }
    if (v.comments != null) {
      if (maxC == null || v.comments > maxC) maxC = v.comments;
      if (v.comments > 500) over500c++;
    }
  });

  var collectedDisplay = _totalCollectedCount > 0 ? _totalCollectedCount : all.length;

  return '<div class="vr-stats-row">' +
    _statBox(collectedDisplay, 'Extension đã thu thập') +
    _statBox(filtered.length, 'Sau lọc') +
    _statBox(maxV != null ? formatNumber(maxV) : '—', 'View cao nhất') +
    _statBox(maxC != null ? formatNumber(maxC) : '—', 'Comment cao nhất') +
    _statBox(over100k, 'Trên 100K views') +
    _statBox(over500c, 'Trên 500 comments') +
  '</div>';
}

function _statBox(val, label) {
  return '<div class="vr-stat-box">' +
    '<div class="vr-stat-box-val">' + val + '</div>' +
    '<div class="vr-stat-box-label">' + label + '</div>' +
  '</div>';
}

/* ============================================================
   FILTER BAR
   ============================================================ */
function _buildFilterBar() {
  function opt(val, label, selected) {
    return '<option value="' + val + '"' + (val == selected ? ' selected' : '') + '>' + label + '</option>';
  }

  var sortSel =
    '<select id="vrSortSelect" class="vr-filter-select">' +
      opt('relevant',  'Phù hợp nhất',       _sortBy) +
      opt('views',     'View cao nhất',        _sortBy) +
      opt('comments',  'Comment nhiều nhất',   _sortBy) +
      opt('likes',     'Like nhiều nhất',      _sortBy) +
      opt('score',     'Viral Score cao nhất', _sortBy) +
      opt('newest',    'Mới nhất',             _sortBy) +
    '</select>';

  var viewSel =
    '<select id="vrViewSelect" class="vr-filter-select">' +
      opt(0,       'Tất cả views', _filterMinViews) +
      opt(10000,   'Trên 10K',     _filterMinViews) +
      opt(50000,   'Trên 50K',     _filterMinViews) +
      opt(100000,  'Trên 100K',    _filterMinViews) +
      opt(500000,  'Trên 500K',    _filterMinViews) +
      opt(1000000, 'Trên 1M',      _filterMinViews) +
    '</select>';

  var cmtSel =
    '<select id="vrCmtSelect" class="vr-filter-select">' +
      opt(0,    'Tất cả comments', _filterMinCmt) +
      opt(50,   'Trên 50',         _filterMinCmt) +
      opt(100,  'Trên 100',        _filterMinCmt) +
      opt(500,  'Trên 500',        _filterMinCmt) +
      opt(1000, 'Trên 1K',         _filterMinCmt) +
    '</select>';

  return '<div class="vr-filter-bar">' +
    '<div class="vr-filter-controls">' +
      sortSel + viewSel + cmtSel +
      '<label class="vr-filter-check"><input type="checkbox" id="vrOnlyStats"' + (_filterOnlyStats ? ' checked' : '') + '><span>Chỉ có đủ chỉ số</span></label>' +
      '<label class="vr-filter-check"><input type="checkbox" id="vrPriCmt"'   + (_filterPriCmt   ? ' checked' : '') + '><span>Ưu tiên comment</span></label>' +
      '<label class="vr-filter-check"><input type="checkbox" id="vrHideDup"'  + (_filterHideDup  ? ' checked' : '') + '><span>Ẩn trùng lặp</span></label>' +
      '<button class="btn btn-outline btn-sm vr-reset-filter-btn" id="vrResetFilter">Đặt lại bộ lọc</button>' +
    '</div>' +
  '</div>';
}

/* ============================================================
   FILTER + SORT
   ============================================================ */
function _applyFilters(videos) {
  var seen = {};
  return videos.filter(function(v) {
    if (_filterMinViews > 0 && (v.views    == null || v.views    < _filterMinViews)) return false;
    if (_filterMinCmt   > 0 && (v.comments == null || v.comments < _filterMinCmt))   return false;
    if (_filterOnlyStats && !v.statsAvailable) return false;
    if (_filterHideDup) {
      var key = (v.caption || '').trim().toLowerCase();
      if (key && seen[key]) return false;
      if (key) seen[key] = true;
    }
    return true;
  });
}

function _sortResults(arr) {
  var copy = arr.slice();
  switch (_sortBy) {
    case 'views':
      return copy.sort(function(a, b) { return (b.views    || 0) - (a.views    || 0); });
    case 'comments':
      return copy.sort(function(a, b) { return (b.comments || 0) - (a.comments || 0); });
    case 'likes':
      return copy.sort(function(a, b) { return (b.likes    || 0) - (a.likes    || 0); });
    case 'score':
      return copy.sort(function(a, b) { return (b.viralScore || 0) - (a.viralScore || 0); });
    case 'newest':
      return copy.sort(function(a, b) {
        return new Date(b.postedAt || 0) - new Date(a.postedAt || 0);
      });
    default: /* 'relevant' — sort by researchRank, null to end */
      return copy.sort(function(a, b) {
        var ar = a.researchRank != null ? a.researchRank : -1;
        var br = b.researchRank != null ? b.researchRank : -1;
        return br - ar;
      });
  }
}

/* ============================================================
   PAGINATION
   ============================================================ */
function _buildPagination(total) {
  if (total <= _pageSize) return '';
  var totalPages = Math.ceil(total / _pageSize);
  var html = '<div class="vr-pagination">';

  html += '<button class="vr-page-btn" data-page="' + Math.max(1, _page - 1) + '"' + (_page <= 1 ? ' disabled' : '') + '>Trước</button>';

  var start = Math.max(1, _page - 2);
  var end   = Math.min(totalPages, _page + 2);

  if (start > 1) {
    html += '<button class="vr-page-btn" data-page="1">1</button>';
    if (start > 2) html += '<span class="vr-page-ellipsis">…</span>';
  }

  for (var p = start; p <= end; p++) {
    html += '<button class="vr-page-btn' + (p === _page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span class="vr-page-ellipsis">…</span>';
    html += '<button class="vr-page-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
  }

  html += '<button class="vr-page-btn" data-page="' + Math.min(totalPages, _page + 1) + '"' + (_page >= totalPages ? ' disabled' : '') + '>Sau</button>';
  html += '</div>';
  return html;
}

/* ============================================================
   ACTION BAR — collect more + query variants
   Single button at bottom of results.
   - TikTok only  → open TikTok Search directly
   - Facebook only → open Facebook Videos directly
   - All           → dropdown with two choices
   ============================================================ */
function _buildActionBar() {
  var query    = _lastQuery;
  var platform = _lastPlatform;
  var tiktokUrl   = 'https://www.tiktok.com/search/video?q=' + encodeURIComponent(query);
  var facebookUrl = 'https://www.facebook.com/search/videos/?q=' + encodeURIComponent(query);

  var collectBtn;
  if (platform === 'tiktok') {
    collectBtn = '<a class="btn btn-primary vr-collect-btn" href="' + tiktokUrl + '" target="_blank" rel="noopener noreferrer">Thu thập thêm kết quả ↗</a>';
  } else if (platform === 'facebook') {
    collectBtn = '<a class="btn btn-primary vr-collect-btn" href="' + facebookUrl + '" target="_blank" rel="noopener noreferrer">Thu thập thêm kết quả ↗</a>';
  } else {
    /* All platforms — dropdown */
    collectBtn =
      '<div class="vr-collect-wrap">' +
        '<button class="btn btn-primary vr-collect-btn" id="vrCollectMoreBtn">Thu thập thêm kết quả ▾</button>' +
        '<div class="vr-collect-menu" id="vrCollectMenu" hidden>' +
          '<a class="vr-collect-item" href="' + tiktokUrl + '" target="_blank" rel="noopener noreferrer">Thu thập thêm từ TikTok ↗</a>' +
          '<a class="vr-collect-item" href="' + facebookUrl + '" target="_blank" rel="noopener noreferrer">Thu thập thêm từ Facebook ↗</a>' +
        '</div>' +
      '</div>';
  }

  var variants = typeof vrAllVariants === 'function' ? vrAllVariants(_lastKeyword, _lastMarket) : [];
  var chips = variants.slice(1, 7).map(function(q) {
    return '<button class="vr-suggestion-chip" data-query="' + esc(q) + '">' + esc(q) + '</button>';
  }).join('');

  return '<div class="vr-action-bar">' +
    '<div class="vr-action-row">' +
      collectBtn +
      '<span class="vr-action-hint">💡 Nhớ sort theo <strong>Likes/Views</strong> trên nền tảng → cuộn thêm → bấm extension lần nữa.</span>' +
    '</div>' +
    (chips ? '<div class="vr-suggestions" style="margin-top:10px"><span class="vr-suggestions-label">Thử thêm:</span>' + chips + '</div>' : '') +
    '<div class="vr-action-row" style="margin-top:10px">' +
      '<button class="btn btn-outline btn-sm" id="vrClearBtn">Xóa tất cả kết quả</button>' +
    '</div>' +
  '</div>';
}

/* ============================================================
   BADGE PERCENTILE COMPUTATION
   Top 20% of views → _badgeViewTop = true
   Top 20% of comments → _badgeCmtTop = true
   ============================================================ */
function _computeBadges(videos) {
  var viewVals = videos.filter(function(v) { return v.views    != null; }).map(function(v) { return v.views;    });
  var cmtVals  = videos.filter(function(v) { return v.comments != null; }).map(function(v) { return v.comments; });

  viewVals.sort(function(a, b) { return b - a; });
  cmtVals.sort(function(a, b)  { return b - a; });

  var viewTopN = Math.ceil(viewVals.length * 0.20);
  var cmtTopN  = Math.ceil(cmtVals.length  * 0.20);

  var viewThresh = viewTopN > 0 ? viewVals[viewTopN - 1] : null;
  var cmtThresh  = cmtTopN  > 0 ? cmtVals[cmtTopN  - 1] : null;

  return videos.map(function(v) {
    return Object.assign({}, v, {
      _badgeViewTop: viewThresh != null && v.views    != null && v.views    >= viewThresh,
      _badgeCmtTop:  cmtThresh  != null && v.comments != null && v.comments >= cmtThresh
    });
  });
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
  var existingIds = {};
  _videos.forEach(function(v) { existingIds[v.id] = true; });

  var enriched = incoming.map(function(v) {
    var hoursOld = v.postedAt ? Math.max(1, (Date.now() - new Date(v.postedAt).getTime()) / 3600000) : null;
    var vph      = (hoursOld && v.views) ? v.views / hoursOld : null;
    return Object.assign({}, v, {
      market:       v.market       || _lastMarket,
      matchedQuery: v.matchedQuery || _lastQuery || _lastKeyword,
      viewsPerHour: v.viewsPerHour || vph
    });
  });

  var added  = enriched.filter(function(v) { return !existingIds[v.id]; });
  var merged = _videos.concat(added).slice(0, 100);

  _totalCollectedCount += added.length;

  var scored  = scoreVideos(merged);
  var ranked  = computeResearchRank(scored, _filterPriCmt);
  var badged  = _computeBadges(ranked);
  _videos = badged.map(function(v) {
    return Object.assign({}, v, { whyViral: getWhyViral(v) });
  });

  _hasSearched = true;
  _page = 1; /* reset page on new batch */
  _rerenderResults();

  if (added.length > 0) {
    toast('Nhận được ' + added.length + ' video từ Extension', 'success');
  } else {
    toast('Không có video mới (đã có hết trong danh sách)', 'info');
  }
}

/* ============================================================
   DO SEARCH
   ============================================================ */
function _doSearch() {
  var input = $('#vrKeyword');
  if (input) {
    state.viralResearch.keyword = input.value;
    saveState();
  }

  var kw = (state.viralResearch.keyword || '').trim();
  if (!kw) { toast('Hãy nhập từ khóa', 'info'); return; }

  var fs        = state.viralResearch;
  _lastKeyword  = kw;
  _lastMarket   = fs.region   || 'global';
  _lastPlatform = fs.platform || 'all';

  _lastQuery = (typeof vrLocalizeQuery === 'function')
    ? vrLocalizeQuery(kw, _lastMarket)
    : kw;

  _hasSearched = true;
  _rerenderResults();

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
   EVENT BINDING — search section
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

/* ============================================================
   EVENT BINDING — results section
   ============================================================ */
function _bindResultEvents() {
  /* Sort select */
  var sortSel = $('#vrSortSelect');
  if (sortSel) sortSel.addEventListener('change', function() {
    _sortBy = sortSel.value;
    _page   = 1;
    _rerenderResults();
  });

  /* View threshold */
  var viewSel = $('#vrViewSelect');
  if (viewSel) viewSel.addEventListener('change', function() {
    _filterMinViews = parseInt(viewSel.value, 10) || 0;
    _page = 1;
    _rerenderResults();
  });

  /* Comment threshold */
  var cmtSel = $('#vrCmtSelect');
  if (cmtSel) cmtSel.addEventListener('change', function() {
    _filterMinCmt = parseInt(cmtSel.value, 10) || 0;
    _page = 1;
    _rerenderResults();
  });

  /* Only stats checkbox */
  var chkStats = $('#vrOnlyStats');
  if (chkStats) chkStats.addEventListener('change', function() {
    _filterOnlyStats = chkStats.checked;
    _page = 1;
    _rerenderResults();
  });

  /* Prioritize comments checkbox — also recomputes researchRank */
  var chkPriCmt = $('#vrPriCmt');
  if (chkPriCmt) chkPriCmt.addEventListener('change', function() {
    _filterPriCmt = chkPriCmt.checked;
    _videos = computeResearchRank(_videos, _filterPriCmt);
    _page   = 1;
    _rerenderResults();
  });

  /* Hide duplicates checkbox */
  var chkDup = $('#vrHideDup');
  if (chkDup) chkDup.addEventListener('change', function() {
    _filterHideDup = chkDup.checked;
    _page = 1;
    _rerenderResults();
  });

  /* Reset filter buttons */
  function resetFilters() {
    _sortBy          = 'relevant';
    _filterMinViews  = 0;
    _filterMinCmt    = 0;
    _filterOnlyStats = false;
    _filterPriCmt    = false;
    _filterHideDup   = false;
    _page            = 1;
    _rerenderResults();
  }
  var resetBtn  = $('#vrResetFilter');
  var resetBtn2 = $('#vrResetFilter2');
  if (resetBtn)  resetBtn.addEventListener('click',  resetFilters);
  if (resetBtn2) resetBtn2.addEventListener('click', resetFilters);

  /* Pagination buttons */
  $$('[data-page]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.disabled) return;
      var newPage = parseInt(btn.dataset.page, 10);
      if (!isNaN(newPage) && newPage !== _page) {
        _page = newPage;
        _rerenderResults();
        var el = $('#vrResults');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
      var isTikTok   = _lastPlatform === 'all' || _lastPlatform === 'tiktok';
      var isFacebook = _lastPlatform === 'all' || _lastPlatform === 'facebook';
      if (isTikTok)        window.open('https://www.tiktok.com/search/video?q=' + encodeURIComponent(q), '_blank', 'noopener');
      else if (isFacebook) window.open('https://www.facebook.com/search/videos/?q=' + encodeURIComponent(q), '_blank', 'noopener');
      _rerenderResults();
    });
  });

  /* Manual import */
  var manualBtn = $('#vrManualImport');
  if (manualBtn) manualBtn.addEventListener('click', function() {
    window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
    toast('Đang kiểm tra dữ liệu từ Extension...', 'info');
  });

  /* Clear all */
  var clearBtn = $('#vrClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', function() {
    _videos = [];
    _totalCollectedCount = 0;
    _page   = 1;
    _rerenderResults();
  });

  /* Collect more dropdown (platform = 'all') */
  var collectMoreBtn = $('#vrCollectMoreBtn');
  var collectMenu    = $('#vrCollectMenu');
  if (collectMoreBtn && collectMenu) {
    collectMoreBtn.addEventListener('click', function(e) {
      var opening = collectMenu.hidden; /* true = about to open */
      collectMenu.hidden = !opening;
      e.stopPropagation();
      if (opening) {
        /* Close menu on next click anywhere outside this button */
        document.addEventListener('click', function() {
          if (collectMenu) collectMenu.hidden = true;
        }, { once: true });
      }
    });
  }
}

/* ============================================================
   HASH-BASED AUTO-IMPORT
   ============================================================ */
(function _watchHash() {
  function onHash() {
    if (window.location.hash.includes('import')) {
      window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
    }
  }
  window.addEventListener('hashchange', onHash);
  if (window.location.hash.includes('import')) {
    setTimeout(function() {
      window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
    }, 300);
  }
})();
