/* ============================================================
   MediaOS — Viral Research: Video Card Component
   ============================================================ */

'use strict';

const PLATFORM_ICON = {
  tiktok:   '♪',
  facebook: 'f',
  douyin:   '抖'
};

const REGION_FLAG = {
  vn: '🇻🇳', kr: '🇰🇷', cn: '🇨🇳', tw: '🇹🇼'
};

function renderVideoCard(video) {
  const scoreInfo     = getScoreLabel(video.viralScore);
  const isHot         = video.viralScore >= 90;
  const isSaved       = state.viralResearch.saved.some(s => s.id === video.id);
  const whyReason     = generateViralReason(video);
  const flag          = REGION_FLAG[video.region] || '';
  const platformLabel = video.platform === 'tiktok' ? 'TikTok'
    : video.platform === 'douyin' ? 'Douyin'
    : 'Facebook';
  const ago           = timeAgo(video.postedDate);

  return `
    <div class="vr-card" data-id="${video.id}">
      <div class="vr-thumb">
        <img src="${esc(video.thumbnail)}" alt="${esc(video.title)}" loading="lazy">
        <div class="vr-platform ${video.platform}">
          <span>${PLATFORM_ICON[video.platform]}</span>
          <span>${platformLabel}</span>
        </div>
        <div class="vr-score-badge ${isHot ? 'hot' : ''}">
          ${video.viralScore}/100
        </div>
        ${isHot ? '<div class="vr-trending-badge">🔥 Hot</div>' : ''}
      </div>

      <div class="vr-body">
        <div class="vr-meta">
          <span class="vr-region">${flag}</span>
          <span>${esc(video.creator)}</span>
          <span class="vr-date">${ago}</span>
        </div>

        <a class="vr-title vr-title-link" href="${esc(video.url)}" target="_blank" rel="noopener noreferrer">
          ${esc(video.title)}
        </a>

        <div class="vr-stats">
          <span class="vr-stat">👁️ ${formatNumber(video.views)}</span>
          <span class="vr-stat">❤️ ${formatNumber(video.likes)}</span>
          <span class="vr-stat">💬 ${formatNumber(video.comments)}</span>
          <span class="vr-stat">🔗 ${formatNumber(video.shares)}</span>
          ${video.viewsGrowth7d != null
            ? `<span class="vr-growth">📈 +${video.viewsGrowth7d}% / 7 ngày</span>`
            : ''}
        </div>

        <span class="badge ${scoreInfo.cls}" style="align-self:flex-start">${scoreInfo.label}</span>

        <div class="vr-why">
          <button class="vr-why-toggle" data-id="${video.id}">
            🧠 Tại sao video này viral?
            <span class="arrow">▼</span>
          </button>
          <div class="vr-why-body" id="why-${video.id}">
            <p>${whyReason}</p>
            <div class="vr-why-tags">
              ${video.tags.map(t => `<span class="vr-tag">#${esc(t)}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="vr-actions">
        <a class="vr-btn-watch" href="${esc(video.url)}" target="_blank" rel="noopener noreferrer">
          🎬 Xem video
        </a>
        <button class="vr-btn-save ${isSaved ? 'saved' : ''}" data-id="${video.id}">
          ${isSaved ? '⭐ Đã lưu' : '☆ Lưu'}
        </button>
      </div>
    </div>`;
}

function attachCardHandlers(container) {
  /* Why viral toggle */
  $$('.vr-why-toggle', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.id;
      const body = $(`#why-${id}`);
      const open = body.classList.toggle('open');
      btn.classList.toggle('open', open);
    });
  });

  /* Save toggle */
  $$('.vr-btn-save', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = parseInt(btn.dataset.id);
      const video = VR_DATA.find(v => v.id === id);
      if (!video) return;

      const idx = state.viralResearch.saved.findIndex(v => v.id === id);
      if (idx === -1) {
        state.viralResearch.saved.push(video);
        btn.textContent = '⭐ Đã lưu';
        btn.classList.add('saved');
        toast('Đã lưu video vào danh sách', 'success');
      } else {
        state.viralResearch.saved.splice(idx, 1);
        btn.textContent = '☆ Lưu';
        btn.classList.remove('saved');
        toast('Đã bỏ lưu video', 'info');
      }
      saveState();
    });
  });
}
