'use strict';

const config      = require('../config');
const db          = require('../db/database');
const tiktok      = require('../connectors/tiktok');
const facebook    = require('../connectors/facebook');
const viralScore  = require('./viral-score');

const CONNECTORS = { tiktok, facebook };

/*
 * Main search entry point.
 *
 * 1. Fetch videos from the correct connector.
 * 2. Persist them + snapshot to DB.
 * 3. Score + filter.
 * 4. Return top N sorted by viralScore desc.
 */
async function search({ keyword, platform, region }) {
  const connector = CONNECTORS[platform];
  if (!connector) throw new Error(`Platform không hỗ trợ: ${platform}`);

  /* Fetch raw videos from platform */
  const raw = await connector.searchVideos({ keyword, region, count: 50 });

  /* Persist to DB for future growth tracking */
  for (const v of raw) {
    try {
      db.upsertVideo(
        {
          id:        v.id,
          platform:  v.platform,
          video_id:  v.video_id,
          region:    v.region,
          url:       v.url,
          thumbnail: v.thumbnail,
          caption:   v.caption,
          creator:   v.creator,
          posted_at: v.postedAt
        },
        {
          views:    v.views,
          comments: v.comments,
          shares:   v.shares,
          likes:    v.likes
        }
      );
    } catch { /* non-fatal */ }
  }

  /* Score */
  const scored = await viralScore.scoreVideos(raw);

  /* Filter below minimum threshold */
  const filtered = scored.filter(v => v.viralScore >= config.minViralScore);

  /* Sort by score desc, take top N */
  filtered.sort((a, b) => b.viralScore - a.viralScore);
  const results = filtered.slice(0, config.maxResults);

  /* Format response */
  return results.map(v => {
    const info = viralScore.getScoreLabel(v.viralScore);
    return {
      id:           v.id,
      platform:     v.platform,
      url:          v.url,
      thumbnail:    v.thumbnail,
      caption:      v.caption,
      creator:      v.creator,
      creatorHandle:v.creatorHandle,
      region:       v.region,
      postedAt:     v.postedAt,
      stats: {
        views:      v.views,
        comments:   v.comments,
        shares:     v.shares,
        likes:      v.likes,
        growthRate: v.growthRate !== null ? `+${v.growthRate.toFixed(1)}%` : null
      },
      viral: {
        score:      v.viralScore,
        label:      info.label,
        badgeCls:   info.cls
      },
      hashtags:     v.hashtags || []
    };
  });
}

module.exports = { search };
