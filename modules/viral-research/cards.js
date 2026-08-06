/* MediaOS — Viral Research: Video Card Component */
'use strict';

var PLATFORM_ICON = { tiktok: '♪', facebook: 'f', douyin: '抖' };
var MARKET_FLAG   = { vn: '🇻🇳', kr: '🇰🇷', cn: '🇨🇳', tw: '🇹🇼' };

function _statItem(icon, val, title) {
  return '<span class="vr-stat-item" title="' + title + '">' +
    '<span class="vr-stat-icon">' + icon + '</span>' +
    '<span class="vr-stat-num">' + (val != null ? formatNumber(val) : '—') + '</span>' +
  '</span>';
}

function renderVideoCard(video) {
  var scoreInfo = getScoreLabel(video.viralScore);
  var flag      = MARKET_FLAG[video.market] || '';
  var platform  = video.platform === 'tiktok'   ? 'TikTok'
                : video.platform === 'facebook' ? 'Facebook'
                : video.platform === 'douyin'   ? 'Douyin'
                : (video.platform || '');
  var ago = video.postedAt ? timeAgo(video.postedAt) : '';

  /* Thumbnail */
  var thumbnail = video.thumbnail
    ? '<img src="' + esc(video.thumbnail) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
    : '<div class="vr-thumb-placeholder">' + (PLATFORM_ICON[video.platform] || '▶') + '</div>';

  /* Platform badge — top-left overlay */
  var platformBadge =
    '<div class="vr-platform-badge ' + esc(video.platform || '') + '">' +
      '<span>' + (PLATFORM_ICON[video.platform] || '') + '</span>' +
      '<span>' + esc(platform) + '</span>' +
    '</div>';

  /* Viral score badge — top-right overlay */
  var scoreBadge = video.viralScore != null
    ? '<div class="vr-score-badge' + (video.viralScore >= 85 ? ' hot' : '') + '">' + video.viralScore + '/100</div>'
    : '';

  /* Thumbnail badges — bottom overlay (batch percentile + viral + no-stats) */
  var tbadges = '';
  if (video._badgeViewTop)       tbadges += '<span class="vr-tbadge vr-tbadge-view">View cao (top 20%)</span>';
  if (video._badgeCmtTop)        tbadges += '<span class="vr-tbadge vr-tbadge-cmt">Nhiều bình luận (top 20%)</span>';
  if (video.viralScore != null && video.viralScore >= 75) tbadges += '<span class="vr-tbadge vr-tbadge-viral">Đang viral</span>';
  if (!video.statsAvailable)     tbadges += '<span class="vr-tbadge vr-tbadge-nostats">Thiếu chỉ số</span>';
  var thumbBadgeRow = tbadges ? '<div class="vr-thumb-badges">' + tbadges + '</div>' : '';

  /* Stats row */
  var statsHtml =
    _statItem('👁', video.views,    'Lượt xem')  +
    _statItem('❤',  video.likes,    'Lượt thích') +
    _statItem('💬', video.comments, 'Bình luận')  +
    _statItem('↗',  video.shares,   'Chia sẻ');

  /* Viral score label + why */
  var viralRow = '';
  if (video.viralScore != null) {
    viralRow = '<div class="vr-viral-row">' +
      '<span class="badge ' + esc(scoreInfo.cls) + '">' + esc(scoreInfo.label) + '</span>' +
      (video.whyViral ? '<span class="vr-why-viral">' + esc(video.whyViral) + '</span>' : '') +
    '</div>';
  }

  return '<div class="vr-card" data-id="' + esc(String(video.id)) + '">' +

    /* Thumbnail area */
    '<div class="vr-thumb">' +
      thumbnail +
      platformBadge +
      scoreBadge +
      thumbBadgeRow +
    '</div>' +

    /* Body */
    '<div class="vr-body">' +
      '<div class="vr-caption">' + esc(video.caption || '(Chưa có tiêu đề)') + '</div>' +
      '<div class="vr-meta">' +
        (flag ? '<span class="vr-flag">' + flag + '</span>' : '') +
        '<span class="vr-creator">' + esc(video.creator || '') + '</span>' +
        (ago ? '<span class="vr-date">' + ago + '</span>' : '') +
      '</div>' +
      '<div class="vr-stats">' + statsHtml + '</div>' +
      viralRow +
    '</div>' +

    /* Footer */
    '<div class="vr-card-footer">' +
      '<a class="vr-btn-watch" href="' + esc(video.url || '#') + '" target="_blank" rel="noopener noreferrer">Mở video ↗</a>' +
    '</div>' +

  '</div>';
}
