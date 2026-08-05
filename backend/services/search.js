'use strict';

const { marketSearch } = require('./market-search');
const { allVariants }  = require('./query-expansion');
const viralScore       = require('./viral-score');

/*
 * Main search entry point — delegates to the market-aware orchestrator.
 * `platform` is accepted for API compatibility but ignored in Phase 1.
 * `query` and `offset` support pagination and query expansion.
 * Returns { data, fallback, hasMore, nextOffset, rawCount, returnedCount, variants }.
 */
async function search({ keyword, platform, region, query, offset = 0 }) {
  const market = region;

  const { videos, fallback, hasMore, nextOffset, rawCount, returnedCount } =
    await marketSearch({ keyword, market, query, offset });

  /* All localized query variants for this keyword+market (for UI expansion buttons) */
  const variants = allVariants(keyword, market);

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
      matchedQuery:  v.matchedQuery || query || keyword,
      _reference:    v._reference || false,
      stats: {
        views:      v.views,
        comments:   v.comments,
        shares:     v.shares,
        likes:      v.likes,
        growthRate: v.growthRate != null ? `+${v.growthRate.toFixed(1)}%` : null
      },
      viral: {
        score:    v.viralScore,
        label:    info.label,
        badgeCls: info.cls
      },
      hashtags: v.hashtags || []
    };
  });

  return { data, fallback, hasMore, nextOffset, rawCount, returnedCount, variants };
}

module.exports = { search };
