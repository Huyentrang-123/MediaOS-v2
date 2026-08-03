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

module.exports = { scoreVideos, getScoreLabel };
