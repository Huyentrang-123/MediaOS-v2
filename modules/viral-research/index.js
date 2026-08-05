/* ============================================================
   MediaOS — Viral Research: Zero-Cost Search
   Search = Library (IndexedDB) + free external links.
   No TikHub, no paid API, no mock data.
   ============================================================ */

'use strict';

/* ---- Search state ---- */
var _libraryResults = [];   // matched videos from IndexedDB
var _queryVariants  = [];   // suggestion chips from vrAllVariants()
var _searchState    = 'idle'; // 'idle' | 'searching' | 'done'
var _sortBy         = 'score'; // 'score' | 'views' | 'newest'
var _isSaving       = false;

function _resetSearchState() {
  _libraryResults = [];
  _queryVariants  = [];
  _searchState    = 'idle';
}

/* ============================================================
   RENDER — main entry point
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
    _bindQueryChipEvents();
    _bindSaveEvents();
  }

  /* Load Library stats into the idle placeholder */
  if (_searchState === 'idle') _updateLibraryStats();
}

/* ============================================================
   SEARCH SECTION — always visible
   ============================================================ */
function _buildSearchSection(fs) {
  var platformOpts = [
    { id: 'all',      icon: '',  label: 'Tất cả' },
    { id: 'tiktok',   icon: '♪', label: 'TikTok' },
    { id: 'facebook', icon: 'f', label: 'Facebook' }
  ];

  var platformChips = platformOpts.map(function(p) {
    return '<button class="vr-chip' + (fs.platform === p.id ? ' active' : '') +
      '" data-platform="' + p.id + '">' +
      (p.icon ? '<span class="vr-chip-icon">' + p.icon + '</span>' : '') +
      p.label + '</button>';
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
      '<span class="vr-filter-label">Khu vực</span>' +
      '<div class="vr-chip-group" id="regionChips">' + regionChips + '</div>' +
    '</div>' +
  '</div>';
}

/* ============================================================
   RESULTS AREA router
   ============================================================ */
function _buildResultsArea() {
  if (_searchState === 'idle')      return _buildIdleState();
  if (_searchState === 'searching') return _buildSearchingState();
  return _buildResultsContent();
}

function _buildIdleState() {
  return '<div class="vr-free-badge">✅ Chế độ miễn phí · Không dùng TikHub credit</div>' +
    '<div id="vrLibStats" class="vr-lib-stats"></div>' +
    '<div class="vr-empty">' +
      '<div class="vr-empty-icon">🔍</div>' +
      '<div class="vr-empty-title">Tìm video trong Research Library</div>' +
      '<div class="vr-empty-desc">' +
        'Nhập từ khóa, chọn nền tảng và khu vực, rồi bấm <strong>Phân tích</strong>.<br>' +
        'MediaOS tìm trong video đã lưu của đội và gợi ý nguồn nghiên cứu miễn phí.' +
      '</div>' +
    '</div>';
}

function _buildSearchingState() {
  return '<div class="vr-empty">' +
    '<div class="vr-empty-icon">⏳</div>' +
    '<div class="vr-empty-title">Đang tìm trong Library...</div>' +
    '<div class="vr-empty-desc">Tìm kiếm cục bộ — không gọi API nào.</div>' +
  '</div>';
}

/* ============================================================
   RESULTS CONTENT — after search
   Order: badge → summary → sort → library grid → query chips
          → external sources → save panel
   ============================================================ */
function _buildResultsContent() {
  var kw       = state.viralResearch.keyword;
  var fs       = state.viralResearch;
  var sorted   = _sortResults(_libraryResults);
  var total    = _libraryResults.length;
  var html     = [];

  /* Free mode badge */
  html.push('<div class="vr-free-badge">✅ Chế độ miễn phí · Không dùng TikHub credit</div>');

  /* Summary */
  html.push(
    '<div class="vr-summary">' +
    'Tìm thấy <strong>' + total + '</strong> video trong Library phù hợp với ' +
    '"<strong>' + esc(kw) + '</strong>"' +
    '</div>'
  );

  /* Library results */
  if (total > 0) {
    html.push(_buildLibrarySortBar());
    html.push('<div class="vr-grid" id="vrGrid">' +
      sorted.map(function(v) { return _renderLibraryCard(v); }).join('') +
    '</div>');
  } else {
    html.push(
      '<div class="vr-lib-empty">' +
        '<div class="vr-empty-icon">📚</div>' +
        '<div class="vr-empty-title">Thư viện chưa có video phù hợp</div>' +
        '<div class="vr-empty-desc">Hãy mở nguồn nghiên cứu bên dưới, tìm video và lưu link vào MediaOS.</div>' +
      '</div>'
    );
  }

  /* Query suggestion chips */
  if (_queryVariants.length > 1) html.push(_buildQueryChips());

  /* External sources */
  html.push(_buildExternalSources(kw, fs.platform, fs.region));

  /* Save link panel */
  html.push(_buildSavePanel());

  return html.join('');
}

/* ---- Sort bar for Library results ---- */
function _buildLibrarySortBar() {
  var sorts = [
    { id: 'score',  label: 'Viral Score' },
    { id: 'views',  label: 'Views' },
    { id: 'newest', label: 'Mới nhất' }
  ];
  return '<div class="vr-sort-bar" id="vrSortBar">' +
    '<div class="vr-sort-group">' +
      '<span class="vr-sort-label">Sắp xếp</span>' +
      sorts.map(function(s) {
        return '<button class="vr-sort-btn' + (_sortBy === s.id ? ' active' : '') +
          '" data-sort="' + s.id + '">' + s.label + '</button>';
      }).join('') +
    '</div>' +
  '</div>';
}

/* ---- Library card (inline in Viral Search) ---- */
function _renderLibraryCard(entry) {
  var scoreInfo = getScoreLabel(entry.viralScore || 0);
  var flagMap   = { vn: '🇻🇳', kr: '🇰🇷', cn: '🇨🇳', tw: '🇹🇼' };
  var iconMap   = { tiktok: '♪', facebook: 'f', douyin: '抖' };
  var flag      = flagMap[entry.region] || '';
  var icon      = iconMap[entry.platform] || '▶';
  var platform  = entry.platform === 'tiktok'   ? 'TikTok'
                : entry.platform === 'douyin'   ? 'Douyin'
                : entry.platform === 'facebook' ? 'Facebook'
                : (entry.platform || '');
  var ago       = entry.postedAt ? timeAgo(entry.postedAt.slice(0, 10)) : '';
  var score     = entry.viralScore != null ? entry.viralScore
                : (LibraryAnalysis ? LibraryAnalysis.estimateViralScore(entry) : null);

  var thumb = entry.thumbnail
    ? '<img src="' + esc(entry.thumbnail) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
    : '<div class="vr-thumb-placeholder">' + icon + '</div>';

  return '<div class="vr-card">' +
    '<div class="vr-thumb">' +
      thumb +
      '<div class="vr-platform ' + esc(entry.platform || '') + '">' +
        '<span>' + icon + '</span>' +
        '<span>' + platform + '</span>' +
      '</div>' +
      (score != null ? '<div class="vr-score-badge' + (score >= 85 ? ' hot' : '') + '">' + score + '/100</div>' : '') +
    '</div>' +
    '<div class="vr-body">' +
      '<a class="vr-title" href="' + esc(entry.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
        esc(entry.title || '(Chưa có tiêu đề)') +
      '</a>' +
      '<div class="vr-meta">' +
        (flag ? '<span class="vr-flag">' + flag + '</span>' : '') +
        '<span class="vr-creator" title="' + esc(entry.creator || '') + '">' + esc(entry.creator || '') + '</span>' +
        '<span class="vr-meta-date">' + ago + '</span>' +
      '</div>' +
      '<div class="vr-stats">' +
        (entry.views    ? '<span class="vr-stat-item">👁 '  + formatNumber(entry.views)    + '</span>' : '') +
        (entry.likes    ? '<span class="vr-stat-item">❤ '   + formatNumber(entry.likes)    + '</span>' : '') +
        (entry.comments ? '<span class="vr-stat-item">💬 ' + formatNumber(entry.comments) + '</span>' : '') +
        (entry.shares   ? '<span class="vr-stat-item">↗ '   + formatNumber(entry.shares)   + '</span>' : '') +
      '</div>' +
      '<div class="vr-badges">' +
        (score != null ? '<span class="badge ' + scoreInfo.cls + '">' + scoreInfo.label + '</span>' : '') +
        '<span class="badge badge-gray">📚 Library</span>' +
      '</div>' +
    '</div>' +
    '<div class="vr-actions">' +
      '<a class="vr-btn-watch" href="' + esc(entry.url || '#') + '" target="_blank" rel="noopener noreferrer">Xem video</a>' +
      '<span class="vr-btn-save saved" title="Đã có trong Library">⭐ Đã lưu</span>' +
    '</div>' +
  '</div>';
}

/* ---- Query suggestion chips ---- */
function _buildQueryChips() {
  var chips = _queryVariants.slice(1, 9);
  if (chips.length === 0) return '';
  return '<div class="vr-suggestions">' +
    '<span class="vr-suggestions-label">Tìm thêm với:</span>' +
    chips.map(function(q) {
      return '<button class="vr-suggestion-chip" data-query="' + esc(q) + '">' + esc(q) + '</button>';
    }).join('') +
  '</div>';
}

/* ---- External search sources ---- */
function _buildExternalSources(keyword, platform, region) {
  var localQ  = vrLocalizeQuery(keyword, region);
  var qOrig   = encodeURIComponent(keyword);
  var qLoc    = encodeURIComponent(localQ);

  /* CN-localized query (for Douyin even when region != cn) */
  var qCN  = region === 'cn' ? qLoc : encodeURIComponent(vrLocalizeQuery(keyword, 'cn'));
  var qVN  = encodeURIComponent(keyword);

  var isTK  = platform === 'all' || platform === 'tiktok';
  var isFB  = platform === 'all' || platform === 'facebook';
  var isDY  = platform === 'douyin' || region === 'cn';
  var showDY = isDY || region === 'global' || region === 'cn';

  var sources = [];

  if (isTK && region !== 'cn') {
    sources.push({ icon: '♪',  label: 'TikTok Search',          url: 'https://www.tiktok.com/search?q=' + qLoc });
    sources.push({ icon: '🎯', label: 'TikTok Creative Center',  url: 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en' });
  }
  if (showDY) {
    sources.push({ icon: '抖', label: 'Douyin Search',           url: 'https://www.douyin.com/search/' + qCN });
  }
  if (isFB) {
    sources.push({ icon: 'f',  label: 'Facebook Videos',         url: 'https://www.facebook.com/search/videos/?q=' + qLoc });
    sources.push({ icon: '📢', label: 'Facebook Ad Library',     url: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=' + qLoc + '&search_type=keyword_unordered' });
  }
  sources.push({ icon: '🔎', label: 'Google × TikTok',          url: 'https://www.google.com/search?q=site%3Atiktok.com+' + qLoc });
  sources.push({ icon: '🔎', label: 'Google × FB Reels',        url: 'https://www.google.com/search?q=site%3Afacebook.com%2Freel+' + qLoc });

  var btnHtml = sources.map(function(s) {
    return '<a class="vr-ext-btn" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="vr-ext-icon">' + s.icon + '</span>' +
      '<span>' + esc(s.label) + '</span>' +
    '</a>';
  }).join('');

  var localNote = localQ !== keyword
    ? ' · Từ khóa: <strong>' + esc(localQ) + '</strong>'
    : '';

  return '<div class="vr-ext-sources">' +
    '<div class="vr-section-title">🔗 Nguồn nghiên cứu miễn phí</div>' +
    '<div class="vr-ext-note">Bấm để mở trang tìm kiếm — tìm video, sau đó dán link vào ô bên dưới để lưu.' + localNote + '</div>' +
    '<div class="vr-ext-btns">' + btnHtml + '</div>' +
  '</div>';
}

/* ---- Save link panel ---- */
function _buildSavePanel() {
  return '<div class="vr-save-panel" id="vrSavePanel">' +
    '<div class="vr-section-title">💾 Lưu link video về MediaOS</div>' +
    '<div class="vr-save-desc">Dán link TikTok / Facebook / Douyin — mỗi dòng một link, hoặc import CSV</div>' +
    '<textarea id="vrSaveInput" class="vr-save-textarea" rows="3"' +
    ' placeholder="https://www.tiktok.com/@creator/video/123&#10;https://www.facebook.com/reel/456"></textarea>' +
    '<div class="vr-save-actions">' +
      '<button id="vrSaveBtn" class="btn btn-primary btn-sm">Lưu vào Library</button>' +
      '<label class="btn btn-outline btn-sm vr-csv-label" for="vrSaveCsvFile">Import CSV</label>' +
      '<input type="file" id="vrSaveCsvFile" accept=".csv" style="display:none">' +
      '<span id="vrSaveStatus" class="vr-save-status"></span>' +
    '</div>' +
  '</div>';
}

/* ---- Library stats (shown in idle state) ---- */
async function _updateLibraryStats() {
  var el = $('#vrLibStats');
  if (!el) return;
  try {
    var all      = await LibraryStorage.getAll();
    var total    = all.length;
    var tiktok   = all.filter(function(v) { return v.platform === 'tiktok' || v.platform === 'douyin'; }).length;
    var facebook = all.filter(function(v) { return v.platform === 'facebook'; }).length;
    var scores   = all.map(function(v) { return v.viralScore || 0; }).filter(function(s) { return s > 0; });
    var topScore = scores.length > 0 ? Math.max.apply(null, scores) : null;

    if (total === 0) {
      el.innerHTML = '<div class="vr-lib-stat-empty">Library trống — chưa có video nào. Lưu link từ nguồn nghiên cứu để bắt đầu.</div>';
      return;
    }

    el.innerHTML =
      '<div class="vr-lib-stat"><div class="vr-lib-stat-val">' + total + '</div><div class="vr-lib-stat-label">Tổng video</div></div>' +
      '<div class="vr-lib-stat"><div class="vr-lib-stat-val">' + tiktok + '</div><div class="vr-lib-stat-label">TikTok / Douyin</div></div>' +
      '<div class="vr-lib-stat"><div class="vr-lib-stat-val">' + facebook + '</div><div class="vr-lib-stat-label">Facebook</div></div>' +
      (topScore != null ? '<div class="vr-lib-stat"><div class="vr-lib-stat-val">' + topScore + '/100</div><div class="vr-lib-stat-label">Viral Score cao nhất</div></div>' : '');
  } catch (e) { /* ignore */ }
}

/* ============================================================
   LIBRARY SEARCH
   ============================================================ */
function _searchLibrary(videos, keyword, platform, region) {
  var kw     = keyword.toLowerCase();
  var kwNorm = vrNormVi(kw);
  var syns   = vrGetSynonyms(kw); /* cross-language synonyms */

  return videos.filter(function(v) {
    /* Platform filter */
    if (platform !== 'all') {
      var pMatch = platform === 'tiktok'
        ? (v.platform === 'tiktok' || v.platform === 'douyin')
        : v.platform === platform;
      if (!pMatch) return false;
    }

    /* Region filter */
    if (region !== 'global' && v.region && v.region !== region) return false;

    /* Build searchable text from all fields */
    var text = [
      v.title, v.creator, v.creatorHandle,
      v.notes, v.hook, v.cta,
      v.matchedQuery, v.localizedKeyword,
      (v.topics      || []).join(' '),
      (v.contentTags || []).join(' ')
    ].filter(Boolean).join(' ');

    var textLow  = text.toLowerCase();
    var textNorm = vrNormVi(text);

    /* Direct match (diacritic-insensitive) */
    if (textNorm.indexOf(kwNorm) !== -1 || textLow.indexOf(kw) !== -1) return true;

    /* Cross-language synonym match */
    for (var i = 0; i < syns.length; i++) {
      if (textLow.indexOf(syns[i]) !== -1) return true;
    }

    return false;
  });
}

function _sortResults(videos) {
  var arr = videos.slice();
  if (_sortBy === 'views')  return arr.sort(function(a, b) { return (b.views || 0) - (a.views || 0); });
  if (_sortBy === 'newest') return arr.sort(function(a, b) {
    return new Date(b.postedAt || b.addedAt || 0) - new Date(a.postedAt || a.addedAt || 0);
  });
  return arr.sort(function(a, b) { return (b.viralScore || 0) - (a.viralScore || 0); });
}

/* ============================================================
   DO SEARCH (zero-cost — IndexedDB only)
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

  var fs = state.viralResearch;

  _resetSearchState();
  _searchState = 'searching';

  var btn = $('#vrSearchBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang tìm...'; }

  var resultsEl = $('#vrResults');
  if (resultsEl) resultsEl.innerHTML = _buildSearchingState();

  try {
    var allVideos = await LibraryStorage.getAll();
    _libraryResults = _searchLibrary(allVideos, kw, fs.platform, fs.region);
    _queryVariants  = vrAllVariants(kw, fs.region);
    _searchState    = 'done';
  } catch (err) {
    console.error('[VR] search error:', err);
    _searchState = 'idle';
    toast('Lỗi tìm kiếm: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Phân tích'; }
  }

  if (_searchState === 'done') _rerenderResults();
}

/* ============================================================
   RE-RENDER
   ============================================================ */
function _rerenderResults() {
  var el = $('#vrResults');
  if (!el) return;
  el.innerHTML = _buildResultsContent();
  _bindSortEvents();
  _bindQueryChipEvents();
  _bindSaveEvents();
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function _bindSearchEvents() {
  var btn = $('#vrSearchBtn');
  if (btn) btn.addEventListener('click', _doSearch);

  var input = $('#vrKeyword');
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

  /* Platform chips */
  $$('#platformChips .vr-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      state.viralResearch.platform = chip.dataset.platform;
      $$('#platformChips .vr-chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.platform === chip.dataset.platform);
      });
      if (_searchState === 'done') _doSearch();
    });
  });

  /* Region chips */
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
      var sorted = _sortResults(_libraryResults);
      var grid   = $('#vrGrid');
      if (grid) {
        grid.innerHTML = sorted.map(function(v) { return _renderLibraryCard(v); }).join('');
      }
      /* Update active button */
      $$('[data-sort]').forEach(function(b) {
        b.classList.toggle('active', b.dataset.sort === _sortBy);
      });
    });
  });
}

function _bindQueryChipEvents() {
  $$('.vr-suggestion-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var query = chip.dataset.query;
      state.viralResearch.keyword = query;
      saveState();
      var input = $('#vrKeyword');
      if (input) input.value = query;
      _doSearch();
    });
  });
}

function _bindSaveEvents() {
  var btn      = $('#vrSaveBtn');
  var input    = $('#vrSaveInput');
  var status   = $('#vrSaveStatus');
  var csvInput = $('#vrSaveCsvFile');

  if (btn && input) {
    btn.addEventListener('click', async function() {
      var text = (input.value || '').trim();
      if (!text) { toast('Hãy dán link vào ô bên trên', 'info'); return; }
      if (_isSaving) return;
      _isSaving = true;
      btn.disabled    = true;
      btn.textContent = '⏳ Đang lưu...';
      if (status) status.textContent = '';

      try {
        var urls = Importer.parseUrlsFromText(text);
        if (urls.length === 0) { toast('Không tìm thấy link hợp lệ (TikTok / Facebook / Douyin)', 'error'); return; }

        var results  = await Importer.importMany(urls);
        var saved    = results.filter(function(r) { return r.ok; }).length;
        var dupes    = results.filter(function(r) { return r.reason === 'duplicate'; }).length;
        var errCount = results.length - saved - dupes;

        var msg = '';
        if (saved  > 0) msg += saved  + ' video đã lưu. ';
        if (dupes  > 0) msg += dupes  + ' đã có trong Library. ';
        if (errCount > 0) msg += errCount + ' link lỗi.';

        if (status) status.textContent = msg.trim();

        if (saved > 0) {
          toast('Đã lưu ' + saved + ' video vào Library ↗', 'success');
          input.value = '';
          /* Refresh search results so new videos appear */
          if (_searchState === 'done') _doSearch();
        } else if (dupes > 0 && saved === 0) {
          toast('Tất cả link đã có trong Library', 'info');
        }
      } catch (e) {
        toast('Lỗi: ' + e.message, 'error');
      } finally {
        _isSaving       = false;
        btn.disabled    = false;
        btn.textContent = 'Lưu vào Library';
      }
    });
  }

  if (csvInput) {
    csvInput.addEventListener('change', async function() {
      var file = csvInput.files[0];
      if (!file) return;
      try {
        var text    = await file.text();
        var urls    = Importer.parseUrlsFromCsv(text);
        if (urls.length === 0) { toast('Không tìm thấy link trong CSV', 'error'); return; }
        var results = await Importer.importMany(urls);
        var saved   = results.filter(function(r) { return r.ok; }).length;
        toast('Đã lưu ' + saved + '/' + urls.length + ' video từ CSV', 'success');
        if (saved > 0 && _searchState === 'done') _doSearch();
      } catch (e) {
        toast('Lỗi CSV: ' + e.message, 'error');
      } finally {
        csvInput.value = '';
      }
    });
  }
}

/* ---- Helper: Library entry → used only for attachCardHandlers compat ---- */
function _libEntryToCard(entry) {
  return {
    id:         entry.id,
    platform:   entry.platform || 'tiktok',
    region:     entry.region   || '',
    title:      entry.title    || '',
    thumbnail:  entry.thumbnail || '',
    creator:    entry.creator  || '',
    postedDate: entry.postedAt ? entry.postedAt.slice(0, 10) : '',
    views:      entry.views    || 0,
    likes:      entry.likes    || 0,
    comments:   entry.comments || 0,
    shares:     entry.shares   || 0,
    viralScore: entry.viralScore != null ? entry.viralScore : 0,
    tags:       entry.topics   || [],
    url:        entry.url      || '#',
    _reference: false
  };
}
