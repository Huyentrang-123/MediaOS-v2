/* ============================================================
   MediaOS — Viral Research: Video Card Component
   Compact, Linear/Notion-style. Save → persists to Library.
   ============================================================ */

'use strict';

var PLATFORM_ICON = { tiktok: '♪', facebook: 'f', douyin: '抖' };
var REGION_FLAG   = { vn: '🇻🇳', kr: '🇰🇷', cn: '🇨🇳', tw: '🇹🇼' };

function renderVideoCard(video) {
  var scoreInfo = getScoreLabel(video.viralScore);
  var isHot     = video.viralScore >= 85;
  var flag      = REGION_FLAG[video.region] || '';
  var platform  = video.platform === 'tiktok' ? 'TikTok'
                : video.platform === 'douyin' ? 'Douyin'
                : 'Facebook';
  var ago       = video.postedDate ? timeAgo(video.postedDate) : '';
  var isSaved   = state.viralResearch.saved.some(function(s) { return String(s.id) === String(video.id); });

  var thumbnail = video.thumbnail
    ? '<img src="' + esc(video.thumbnail) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
    : '<div class="vr-thumb-placeholder">' + (PLATFORM_ICON[video.platform] || '▶') + '</div>';

  return '<div class="vr-card" data-id="' + esc(String(video.id)) + '">' +

    '<div class="vr-thumb">' +
      thumbnail +
      '<div class="vr-platform ' + esc(video.platform) + '">' +
        '<span>' + (PLATFORM_ICON[video.platform] || '') + '</span>' +
        '<span>' + platform + '</span>' +
      '</div>' +
      '<div class="vr-score-badge' + (isHot ? ' hot' : '') + '">' +
        video.viralScore + '/100' +
      '</div>' +
    '</div>' +

    '<div class="vr-body">' +
      '<a class="vr-title" href="' + esc(video.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
        esc(video.title || '(Chưa có tiêu đề)') +
      '</a>' +

      '<div class="vr-meta">' +
        (flag ? '<span class="vr-flag">' + flag + '</span>' : '') +
        '<span class="vr-creator" title="' + esc(video.creator) + '">' + esc(video.creator) + '</span>' +
        '<span class="vr-meta-date">' + ago + '</span>' +
      '</div>' +

      '<div class="vr-stats">' +
        (video.views    != null ? '<span class="vr-stat-item">👁 ' + formatNumber(video.views)    + '</span>' : '') +
        (video.likes    != null ? '<span class="vr-stat-item">❤ ' + formatNumber(video.likes)    + '</span>' : '') +
        (video.comments != null ? '<span class="vr-stat-item">💬 ' + formatNumber(video.comments) + '</span>' : '') +
        (video.shares   != null ? '<span class="vr-stat-item">↗ ' + formatNumber(video.shares)   + '</span>' : '') +
      '</div>' +

      '<div class="vr-badges">' +
        '<span class="badge ' + scoreInfo.cls + '">' + scoreInfo.label + '</span>' +
        (video._reference ? '<span class="badge badge-gray">Tham khảo</span>' : '') +
      '</div>' +
    '</div>' +

    '<div class="vr-actions">' +
      '<a class="vr-btn-watch" href="' + esc(video.url || '#') + '" target="_blank" rel="noopener noreferrer">Xem video</a>' +
      '<button class="vr-btn-save' + (isSaved ? ' saved' : '') + '" data-id="' + esc(String(video.id)) + '">' +
        (isSaved ? '⭐ Đã lưu' : '☆ Lưu') +
      '</button>' +
    '</div>' +

  '</div>';
}

/* videoSource: the _apiResults array from index.js */
function attachCardHandlers(container, videoSource) {
  if (!container) return;

  $$('.vr-btn-save', container).forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id    = btn.dataset.id;
      var video = (videoSource || []).find(function(v) { return String(v.id) === String(id); });
      if (!video) return;

      var alreadySaved = state.viralResearch.saved.some(function(s) { return String(s.id) === String(id); });

      if (alreadySaved) {
        state.viralResearch.saved = state.viralResearch.saved.filter(function(s) { return String(s.id) !== String(id); });
        saveState();
        btn.textContent = '☆ Lưu';
        btn.classList.remove('saved');
        toast('Đã bỏ lưu', 'info');
      } else {
        try {
          var entry  = _videoToLibraryEntry(video);
          var result = await LibraryStorage.add(entry);
          if (result.ok || result.reason === 'duplicate') {
            state.viralResearch.saved.push({ id: String(video.id) });
            saveState();
            btn.textContent = '⭐ Đã lưu';
            btn.classList.add('saved');
            toast(result.reason === 'duplicate' ? 'Đã có trong Library' : 'Đã lưu vào Library ↗', 'success');
          } else {
            toast('Lỗi lưu: ' + (result.reason || 'unknown'), 'error');
          }
        } catch (e) {
          toast('Lỗi: ' + e.message, 'error');
        }
      }
    });
  });
}

function _videoToLibraryEntry(card) {
  return {
    id:            String(card.id),
    platform:      card.platform || 'tiktok',
    videoId:       null,
    url:           card.url || '',
    normalizedUrl: String(card.id),
    title:         card.title  || '',
    creator:       card.creator || '',
    creatorHandle: card.creator || '',
    thumbnail:     card.thumbnail || '',
    region:        card.region || 'global',
    topics:        Array.isArray(card.tags) ? card.tags : [],
    contentTags:   [],
    views:         card.views    != null ? card.views    : null,
    likes:         card.likes    != null ? card.likes    : null,
    comments:      card.comments != null ? card.comments : null,
    shares:        card.shares   != null ? card.shares   : null,
    postedAt:      card.postedDate ? card.postedDate + 'T00:00:00Z' : null,
    notes:         '',
    hook:          '',
    cta:           '',
    addedAt:       new Date().toISOString(),
    addedBy:       '',
    seen:          false,
    bookmarked:    false,
    viralScore:    card.viralScore != null ? card.viralScore : null,
    _source:       'search'
  };
}
