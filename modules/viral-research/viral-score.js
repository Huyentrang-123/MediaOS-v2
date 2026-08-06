/* MediaOS — Viral Research: Client-side Scoring */
'use strict';

var SCORE_WEIGHTS = { shareRate: 0.35, commentRate: 0.30, views: 0.25, viewsPerHour: 0.10 };

function _normalize(val, arr) {
  var min = Math.min.apply(null, arr);
  var max = Math.max.apply(null, arr);
  if (max === min) return 0.5;
  return (val - min) / (max - min);
}

function scoreVideos(videos) {
  if (!videos || !videos.length) return videos || [];

  /* Only score videos that have at least one real stat */
  var scorable  = videos.filter(function(v) { return v.statsAvailable; });
  var noStats   = videos.filter(function(v) { return !v.statsAvailable; });

  var withRates = scorable.map(function(v) {
    var views    = v.views || 0;
    var hoursOld = v.postedAt ? Math.max(1, (Date.now() - new Date(v.postedAt).getTime()) / 3600000) : null;
    var vph      = (hoursOld && views) ? views / hoursOld : 0;
    return Object.assign({}, v, {
      _shareRate:   views > 0 && v.shares   != null ? v.shares   / views : 0,
      _commentRate: views > 0 && v.comments != null ? v.comments / views : 0,
      _views:       views,
      _vph:         v.viewsPerHour || vph
    });
  });

  var scored = withRates.length > 0 ? (function() {
    var shareRates   = withRates.map(function(v) { return v._shareRate; });
    var commentRates = withRates.map(function(v) { return v._commentRate; });
    var viewCounts   = withRates.map(function(v) { return v._views; });
    var vphArr       = withRates.map(function(v) { return v._vph; });

    return withRates.map(function(v) {
      var score =
        SCORE_WEIGHTS.shareRate    * _normalize(v._shareRate,   shareRates)   +
        SCORE_WEIGHTS.commentRate  * _normalize(v._commentRate, commentRates) +
        SCORE_WEIGHTS.views        * _normalize(v._views,       viewCounts)   +
        SCORE_WEIGHTS.viewsPerHour * _normalize(v._vph,         vphArr);

      var result = Object.assign({}, v, { viralScore: Math.round(score * 100) });
      delete result._shareRate; delete result._commentRate; delete result._views; delete result._vph;
      return result;
    });
  })() : [];

  /* Videos without stats get viralScore = null */
  var nulled = noStats.map(function(v) { return Object.assign({}, v, { viralScore: null }); });

  return scored.concat(nulled);
}

function getScoreLabel(score) {
  if (score == null) return { label: '—', cls: 'badge-gray' };
  if (score >= 90)  return { label: 'Bùng nổ',    cls: 'badge-error'   };
  if (score >= 75)  return { label: 'Viral mạnh', cls: 'badge-warning' };
  if (score >= 60)  return { label: 'Đang trend', cls: 'badge-info'    };
  return               { label: 'Tham khảo',  cls: 'badge-gray'    };
}

function getWhyViral(v) {
  if (!v || !v.statsAvailable) return null;
  var views       = v.views       || 0;
  var shares      = v.shares      || 0;
  var comments    = v.comments    || 0;
  var vph         = v.viewsPerHour || 0;
  var shareRate   = views > 0 ? shares   / views : 0;
  var commentRate = views > 0 ? comments / views : 0;
  var hoursOld    = v.postedAt ? (Date.now() - new Date(v.postedAt).getTime()) / 3600000 : null;
  var isRecent    = hoursOld != null && hoursOld < 72;

  if (shareRate > 0.05)                        return 'Share rate cao – lan truyền nhanh';
  if (isRecent && vph > 50000)                 return 'Tốc độ viral cực nhanh trong 72h đầu';
  if (commentRate > 0.03)                      return 'Tương tác bình luận rất cao';
  if (vph > 20000)                             return 'Tăng trưởng views theo giờ ổn định';
  if (views > 5000000)                         return 'Đạt hàng triệu lượt xem';
  if (isRecent && views > 500000)              return 'Nội dung mới bùng nổ nhanh';
  if (commentRate > 0.01 && shareRate > 0.01)  return 'Kết hợp share & bình luận cao';
  if (views > 1000000)                         return 'Nội dung có tầm phủ rộng';
  return null;
}
