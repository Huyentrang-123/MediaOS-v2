'use strict';

const { marketSearch } = require('./market-search');
const viralScore       = require('./viral-score');

/*
 * Main search entry point — delegates to the market-aware orchestrator.
 * `platform` is accepted for API compatibility but ignored in Phase 1
 * (Facebook is Phase 2; CN market always routes to Douyin via market-search).
 * Returns { data: Video[], fallback: boolean }.
 */
async function search({ keyword, platform, region }) {
  const { videos, fallback } = await marketSearch({ keyword, market: region });

  const data = videos.map(v => {
    const info = viralScore.getScoreLabel(v.viralScore);
    return {
      id:            v.id,
      platform:      v.platform,
      url:           v.url,
      thumbnail:     v.thumbnail,
      caption:       v.caption,
      creator:       v.creator,
      creatorHandle: v.creatorHandle,
      region:        v.region,
      postedAt:      v.postedAt,
      stats: {
        views:      v.views,
        comments:   v.comments,
        shares:     v.shares,
        likes:      v.likes,
        growthRate: v.growthRate !== null ? `+${v.growthRate.toFixed(1)}%` : null
      },
      viral: {
        score:    v.viralScore,
        label:    info.label,
        badgeCls: info.cls
      },
      hashtags: v.hashtags || []
    };
  });

  return { data, fallback };
}

module.exports = { search };
