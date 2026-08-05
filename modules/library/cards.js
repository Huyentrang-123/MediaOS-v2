/* ============================================================
   MediaOS — Library Card Component
   ============================================================ */

'use strict';

var LIB_PLATFORM_ICON = { tiktok: '♪', douyin: '抖', facebook: 'f' };
var LIB_REGION_FLAG   = { vn: '🇻🇳', kr: '🇰🇷', cn: '🇨🇳', tw: '🇹🇼', global: '🌏' };

var CONTENT_TAG_LABELS = {
  hook: 'Hook', cta: 'CTA', beforeAfter: 'Before/After', socialProof: 'Social Proof',
  promotion: 'Promo', expert: 'Expert', factory: 'Factory', livestream: 'Live',
  urgency: 'Urgency', review: 'Review', feedback: 'Feedback'
};

function renderLibraryCard(video) {
  var scoreInfo = video.viralScore != null ? _scoreLabel(video.viralScore) : null;
  var flag      = LIB_REGION_FLAG[video.region] || '';
  var icon      = LIB_PLATFORM_ICON[video.platform] || '▶';
  var platformLabel = video.platform === 'tiktok'   ? 'TikTok'
                    : video.platform === 'douyin'   ? 'Douyin'
                    : video.platform === 'facebook' ? 'Facebook'
                    : video.platform || '';
  var ago = video.addedAt ? timeAgo(video.addedAt.slice(0, 10)) : '';

  var allTags = (video.contentTags || []).concat(video.topics || []);

  var statsBadges = '';
  if (video.views != null) {
    statsBadges += '<span class="lib-stat">👁 ' + formatNumber(video.views) + '</span>';
  }
  if (video.likes != null) {
    statsBadges += '<span class="lib-stat">❤️ ' + formatNumber(video.likes) + '</span>';
  }
  if (video.comments != null) {
    statsBadges += '<span class="lib-stat">💬 ' + formatNumber(video.comments) + '</span>';
  }
  if (video.shares != null) {
    statsBadges += '<span class="lib-stat">🔗 ' + formatNumber(video.shares) + '</span>';
  }

  return '<div class="lib-card' + (video.seen ? ' lib-card-seen' : '') + '" data-id="' + esc(video.id) + '">' +
    '<div class="lib-thumb">' +
      (video.thumbnail
        ? '<img src="' + esc(video.thumbnail) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<div class="lib-thumb-placeholder">' + icon + '</div>') +
      '<div class="lib-platform-badge ' + esc(video.platform) + '">' + icon + ' ' + esc(platformLabel) + '</div>' +
      (video.bookmarked ? '<div class="lib-bookmark-flag">⭐</div>' : '') +
    '</div>' +

    '<div class="lib-body">' +
      '<div class="lib-meta">' +
        '<span>' + flag + '</span>' +
        '<span>' + esc(video.creator || '') + '</span>' +
        '<span class="lib-meta-date">' + ago + '</span>' +
      '</div>' +

      '<a class="lib-title" href="' + esc(video.url || '#') + '" target="_blank" rel="noopener noreferrer">' +
        esc(video.title || '(Chưa có tiêu đề)') +
      '</a>' +

      (statsBadges ? '<div class="lib-stats">' + statsBadges + '</div>' : '') +

      (scoreInfo
        ? '<span class="badge ' + scoreInfo.cls + '" style="font-size:11px">' + scoreInfo.label + ' ' + video.viralScore + '/100</span>'
        : '') +
      (video._source === 'manual'
        ? '<span class="badge badge-gray" style="font-size:11px">Nhập thủ công</span>'
        : '') +

      (allTags.length
        ? '<div class="lib-tags">' + allTags.slice(0, 5).map(function(t) {
            var label = CONTENT_TAG_LABELS[t] || t;
            return '<span class="lib-tag">' + esc(label) + '</span>';
          }).join('') + '</div>'
        : '') +

      (video.notes
        ? '<div class="lib-notes">' + esc(video.notes.slice(0, 100)) + (video.notes.length > 100 ? '…' : '') + '</div>'
        : '') +
    '</div>' +

    '<div class="lib-actions">' +
      '<a class="lib-btn-watch" href="' + esc(video.url || '#') + '" target="_blank" rel="noopener noreferrer">🎬 Xem</a>' +
      '<button class="lib-btn lib-btn-edit" data-id="' + esc(video.id) + '" title="Chỉnh sửa">✏️</button>' +
      '<button class="lib-btn lib-btn-seen' + (video.seen ? ' active' : '') + '" data-id="' + esc(video.id) + '" title="' + (video.seen ? 'Đánh dấu chưa xem' : 'Đánh dấu đã xem') + '">' + (video.seen ? '✅' : '👁') + '</button>' +
      '<button class="lib-btn lib-btn-bookmark' + (video.bookmarked ? ' active' : '') + '" data-id="' + esc(video.id) + '" title="Bookmark">⭐</button>' +
      '<button class="lib-btn lib-btn-delete" data-id="' + esc(video.id) + '" title="Xóa">🗑</button>' +
    '</div>' +
  '</div>';
}

function _scoreLabel(score) {
  if (score >= 85) return { label: 'Viral', cls: 'badge-error' };
  if (score >= 60) return { label: 'Trend', cls: 'badge-warning' };
  if (score >= 35) return { label: 'OK',    cls: 'badge-info' };
  return                 { label: '–',     cls: 'badge-gray' };
}

function attachLibraryHandlers(container, onRefresh) {
  $$('.lib-btn-seen', container).forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = btn.dataset.id;
      var v  = await LibraryStorage.getById(id);
      if (!v) return;
      await LibraryStorage.update(id, { seen: !v.seen });
      if (onRefresh) onRefresh();
    });
  });

  $$('.lib-btn-bookmark', container).forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = btn.dataset.id;
      var v  = await LibraryStorage.getById(id);
      if (!v) return;
      await LibraryStorage.update(id, { bookmarked: !v.bookmarked });
      if (onRefresh) onRefresh();
    });
  });

  $$('.lib-btn-edit', container).forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = btn.dataset.id;
      var v  = await LibraryStorage.getById(id);
      if (!v) return;
      LibraryForm.openEditForm(v, onRefresh);
    });
  });

  $$('.lib-btn-delete', container).forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var id = btn.dataset.id;
      if (!confirm('Xóa video này khỏi Library?')) return;
      await LibraryStorage.delete(id);
      toast('Đã xóa', 'info');
      if (onRefresh) onRefresh();
    });
  });
}

var LibraryCards = { renderLibraryCard: renderLibraryCard, attachLibraryHandlers: attachLibraryHandlers };
