/* ============================================================
   MediaOS — Viral Research: Video Card Component
   ============================================================ */

'use strict';

var PLATFORM_ICON = { tiktok: '♪', youtube: '▶', facebook: 'f', douyin: '抖' };
var MARKET_FLAG   = { vn: '🇻🇳', kr: '🇰🇷', cn: '🇨🇳', tw: '🇹🇼' };

function renderVideoCard(video) {
  var scoreInfo = getScoreLabel(video.viralScore);
  var isHot     = video.viralScore >= 85;
  var flag      = MARKET_FLAG[video.market] || '';
  var platform  = video.platform === 'tiktok'   ? 'TikTok'
                : video.platform === 'youtube'  ? 'YouTube'
                : video.platform === 'douyin'   ? 'Douyin'
                : video.platform === 'facebook' ? 'Facebook'
                : (video.platform || '');
  var ago       = video.postedAt ? timeAgo(video.postedAt) : '';

  var thumbnail = video.thumbnail
    ? '<img src="' + esc(video.thumbnail) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
    : '<div class="vr-thumb-placeholder">' + (PLATFORM_ICON[video.platform] || '▶') + '</div>';

  var statsHtml = '';
  if (video.views    != null) statsHtml += '<span class="vr-stat-item">👁 ' + formatNumber(video.views)    + '</span>';
  if (video.likes    != null) statsHtml += '<span class="vr-stat-item">❤ '  + formatNumber(video.likes)    + '</span>';
  if (video.comments != null) statsHtml += '<span class="vr-stat-item">💬 ' + formatNumber(video.comments) + '</span>';
  if (video.shares   != null) statsHtml += '<span class="vr-stat-item">↗ '  + formatNumber(video.shares)   + '</span>';
  if (!video.statsAvailable)  statsHtml  = '<span class="vr-stat-na">Stats chưa có</span>';

  return '<div class="vr-card" data-id="' + esc(String(video.id)) + '">' +

    '<div class="vr-thumb">' +
      thumbnail +
      '<div class="vr-platform ' + esc(video.platform) + '">' +
        '<span>' + (PLATFORM_ICON[video.platform] || '') + '</span>' +
        '<span>' + esc(platform) + '</span>' +
      '</div>' +
      '<div class="vr-score-badge' + (isHot ? ' hot' : '') + '">' +
        (video.viralScore != null ? video.viralScore + '/100' : '—') +
      '</div>' +
    '</div>' +

    '<div class="vr-body">' +
      '<a class="vr-title" href="' + esc(video.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
        esc(video.caption || '(Chưa có tiêu đề)') +
      '</a>' +

      '<div class="vr-meta">' +
        (flag ? '<span class="vr-flag">' + flag + '</span>' : '') +
        '<span class="vr-creator" title="' + esc(video.creator || '') + '">' + esc(video.creator || '') + '</span>' +
        (ago ? '<span class="vr-meta-date">' + ago + '</span>' : '') +
      '</div>' +

      '<div class="vr-stats">' + statsHtml + '</div>' +

      '<div class="vr-badges">' +
        (video.viralScore != null ? '<span class="badge ' + esc(scoreInfo.cls) + '">' + esc(scoreInfo.label) + '</span>' : '') +
        (video.whyViral ? '<span class="badge badge-info vr-why">' + esc(video.whyViral) + '</span>' : '') +
        '<span class="badge badge-gray vr-src">' + esc(platform) + '</span>' +
      '</div>' +
    '</div>' +

    '<div class="vr-actions">' +
      '<a class="vr-btn-watch" href="' + esc(video.url || '#') + '" target="_blank" rel="noopener noreferrer">Mở video</a>' +
    '</div>' +

  '</div>';
}
