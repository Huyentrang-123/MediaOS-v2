'use strict';

const config = require('../config');

const W = config.scoreWeights;

function normalize(val, arr) {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  if (max === min) return 1;
  return (val - min) / (max - min);
}

/*
 * Score all videos in a batch (min-max normalization within the batch).
 * Phase 1: no historical snapshots — scores based on engagement rates and reach.
 * Returns the same array with `viralScore` (0–100) and `growthRate: null` added.
 */
async function scoreVideos(videos) {
  if (!videos.length) return [];

  /* Derive engagement rates + carry viewsPerHour as a minor recency signal */
  const withRates = videos.map(v => ({
    ...v,
    growthRate:  null,
    shareRate:   v.views > 0 ? v.shares   / v.views : 0,
    commentRate: v.views > 0 ? v.comments / v.views : 0,
    viewsPerHour: v.viewsPerHour || 0
  }));

  /* Build arrays for normalization */
  const shareRates     = withRates.map(v => v.shareRate);
  const commentRates   = withRates.map(v => v.commentRate);
  const viewCounts     = withRates.map(v => v.views);
  const viewsPerHourArr = withRates.map(v => v.viewsPerHour);

  return withRates.map(v => {
    const score =
      W.shareRate    * normalize(v.shareRate,    shareRates)     +
      W.commentRate  * normalize(v.commentRate,  commentRates)   +
      W.views        * normalize(v.views,        viewCounts)     +
      W.viewsPerHour * normalize(v.viewsPerHour, viewsPerHourArr);

    return {
      ...v,
      viralScore: Math.round(score * 100)
    };
  });
}

function getScoreLabel(score) {
  if (score >= 85) return { label: 'Bùng nổ',    cls: 'badge-error' };
  if (score >= 65) return { label: 'Viral mạnh', cls: 'badge-warning' };
  if (score >= 40) return { label: 'Đang trend', cls: 'badge-info' };
  return               { label: 'Tăng trưởng', cls: 'badge-gray' };
}

function getWhyViral(v) {
  if (!v.statsAvailable) return null;

  const views        = v.views        || 0;
  const shares       = v.shares       || 0;
  const comments     = v.comments     || 0;
  const viewsPerHour = v.viewsPerHour || 0;
  const shareRate    = views > 0 ? shares   / views : 0;
  const commentRate  = views > 0 ? comments / views : 0;

  const hoursOld = v.postedAt
    ? (Date.now() - new Date(v.postedAt).getTime()) / 3_600_000
    : null;
  const isRecent = hoursOld != null && hoursOld < 72;

  if (shareRate > 0.05)                            return 'Share rate cao – lan truyền nhanh';
  if (isRecent && viewsPerHour > 50_000)           return 'Tốc độ viral cực nhanh trong 72h đầu';
  if (commentRate > 0.03)                          return 'Tương tác bình luận rất cao';
  if (viewsPerHour > 20_000)                       return 'Tăng trưởng views theo giờ ổn định';
  if (views > 5_000_000)                           return 'Đạt hàng triệu lượt xem';
  if (isRecent && views > 500_000)                 return 'Nội dung mới bùng nổ nhanh';
  if (commentRate > 0.01 && shareRate > 0.01)      return 'Kết hợp share & bình luận cao';
  if (views > 1_000_000)                           return 'Nội dung có tầm phủ rộng';
  return null;
}

module.exports = { scoreVideos, getScoreLabel, getWhyViral };
