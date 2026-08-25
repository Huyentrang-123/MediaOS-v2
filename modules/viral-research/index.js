/* ============================================================
   MediaOS — Viral Research: Browser-Assisted Engine
   Keyword → Open platform → Extension collects DOM → Render
   No API calls. No Library. No mock data.
   ============================================================ */

'use strict';

/* ── Module state ──────────────────────────────────────── */
var _videos              = [];   /* scored + ranked + badged video array */
var _hasSearched         = false;
var _sampleVideoUrl      = '';
var _sampleHashtags      = [];   /* ['#skincare', '#serum', ...] */
var _sampleCaption       = '';
var _sampleCreator       = '';
var _lastSearchedTag     = '';
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
  container.innerHTML =
    '<div class="vr-page">' +
      _buildSampleSection() +
      '<div id="vrResults">' + _buildResultsArea() + '</div>' +
    '</div>';

  _bindSampleEvents();
  if (_hasSearched) _bindResultEvents();

  window.addEventListener('mediaos:import',    _onExtensionImport, { once: false });
  window.addEventListener('mediaos:videoMeta', _onVideoMeta,       { once: false });

  /* On load, check if extension has video meta waiting */
  window.dispatchEvent(new CustomEvent('mediaos:checkForVideoMeta'));
}

/* ============================================================
   SAMPLE VIDEO SECTION
   ============================================================ */
function _buildSampleSection() {
  var hashtagRow = '';
  if (_sampleHashtags.length > 0) {
    var chips = _sampleHashtags.slice(0, 10).map(function(tag) {
      return '<button class="vr-suggestion-chip" data-query="' + esc(tag) + '">' + esc(tag) + '</button>';
    }).join('');
    var creatorLabel = _sampleCreator ? '<span class="vr-query-display">Video: <strong>' + esc(_sampleCreator) + '</strong></span>' : '';
    hashtagRow =
      '<div class="vr-filter-row" style="flex-wrap:wrap;gap:8px;align-items:flex-start">' +
        creatorLabel +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
          '<span class="vr-filter-label">Hashtags:</span>' +
          chips +
        '</div>' +
        '<span style="font-size:12px;color:var(--text-2)">↑ Bấm hashtag để tìm video tương tự trên TikTok</span>' +
      '</div>';
  }

  return '<div class="vr-search-section">' +
    '<div class="vr-search-bar">' +
      '<div class="vr-search-input-wrap">' +
        '<span class="vr-search-icon">🎬</span>' +
        '<input type="text" id="vrVideoUrl" class="vr-search-input"' +
          ' placeholder="Paste link video TikTok hoặc Facebook..."' +
          ' value="' + esc(_sampleVideoUrl) + '" autocomplete="off">' +
      '</div>' +
      '<button class="btn btn-primary vr-search-btn" id="vrOpenVideoBtn">Mở video →</button>' +
    '</div>' +
    hashtagRow +
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
    '<div class="vr-empty-icon">🎬</div>' +
    '<div class="vr-empty-title">Tìm video tương tự</div>' +
    '<div class="vr-empty-desc">Cách dùng:</div>' +
    '<ol class="vr-instructions-list" style="text-align:left;max-width:420px;margin:12px auto 0">' +
      '<li>Paste link video TikTok mẫu vào ô trên → bấm <strong>Mở video →</strong></li>' +
      '<li>Video mở trong tab mới → bấm extension <strong>MediaOS</strong> → <strong>Phân tích video này</strong></li>' +
      '<li>Quay lại tab này — hashtags của video xuất hiện bên trên</li>' +
      '<li>Bấm một hashtag → trang search TikTok mở ra</li>' +
      '<li>Cuộn xuống 2–3 màn → bấm extension → <strong>Thu thập kết quả</strong></li>' +
    '</ol>' +
  '</div>';
}

function _buildReadyState() {
  /* No videos yet — show hashtag chips if available, else nudge user */
  if (_sampleHashtags.length === 0) {
    return '<div class="vr-instructions">' +
      '<div class="vr-waiting-indicator">⏳ Đang chờ phân tích từ Extension...</div>' +
      '<p style="font-size:13px;color:var(--text-2);margin-top:8px">' +
        'Mở video TikTok trong tab mới → bấm extension → <strong>Phân tích video này</strong>.' +
      '</p>' +
      '<button class="btn btn-outline btn-sm" id="vrManualImport" style="margin-top:10px">' +
        'Nhận kết quả từ Extension' +
      '</button>' +
    '</div>';
  }

  var chips = _sampleHashtags.slice(0, 10).map(function(tag) {
    return '<button class="vr-suggestion-chip" data-query="' + esc(tag) + '">' + esc(tag) + ' ↗</button>';
  }).join('');

  var creatorLine = _sampleCreator
    ? '<p style="font-size:13px;color:var(--text-2);margin-bottom:10px">Video mẫu: <strong>' + esc(_sampleCreator) + '</strong></p>'
    : '';

  return '<div class="vr-instructions">' +
    creatorLine +
    '<div class="vr-instructions-title">🏷 Bấm hashtag để tìm video tương tự:</div>' +
    '<div class="vr-suggestions" style="margin:10px 0">' + chips + '</div>' +
    '<div class="vr-tip-box" style="margin-top:12px">' +
      '<div class="vr-tip-row">📱 Mỗi hashtag mở TikTok Search tab "Top" (viral nhất). Cuộn xuống 2–3 màn rồi bấm extension <strong>Thu thập kết quả</strong>.</div>' +
    '</div>' +
    '<button class="btn btn-outline btn-sm" id="vrManualImport" style="margin-top:10px">' +
      'Nhận kết quả từ Extension' +
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
  var maxV = null, maxL = null, maxC = null, over100k = 0, over500c = 0;
  var hasViews = false, hasLikes = false, hasComments = false;

  all.forEach(function(v) {
    if (v.views != null) {
      hasViews = true;
      if (maxV == null || v.views > maxV) maxV = v.views;
      if (v.views > 100000) over100k++;
    }
    if (v.likes != null) {
      hasLikes = true;
      if (maxL == null || v.likes > maxL) maxL = v.likes;
    }
    if (v.comments != null) {
      hasComments = true;
      if (maxC == null || v.comments > maxC) maxC = v.comments;
      if (v.comments > 500) over500c++;
    }
  });

  var collectedDisplay = _totalCollectedCount > 0 ? _totalCollectedCount : all.length;

  var html = '<div class="vr-stats-row">' +
    _statBox(collectedDisplay, 'Extension đã thu thập') +
    _statBox(filtered.length, 'Sau lọc');

  if (hasViews) {
    html += _statBox(maxV != null ? formatNumber(maxV) : '—', 'View cao nhất');
    html += _statBox(over100k, 'Trên 100K views');
  }
  if (hasLikes) {
    html += _statBox(maxL != null ? formatNumber(maxL) : '—', 'Like cao nhất');
  }
  if (hasComments) {
    html += _statBox(maxC != null ? formatNumber(maxC) : '—', 'Comment cao nhất');
    html += _statBox(over500c, 'Trên 500 comments');
  }

  html += '</div>';
  return html;
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
  var chips = _sampleHashtags.slice(0, 8).map(function(tag) {
    return '<button class="vr-suggestion-chip" data-query="' + esc(tag) + '">' + esc(tag) + ' ↗</button>';
  }).join('');

  return '<div class="vr-action-bar">' +
    (chips
      ? '<div class="vr-action-row" style="flex-wrap:wrap">' +
          '<span class="vr-suggestions-label">Tìm thêm video tương tự:</span>' + chips +
        '</div>'
      : '') +
    '<div class="vr-action-row" style="margin-top:10px">' +
      '<span class="vr-action-hint">💡 TikTok: ở tab <strong>Top</strong> → cuộn thêm → bấm extension lần nữa.</span>' +
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
      matchedQuery: v.matchedQuery || _lastSearchedTag || _sampleVideoUrl || '',
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
   OPEN VIDEO (sample video URL input)
   ============================================================ */
function _doOpenVideo() {
  var input = $('#vrVideoUrl');
  var url   = (input ? input.value : _sampleVideoUrl).trim();
  if (!url) { toast('Hãy paste link video vào ô trên', 'info'); return; }

  /* Normalise URL */
  if (!url.startsWith('http')) url = 'https://' + url;

  _sampleVideoUrl = url;
  _hasSearched    = true;

  window.open(url, '_blank', 'noopener');
  _rerenderResults();
}

/* ============================================================
   VIDEO META RECEIVED FROM EXTENSION
   ============================================================ */
function _onVideoMeta(e) {
  var meta = e.detail || {};
  if (!meta.hashtags || meta.hashtags.length === 0) return;
  _sampleHashtags = meta.hashtags || [];
  _sampleCaption  = meta.caption  || '';
  _sampleCreator  = meta.creator  || '';
  if (meta.url && !_sampleVideoUrl) _sampleVideoUrl = meta.url;
  _hasSearched = true;

  /* Rebuild sample section to show hashtag chips */
  var sampleEl = document.querySelector('.vr-search-section');
  if (sampleEl) sampleEl.outerHTML = _buildSampleSection();
  /* Also bind chip events on the new section */
  _bindSampleEvents();

  _rerenderResults();
  toast('Nhận được ' + _sampleHashtags.length + ' hashtags từ Extension', 'success');
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
   EVENT BINDING — sample section
   ============================================================ */
function _bindSampleEvents() {
  var btn = $('#vrOpenVideoBtn');
  if (btn) btn.addEventListener('click', _doOpenVideo);

  var input = $('#vrVideoUrl');
  if (input) {
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') _doOpenVideo(); });
  }

  /* Hashtag chips in sample section */
  $$('.vr-search-section .vr-suggestion-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var tag = chip.dataset.query;
      _lastSearchedTag = tag;
      var searchUrl = 'https://www.tiktok.com/search?q=' + encodeURIComponent(tag);
      window.open(searchUrl, '_blank', 'noopener');
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

  /* Hashtag chips in action bar / ready state */
  $$('#vrResults .vr-suggestion-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var tag = chip.dataset.query;
      _lastSearchedTag = tag;
      window.open('https://www.tiktok.com/search?q=' + encodeURIComponent(tag), '_blank', 'noopener');
    });
  });

  /* Manual import — checks both video results and video meta */
  var manualBtn = $('#vrManualImport');
  if (manualBtn) manualBtn.addEventListener('click', function() {
    window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
    window.dispatchEvent(new CustomEvent('mediaos:checkForVideoMeta'));
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

}

/* ============================================================
   HASH-BASED AUTO-IMPORT
   ============================================================ */
(function _watchHash() {
  function onHash() {
    if (window.location.hash.includes('import')) {
      window.dispatchEvent(new CustomEvent('mediaos:checkForImport'));
    }
    if (window.location.hash.includes('videoMeta')) {
      window.dispatchEvent(new CustomEvent('mediaos:checkForVideoMeta'));
    }
  }
  window.addEventListener('hashchange', onHash);
  setTimeout(function() {
    onHash();
  }, 300);
})();
