/* ============================================================
   MediaOS — Viral Research: Module Entry
   ============================================================ */

'use strict';

function renderResearch(container) {
  const fs = state.viralResearch;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">🔍 Viral Research Hub</div>
      <div class="page-subtitle">Khám phá video mỹ phẩm đang bùng nổ trên TikTok và Facebook trong 10 ngày gần nhất</div>
    </div>

    ${buildStatsBar()}
    ${buildPlatformLinks(fs)}
    ${buildFilterBar(fs)}

    <div class="section-header">
      <div class="section-title">
        📹 Video đang viral
        <span class="count-badge" id="vrCount">–</span>
      </div>
      <div style="font-size:12px;color:var(--text-3)" id="vrSortLabel"></div>
    </div>

    <div class="vr-grid" id="vrGrid"></div>
  `;

  renderGrid();
  bindFilterEvents();
}

/* ---- Stats Bar ---- */
function buildStatsBar() {
  const total   = VR_DATA.length;
  const tiktok  = VR_DATA.filter(v => v.platform === 'tiktok').length;
  const fb      = VR_DATA.filter(v => v.platform === 'facebook').length;
  const topScore = Math.max(...VR_DATA.map(v => v.viralScore));

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

/* ---- Platform Direct Links ---- */
function buildPlatformLinks(fs) {
  const q = encodeURIComponent('mỹ phẩm viral skincare');
  return `
    <div class="vr-platform-links">
      <span class="vr-pl-label">🔗 Tìm trực tiếp:</span>
      <a class="vr-pl-link tiktok" href="https://www.tiktok.com/search?q=${q}" target="_blank" rel="noopener">
        ♪ TikTok Search
      </a>
      <a class="vr-pl-link facebook" href="https://www.facebook.com/search/videos/?q=${encodeURIComponent('skincare viral mỹ phẩm')}" target="_blank" rel="noopener">
        f Facebook Videos
      </a>
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

  const sortOpts = CONFIG.sortOptions.map(s =>
    `<option value="${s.id}" ${fs.sortBy === s.id ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  return `
    <div class="vr-filters">
      <div class="vr-filter-row">
        <span class="vr-filter-label">NỀN TẢNG</span>
        <div class="chip-group" id="platformChips">${platformChips}</div>
      </div>
      <div class="vr-filter-row">
        <span class="vr-filter-label">KHU VỰC</span>
        <div class="chip-group" id="regionChips">${regionChips}</div>
        <div class="vr-filter-right">
          <span style="font-size:12px;color:var(--text-3)">Sắp xếp:</span>
          <select class="select" id="sortSelect">${sortOpts}</select>
        </div>
      </div>
    </div>`;
}

/* ---- Grid Render ---- */
function renderGrid() {
  const fs      = state.viralResearch;
  const results = applyFilters(VR_DATA, fs);
  const grid    = $('#vrGrid');
  const countEl = $('#vrCount');
  const sortEl  = $('#vrSortLabel');

  if (countEl) countEl.textContent = results.length;
  if (sortEl) {
    const label = CONFIG.sortOptions.find(s => s.id === fs.sortBy);
    sortEl.textContent = label ? `Sắp xếp: ${label.label}` : '';
  }

  if (!results.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Không có video phù hợp</div>
        <div class="empty-desc">Thử thay đổi bộ lọc nền tảng hoặc khu vực.</div>
      </div>`;
    return;
  }

  grid.innerHTML = results.map(v => renderVideoCard(v)).join('');
  attachCardHandlers(grid);
}

/* ---- Events ---- */
function bindFilterEvents() {
  /* Platform chips */
  $$('#platformChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.viralResearch.platform = chip.dataset.platform;
      $$('#platformChips .chip').forEach(c => c.classList.toggle('active', c.dataset.platform === chip.dataset.platform));
      renderGrid();
    });
  });

  /* Region chips */
  $$('#regionChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.viralResearch.region = chip.dataset.region;
      $$('#regionChips .chip').forEach(c => c.classList.toggle('active', c.dataset.region === chip.dataset.region));
      renderGrid();
    });
  });

  /* Sort select */
  const sortSel = $('#sortSelect');
  if (sortSel) {
    sortSel.addEventListener('change', () => {
      state.viralResearch.sortBy = sortSel.value;
      renderGrid();
    });
  }
}
