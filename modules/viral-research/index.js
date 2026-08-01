/* ============================================================
   MediaOS — Viral Research: Module Entry
   ============================================================ */

'use strict';

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
function renderGrid() {
  const fs      = state.viralResearch;
  const results = applyFilters(VR_DATA, fs);
  const grid    = $('#vrGrid');
  const countEl = $('#vrCount');
  const aiLabel = $('#vrAiLabel');

  if (countEl) countEl.textContent = results.length;
  if (aiLabel) {
    aiLabel.textContent = results.length > 0
      ? `AI đã phân tích ${VR_DATA.length} video — hiển thị ${results.length} video đáng nghiên cứu nhất`
      : '';
  }

  if (results.length === 0) {
    const isEmpty = !fs.keyword && fs.platform === 'all' && fs.region === 'global';
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">${isEmpty ? '🤖' : '🔍'}</div>
        <div class="empty-title">${isEmpty
          ? 'Nhập từ khóa để AI bắt đầu phân tích'
          : 'Không tìm thấy video phù hợp'
        }</div>
        <div class="empty-desc">${isEmpty
          ? 'Gõ từ khóa mỹ phẩm bạn muốn nghiên cứu, chọn nền tảng và khu vực, rồi bấm Phân tích.'
          : 'Thử đổi từ khóa hoặc mở rộng khu vực / nền tảng.'
        }</div>
      </div>`;
    return;
  }

  grid.innerHTML = results.map(v => renderVideoCard(v)).join('');
  attachCardHandlers(grid);
}

/* ---- Events ---- */
function bindFilterEvents() {
  const doSearch = () => {
    const input = $('#vrKeyword');
    if (input) state.viralResearch.keyword = input.value;
    renderGrid();
  };

  /* Search button */
  const searchBtn = $('#vrSearchBtn');
  if (searchBtn) searchBtn.addEventListener('click', doSearch);

  /* Enter key on search input */
  const input = $('#vrKeyword');
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });
  }

  /* Platform chips — trigger immediately */
  $$('#platformChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.viralResearch.platform = chip.dataset.platform;
      $$('#platformChips .chip').forEach(c =>
        c.classList.toggle('active', c.dataset.platform === chip.dataset.platform)
      );
      renderGrid();
    });
  });

  /* Region chips — trigger immediately */
  $$('#regionChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.viralResearch.region = chip.dataset.region;
      $$('#regionChips .chip').forEach(c =>
        c.classList.toggle('active', c.dataset.region === chip.dataset.region)
      );
      renderGrid();
    });
  });
}
