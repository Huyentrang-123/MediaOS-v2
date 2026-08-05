/* ============================================================
   MediaOS — Research Sources: Free Research Links
   No scraping. No API calls. Just curated links.
   ============================================================ */

'use strict';

var SOURCES = [
  {
    category: 'TikTok',
    icon: '♪',
    items: [
      {
        title: 'TikTok Search',
        desc:  'Tìm kiếm video công khai theo từ khóa, hashtag, tài khoản.',
        url:   'https://www.tiktok.com/search',
        tag:   'free'
      },
      {
        title: 'TikTok Creative Center — Trending',
        desc:  'Video trending, hashtag trending, nhạc trending theo quốc gia.',
        url:   'https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en',
        tag:   'free'
      },
      {
        title: 'TikTok Creative Center — Top Ads',
        desc:  'Quảng cáo TikTok hiệu quả nhất theo ngành hàng.',
        url:   'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
        tag:   'free'
      },
      {
        title: 'TikTok Hashtag Explore',
        desc:  'Khám phá hashtag đang viral và video sử dụng hashtag đó.',
        url:   'https://www.tiktok.com/tag/',
        tag:   'free',
        note:  'Thêm tên hashtag vào cuối URL, ví dụ: /tag/serumviral'
      }
    ]
  },
  {
    category: 'Douyin (抖音)',
    icon: '抖',
    items: [
      {
        title: 'Douyin Search',
        desc:  'Tìm kiếm video Douyin — thị trường Trung Quốc.',
        url:   'https://www.douyin.com/search/',
        tag:   'free',
        note:  'Cần VPN Trung Quốc hoặc trình duyệt có hỗ trợ Douyin'
      },
      {
        title: 'Douyin Hot List (热榜)',
        desc:  'Danh sách video và hashtag trending tại Trung Quốc.',
        url:   'https://www.douyin.com/hot',
        tag:   'free'
      }
    ]
  },
  {
    category: 'Facebook / Instagram',
    icon: 'f',
    items: [
      {
        title: 'Facebook Search — Reels',
        desc:  'Tìm Reels công khai theo từ khóa.',
        url:   'https://www.facebook.com/search/reels/?q=',
        tag:   'free',
        note:  'Thêm từ khóa vào cuối URL, ví dụ: ?q=serum+vitamin+c'
      },
      {
        title: 'Facebook Ad Library',
        desc:  'Tìm quảng cáo đang chạy của bất kỳ thương hiệu nào.',
        url:   'https://www.facebook.com/ads/library/',
        tag:   'free'
      },
      {
        title: 'Meta Creative Hub',
        desc:  'Xem ví dụ quảng cáo hiệu quả theo định dạng và ngành hàng.',
        url:   'https://www.facebook.com/business/inspiration/',
        tag:   'free'
      }
    ]
  },
  {
    category: 'Công cụ phân tích',
    icon: '📊',
    items: [
      {
        title: 'Tikok (tiktok.com/analytics)',
        desc:  'Analytics tài khoản TikTok của bạn — xem video nào có reach cao nhất.',
        url:   'https://www.tiktok.com/creator-center/analytics',
        tag:   'free'
      },
      {
        title: 'Kalodata (Khám phá miễn phí)',
        desc:  'Phân tích sản phẩm và creator TikTok. Có bản miễn phí giới hạn.',
        url:   'https://www.kalodata.com/',
        tag:   'limited'
      },
      {
        title: 'Pentos — TikTok Analytics',
        desc:  'Theo dõi hashtag, so sánh creator. Bản trial miễn phí 14 ngày.',
        url:   'https://pentos.co/',
        tag:   'trial'
      },
      {
        title: 'Exolyt — TikTok Analytics',
        desc:  'Phân tích tài khoản TikTok, trending sounds, hashtag growth.',
        url:   'https://exolyt.com/',
        tag:   'limited'
      }
    ]
  },
  {
    category: 'Nguồn cảm hứng',
    icon: '💡',
    items: [
      {
        title: 'Pinterest Trends',
        desc:  'Xu hướng hình ảnh và concept theo mùa, ngành hàng, khu vực.',
        url:   'https://trends.pinterest.com/',
        tag:   'free'
      },
      {
        title: 'Google Trends',
        desc:  'Xu hướng tìm kiếm theo từ khóa, so sánh thị trường.',
        url:   'https://trends.google.com/trends/',
        tag:   'free'
      },
      {
        title: 'YouTube Trending',
        desc:  'Video trending theo quốc gia — cảm hứng format content.',
        url:   'https://www.youtube.com/feed/trending',
        tag:   'free'
      }
    ]
  }
];

var TAG_LABELS = {
  free:    { label: 'Miễn phí',  cls: 'badge-success' },
  limited: { label: 'Giới hạn', cls: 'badge-warning' },
  trial:   { label: 'Dùng thử', cls: 'badge-info'    }
};

function renderSources(container) {
  var html = '<div class="page-header">' +
    '<div class="page-title">🔗 Nguồn Nghiên Cứu Miễn Phí</div>' +
    '<div class="page-subtitle">Các nguồn tham khảo được chọn lọc — không tốn credit TikHub. Sao chép link video vào Research Library để lưu lại.</div>' +
  '</div>';

  html += '<div class="src-grid">';

  SOURCES.forEach(function(cat) {
    html += '<div class="src-category">' +
      '<div class="src-cat-header">' +
        '<span class="src-cat-icon">' + cat.icon + '</span>' +
        '<span class="src-cat-title">' + esc(cat.category) + '</span>' +
      '</div>' +
      '<div class="src-items">';

    cat.items.forEach(function(item) {
      var tagInfo = TAG_LABELS[item.tag] || TAG_LABELS.free;
      html += '<a class="src-item" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="src-item-top">' +
          '<div class="src-item-title">' + esc(item.title) + '</div>' +
          '<span class="badge ' + tagInfo.cls + '" style="font-size:10px;white-space:nowrap">' + tagInfo.label + '</span>' +
        '</div>' +
        '<div class="src-item-desc">' + esc(item.desc) + '</div>' +
        (item.note ? '<div class="src-item-note">💡 ' + esc(item.note) + '</div>' : '') +
      '</a>';
    });

    html += '</div></div>';
  });

  html += '</div>';

  /* Bookmarklet banner */
  html += '<div class="src-bookmarklet-banner">' +
    '<div class="src-bm-title">📌 Lưu link nhanh bằng Bookmarklet</div>' +
    '<div class="src-bm-desc">Kéo nút bên dưới vào thanh bookmarks trình duyệt. Khi xem một video TikTok/Facebook, nhấn bookmark đó — link sẽ tự động được thêm vào Research Library.</div>' +
    '<div style="margin-top:12px">' +
      '<a class="btn btn-secondary" id="srcBookmarkletLink" href="' + _bookmarkletHref() + '" ' +
        'onclick="alert(\'Kéo nút này vào thanh Favorites/Bookmarks của trình duyệt!\');return false;">' +
        '⭐ Lưu vào Library' +
      '</a>' +
      '<span style="font-size:12px;color:var(--text-3);margin-left:12px">← Kéo nút này vào thanh bookmarks</span>' +
    '</div>' +
  '</div>';

  container.innerHTML = html;
}

function _bookmarkletHref() {
  var code = '(function(){' +
    'var u=location.href;' +
    'var ok=/(tiktok\\.com|douyin\\.com|facebook\\.com|fb\\.watch|vm\\.tiktok\\.com|vt\\.tiktok\\.com)/.test(u);' +
    'if(!ok){alert("Chỉ hỗ trợ TikTok, Douyin, Facebook.");return;}' +
    'localStorage.setItem("mediaos_pending_import",u);' +
    'var t=window.open("' + location.origin + '#library","mediaos_library");' +
    'if(!t){alert("Đã lưu: "+u);}' +
  '})();';
  return 'javascript:' + encodeURIComponent(code);
}
