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
 * Score all videos in a batch against each other (min-max normalization).
 * Also pulls growth data from DB when available.
 *
 * Returns the same array with `viralScore` (0–100) and `growthRate` added.
 */
async function scoreVideos(videos) {
  if (!videos.length) return [];

  /* Phase 1: use velocityScore (views/hour) as growth proxy — no DB yet */
  const enriched = videos.map(v => ({
    ...v,
    growthRate:  null,
    growthProxy: v.velocityScore || 0
  }));

  /* Derive rates */
  const withRates = enriched.map(v => ({
    ...v,
    shareRate:   v.views > 0 ? v.shares   / v.views : 0,
    commentRate: v.views > 0 ? v.comments / v.views : 0
  }));

  /* Build arrays for normalization */
  const growths      = withRates.map(v => v.growthProxy);
  const shareRates   = withRates.map(v => v.shareRate);
  const commentRates = withRates.map(v => v.commentRate);
  const viewCounts   = withRates.map(v => v.views);

  return withRates.map(v => {
    const score =
      W.growth      * normalize(v.growthProxy,   growths)      +
      W.shareRate   * normalize(v.shareRate,      shareRates)   +
      W.commentRate * normalize(v.commentRate,    commentRates) +
      W.views       * normalize(v.views,          viewCounts);

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
