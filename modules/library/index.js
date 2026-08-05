/* ============================================================
   MediaOS — Research Library Page
   Zero API cost. All data from IndexedDB.
   ============================================================ */

'use strict';

/* ---- Active filter state (session-only) ---- */
var _libFilter = {
  search:   '',
  platform: 'all',
  region:   'all',
  seen:     'all',      /* 'all' | 'seen' | 'unseen' */
  bookmark: false
};

function renderLibrary(container) {
  container.innerHTML =
    '<div class="page-header">' +
      '<div class="page-title">📚 Research Library</div>' +
      '<div class="page-subtitle">Thư viện video nghiên cứu — import link miễn phí, không dùng TikHub credit.</div>' +
    '</div>' +
    '<div id="libStatsBar"></div>' +
    '<div id="libImportSection">' + _buildImportSection() + '</div>' +
    '<div id="libToolbar">' + _buildToolbar() + '</div>' +
    '<div class="lib-grid" id="libGrid"><div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📂</div><div class="empty-title">Đang tải thư viện...</div></div></div>';

  _bindImportEvents();
  _bindToolbarEvents();
  _checkPendingImport();
  _renderAll();
}

/* ---- Stats bar ---- */
async function _updateStatsBar() {
  var all = await LibraryStorage.getAll();
  var bar = $('#libStatsBar');
  if (!bar) return;
  var total     = all.length;
  var tiktok    = all.filter(function(v){ return v.platform === 'tiktok' || v.platform === 'douyin'; }).length;
  var fb        = all.filter(function(v){ return v.platform === 'facebook'; }).length;
  var bookmarked = all.filter(function(v){ return v.bookmarked; }).length;
  var unseen    = all.filter(function(v){ return !v.seen; }).length;
  bar.innerHTML =
    '<div class="vr-stats-bar">' +
      _statCard('📊', total,     'Video trong Library') +
      _statCard('♪',  tiktok,   'TikTok / Douyin') +
      _statCard('f',  fb,        'Facebook') +
      _statCard('⭐', bookmarked,'Đã bookmark') +
      _statCard('👁', unseen,   'Chưa xem') +
    '</div>';
}

function _statCard(icon, val, label) {
  return '<div class="vr-stat-card"><div class="vr-stat-icon">' + icon + '</div><div>' +
    '<div class="vr-stat-value">' + val + '</div>' +
    '<div class="vr-stat-label">' + label + '</div>' +
    '</div></div>';
}

/* ---- Import section ---- */
function _buildImportSection() {
  var bookmarkletCode = 'javascript:(function(){' +
    'var u=window.location.href;' +
    'try{localStorage.setItem(\'mediaos_pending_import\',u);}catch(e){}' +
    'var t=window.open(window.location.origin+\'/#library\',\'mediaos_tab\');' +
    'if(!t){alert(\'Đã lưu URL. Mở MediaOS và vào Library để import.\');}' +
    '})();';

  return '<div class="lib-import-section">' +
    '<details id="libImportDetails">' +
      '<summary class="lib-import-toggle">📥 Nhập video vào Library <span class="lib-import-badge">Miễn phí</span></summary>' +
      '<div class="lib-import-body">' +

        '<div class="lib-import-row">' +
          '<label><strong>Dán link (mỗi dòng một link, hoặc phân cách bằng dấu phẩy)</strong></label>' +
          '<div class="lib-paste-area">' +
            '<textarea id="libUrlInput" class="lib-url-textarea" rows="4" ' +
              'placeholder="https://www.tiktok.com/@user/video/123&#10;https://www.facebook.com/reel/456&#10;https://www.douyin.com/video/789"></textarea>' +
            '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
              '<button class="btn btn-primary" id="libImportBtn">📥 Import link</button>' +
              '<button class="btn btn-ghost btn-sm" id="libPasteBtn">📋 Dán từ clipboard</button>' +
              '<label class="btn btn-ghost btn-sm" style="cursor:pointer">📂 Import CSV <input type="file" id="libCsvInput" accept=".csv,.txt" style="display:none"></label>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="lib-import-row">' +
          '<label><strong>Thị trường mặc định cho lần import này</strong></label>' +
          '<select id="libImportRegion" class="lib-form-select" style="width:auto">' +
            '<option value="global">🌏 Toàn cầu</option>' +
            '<option value="vn">🇻🇳 Việt Nam</option>' +
            '<option value="kr">🇰🇷 Hàn Quốc</option>' +
            '<option value="cn">🇨🇳 Trung Quốc</option>' +
            '<option value="tw">🇹🇼 Đài Loan</option>' +
          '</select>' +
        '</div>' +

        '<div id="libImportResult" style="display:none"></div>' +

        '<details class="lib-bookmarklet-section">' +
          '<summary>🔖 Bookmarklet — lưu nhanh khi đang xem video</summary>' +
          '<div class="lib-bookmarklet-body">' +
            '<p>Kéo nút bên dưới vào thanh bookmark của trình duyệt. Khi đang mở video TikTok/Facebook, click bookmark để lưu về MediaOS.</p>' +
            '<a class="btn btn-outline lib-bookmarklet-btn" href="' + esc(bookmarkletCode) + '" id="libBookmarkletLink">⭐ Lưu vào MediaOS</a>' +
            '<p class="lib-hint">Hoặc thêm thủ công: tạo bookmark, đặt URL = đoạn code JavaScript ở trên.</p>' +
          '</div>' +
        '</details>' +

        '<div style="text-align:right;margin-top:8px">' +
          '<button class="btn btn-ghost btn-sm" id="libAddManualBtn">✏️ Thêm thủ công (không có link)</button>' +
        '</div>' +

      '</div>' +  /* lib-import-body */
    '</details>' +
  '</div>';
}

/* ---- Toolbar (filter + actions) ---- */
function _buildToolbar() {
  var platformChips = ['all','tiktok','facebook'].map(function(p) {
    var label = p === 'all' ? 'Tất cả' : p === 'tiktok' ? '♪ TikTok/Douyin' : 'f Facebook';
    return '<button class="chip' + (p === _libFilter.platform ? ' active' : '') + '" data-platform="' + p + '">' + label + '</button>';
  }).join('');

  var regionChips = ['all','vn','kr','cn','tw'].map(function(r) {
    var label = r === 'all' ? '🌏 Tất cả' : CONFIG.regions.find(function(x){ return x.id === r; })?.label || r;
    return '<button class="chip' + (r === _libFilter.region ? ' active' : '') + '" data-region="' + r + '">' + label + '</button>';
  }).join('');

  return '<div class="lib-toolbar">' +
    '<div class="lib-toolbar-row">' +
      '<input class="lib-search-input" id="libSearch" type="search" placeholder="🔍 Tìm trong Library..." value="' + esc(_libFilter.search) + '">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" id="libExportJsonBtn">⬇ Export JSON</button>' +
        '<label class="btn btn-ghost btn-sm" style="cursor:pointer">⬆ Restore JSON <input type="file" id="libRestoreInput" accept=".json" style="display:none"></label>' +
        '<button class="btn btn-ghost btn-sm" id="libExportCsvBtn">📊 Export CSV</button>' +
      '</div>' +
    '</div>' +
    '<div class="lib-toolbar-row">' +
      '<span class="vr-filter-label">NỀN TẢNG</span>' +
      '<div class="chip-group" id="libPlatformChips">' + platformChips + '</div>' +
    '</div>' +
    '<div class="lib-toolbar-row">' +
      '<span class="vr-filter-label">KHU VỰC</span>' +
      '<div class="chip-group" id="libRegionChips">' + regionChips + '</div>' +
    '</div>' +
    '<div class="lib-toolbar-row">' +
      '<span class="vr-filter-label">LỌC</span>' +
      '<div class="chip-group">' +
        '<button class="chip' + (_libFilter.seen === 'all'    ? ' active' : '') + '" data-seen="all">Tất cả</button>' +
        '<button class="chip' + (_libFilter.seen === 'unseen' ? ' active' : '') + '" data-seen="unseen">Chưa xem</button>' +
        '<button class="chip' + (_libFilter.seen === 'seen'   ? ' active' : '') + '" data-seen="seen">Đã xem</button>' +
        '<button class="chip' + (_libFilter.bookmark          ? ' active' : '') + '" id="libBookmarkFilter">⭐ Bookmark</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ---- Render grid ---- */
async function _renderAll() {
  await _updateStatsBar();
  var grid = $('#libGrid');
  if (!grid) return;

  var all = await LibraryStorage.getAll();

  /* Apply filters */
  var filtered = all.filter(function(v) {
    if (_libFilter.platform !== 'all') {
      var include = _libFilter.platform === 'tiktok' ? ['tiktok','douyin'] : [_libFilter.platform];
      if (include.indexOf(v.platform) === -1) return false;
    }
    if (_libFilter.region !== 'all' && v.region !== _libFilter.region) return false;
    if (_libFilter.seen === 'seen'   && !v.seen)    return false;
    if (_libFilter.seen === 'unseen' && v.seen)     return false;
    if (_libFilter.bookmark && !v.bookmarked)       return false;
    if (_libFilter.search) {
      var q = _libFilter.search.toLowerCase();
      var haystack = [v.title, v.creator, v.url, (v.topics||[]).join(' '), v.notes, v.hook].join(' ').toLowerCase();
      if (haystack.indexOf(q) === -1) return false;
    }
    return true;
  });

  /* Sort: newest added first */
  filtered.sort(function(a, b) {
    return (b.addedAt || '').localeCompare(a.addedAt || '');
  });

  var countEl = document.querySelector('#libCount');

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' +
      '<div class="empty-icon">📂</div>' +
      (all.length === 0
        ? '<div class="empty-title">Library trống</div><div class="empty-desc">Dán link TikTok/Facebook ở trên để bắt đầu.</div>'
        : '<div class="empty-title">Không tìm thấy video phù hợp</div><div class="empty-desc">Thử thay đổi bộ lọc.</div>') +
    '</div>';
    return;
  }

  grid.innerHTML = filtered.map(function(v) {
    return LibraryCards.renderLibraryCard(v);
  }).join('');

  LibraryCards.attachLibraryHandlers(grid, function() { _renderAll(); });
}

/* ---- Import events ---- */
function _bindImportEvents() {
  /* Import text URLs */
  var importBtn = $('#libImportBtn');
  if (importBtn) {
    importBtn.addEventListener('click', async function() {
      var textarea = $('#libUrlInput');
      var text     = textarea ? textarea.value : '';
      var urls     = Importer.parseUrlsFromText(text);
      if (!urls.length) { toast('Không tìm thấy URL hợp lệ trong ô nhập.', 'error'); return; }
      await _runImport(urls);
      if (textarea) textarea.value = '';
    });
  }

  /* Paste from clipboard */
  var pasteBtn = $('#libPasteBtn');
  if (pasteBtn) {
    pasteBtn.addEventListener('click', async function() {
      try {
        var text     = await navigator.clipboard.readText();
        var textarea = $('#libUrlInput');
        if (textarea) {
          textarea.value += (textarea.value ? '\n' : '') + text;
          toast('Đã dán từ clipboard', 'info');
        }
      } catch (e) {
        toast('Trình duyệt chặn truy cập clipboard. Vui lòng dán thủ công.', 'error');
      }
    });
  }

  /* CSV upload */
  var csvInput = $('#libCsvInput');
  if (csvInput) {
    csvInput.addEventListener('change', function() {
      var file = csvInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = async function(e) {
        var urls = Importer.parseUrlsFromCsv(e.target.result);
        if (!urls.length) { toast('Không tìm thấy URL hợp lệ trong file CSV.', 'error'); return; }
        await _runImport(urls);
        csvInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  /* Add manual */
  var manualBtn = $('#libAddManualBtn');
  if (manualBtn) {
    manualBtn.addEventListener('click', function() {
      LibraryForm.openEditForm(null, function() { _renderAll(); });
    });
  }
}

async function _runImport(urls) {
  var importBtn    = $('#libImportBtn');
  var resultEl     = $('#libImportResult');
  var regionSelect = $('#libImportRegion');
  var region       = regionSelect ? regionSelect.value : 'global';

  if (importBtn) { importBtn.disabled = true; importBtn.textContent = '⏳ Đang import...'; }
  if (resultEl)  { resultEl.style.display = 'none'; }

  try {
    var r = await Importer.importMany(urls, { region: region });
    if (resultEl) {
      var html = '<div class="lib-import-result">' +
        '<span class="badge badge-success">✅ Đã import: ' + r.imported.length + '</span>' +
        (r.skipped.length  ? '<span class="badge badge-gray">⏭ Trùng: '  + r.skipped.length  + '</span>' : '') +
        (r.errors.length   ? '<span class="badge badge-error">❌ Lỗi: '   + r.errors.length   + '</span>' : '') +
      '</div>';
      resultEl.innerHTML      = html;
      resultEl.style.display  = 'block';
    }
    if (r.imported.length) toast('Đã import ' + r.imported.length + ' video', 'success');
    _renderAll();
  } catch (err) {
    toast('Lỗi import: ' + err.message, 'error');
  } finally {
    if (importBtn) { importBtn.disabled = false; importBtn.textContent = '📥 Import link'; }
  }
}

/* ---- Toolbar events ---- */
function _bindToolbarEvents() {
  var searchInput = $('#libSearch');
  if (searchInput) {
    var debounceTimer;
    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        _libFilter.search = searchInput.value;
        _renderAll();
      }, 250);
    });
  }

  $$('#libPlatformChips .chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      _libFilter.platform = chip.dataset.platform;
      $$('#libPlatformChips .chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.platform === _libFilter.platform);
      });
      _renderAll();
    });
  });

  $$('#libRegionChips .chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      _libFilter.region = chip.dataset.region;
      $$('#libRegionChips .chip').forEach(function(c) {
        c.classList.toggle('active', c.dataset.region === _libFilter.region);
      });
      _renderAll();
    });
  });

  $$('[data-seen]').forEach(function(chip) {
    chip.addEventListener('click', function() {
      _libFilter.seen = chip.dataset.seen;
      $$('[data-seen]').forEach(function(c) {
        c.classList.toggle('active', c.dataset.seen === _libFilter.seen);
      });
      _renderAll();
    });
  });

  var bookmarkFilter = $('#libBookmarkFilter');
  if (bookmarkFilter) {
    bookmarkFilter.addEventListener('click', function() {
      _libFilter.bookmark = !_libFilter.bookmark;
      bookmarkFilter.classList.toggle('active', _libFilter.bookmark);
      _renderAll();
    });
  }

  /* Export JSON */
  var exportJsonBtn = $('#libExportJsonBtn');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', async function() {
      var data = await LibraryStorage.exportJSON();
      _downloadFile(
        'mediaos-library-' + new Date().toISOString().slice(0,10) + '.json',
        JSON.stringify(data, null, 2),
        'application/json'
      );
    });
  }

  /* Restore JSON */
  var restoreInput = $('#libRestoreInput');
  if (restoreInput) {
    restoreInput.addEventListener('change', function() {
      var file = restoreInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = async function(e) {
        try {
          var json = JSON.parse(e.target.result);
          var r    = await LibraryStorage.importJSON(json);
          if (r.ok) {
            toast('Đã khôi phục: ' + r.imported + ' video mới, ' + r.skipped + ' đã có.', 'success');
            _renderAll();
          } else {
            toast('File không đúng định dạng. Vui lòng dùng file export từ MediaOS.', 'error');
          }
        } catch (e) {
          toast('Lỗi đọc file JSON: ' + e.message, 'error');
        }
        restoreInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  /* Export CSV */
  var exportCsvBtn = $('#libExportCsvBtn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', async function() {
      var csv = await LibraryStorage.exportCSV();
      _downloadFile(
        'mediaos-library-' + new Date().toISOString().slice(0,10) + '.csv',
        csv,
        'text/csv'
      );
    });
  }
}

/* ---- Check pending import (from bookmarklet) ---- */
function _checkPendingImport() {
  try {
    var pending = localStorage.getItem('mediaos_pending_import');
    if (!pending) return;
    localStorage.removeItem('mediaos_pending_import');

    /* Open import section and pre-fill URL */
    var details  = $('#libImportDetails');
    var textarea = $('#libUrlInput');
    if (details)  details.open = true;
    if (textarea) textarea.value = pending;
    toast('URL đã được dán từ bookmarklet. Chọn thị trường và bấm Import.', 'info');
  } catch (e) {}
}

/* ---- Utilities ---- */
function _downloadFile(filename, content, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}
