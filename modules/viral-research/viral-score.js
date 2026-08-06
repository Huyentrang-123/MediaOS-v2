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

/* ── Research Rank: log-normalised composite score ─── */
/* Default weights: views 45%, comments 35%, likes 15%, freshness 5%.  */
/* "prioritizeComments" mode: comments 50%, views 35%, likes 10%, freshness 5%. */
/* Null fields per-video → weight redistributed to available fields.    */
/* viralScore is NOT overwritten; researchRank is a separate field.     */
function computeResearchRank(videos, prioritizeComments) {
  if (!videos || !videos.length) return videos || [];

  var W = prioritizeComments
    ? { v: 0.35, c: 0.50, l: 0.10, f: 0.05 }
    : { v: 0.45, c: 0.35, l: 0.15, f: 0.05 };

  var now = Date.now();

  var raw = videos.map(function(v) {
    var ageH  = v.postedAt ? (now - new Date(v.postedAt).getTime()) / 3600000 : null;
    var fresh = ageH != null ? Math.max(0, 168 - ageH) : null; /* 7-day freshness window */
    return {
      v: v.views    != null ? Math.log1p(v.views)    : null,
      c: v.comments != null ? Math.log1p(v.comments) : null,
      l: v.likes    != null ? Math.log1p(v.likes)    : null,
      f: fresh      != null ? Math.log1p(fresh)      : null
    };
  });

  /* Min-max normalise a field across the batch; returns array of 0–1 or null */
  function mmArr(arr, key) {
    var vals = arr.map(function(x) { return x[key]; }).filter(function(x) { return x != null; });
    if (!vals.length) return arr.map(function() { return null; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var range = max - min;
    return arr.map(function(x) {
      if (x[key] == null) return null;
      return range === 0 ? 0.5 : (x[key] - min) / range;
    });
  }

  var nv = mmArr(raw, 'v');
  var nc = mmArr(raw, 'c');
  var nl = mmArr(raw, 'l');
  var nf = mmArr(raw, 'f');

  /* Batch-level weight: zero out fields that have no data in this batch */
  var bW = {
    v: nv.some(function(x) { return x != null; }) ? W.v : 0,
    c: nc.some(function(x) { return x != null; }) ? W.c : 0,
    l: nl.some(function(x) { return x != null; }) ? W.l : 0,
    f: nf.some(function(x) { return x != null; }) ? W.f : 0
  };

  return videos.map(function(v, i) {
    /* Per-video weight: only count fields this video actually has */
    var pvW = {
      v: (bW.v > 0 && nv[i] != null) ? bW.v : 0,
      c: (bW.c > 0 && nc[i] != null) ? bW.c : 0,
      l: (bW.l > 0 && nl[i] != null) ? bW.l : 0,
      f: (bW.f > 0 && nf[i] != null) ? bW.f : 0
    };
    var pvTotal = pvW.v + pvW.c + pvW.l + pvW.f;

    if (pvTotal === 0) return Object.assign({}, v, { researchRank: null });

    var rank = 0;
    if (pvW.v > 0) rank += (pvW.v / pvTotal) * nv[i];
    if (pvW.c > 0) rank += (pvW.c / pvTotal) * nc[i];
    if (pvW.l > 0) rank += (pvW.l / pvTotal) * nl[i];
    if (pvW.f > 0) rank += (pvW.f / pvTotal) * nf[i];

    if (isNaN(rank)) rank = 0; /* guard against edge cases */
    return Object.assign({}, v, { researchRank: Math.round(rank * 100) });
  });
}
