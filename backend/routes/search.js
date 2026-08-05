'use strict';

const express       = require('express');
const router        = express.Router();
const sourceManager = require('../services/source-manager');
const viralScore    = require('../services/viral-score');
const qe            = require('../services/query-expansion');
const config        = require('../config');

/*
 * GET /api/search?keyword=serum+nám&market=vn&platform=all&offset=0&query=serum+nám
 *
 * Returns { ok, data[], count, hasMore, nextOffset, matchedQuery, variants }
 */
router.get('/', async (req, res) => {
  try {
    const keyword  = (req.query.keyword  || '').trim();
    const platform = (req.query.platform || 'all').trim();
    const market   = (req.query.market   || 'global').trim();
    const offset   = parseInt(req.query.offset || '0', 10) || 0;
    const query    = (req.query.query    || keyword).trim();

    if (!keyword) {
      return res.status(400).json({ ok: false, error: 'Thiếu từ khóa (keyword)' });
    }

    const { videos, hasMore, nextOffset } = await sourceManager.search({
      query, market, offset, platform
    });

    const scored = await viralScore.scoreVideos(videos);

    const data = scored
      .sort((a, b) => (b.viralScore || 0) - (a.viralScore || 0))
      .slice(0, config.maxResults)
      .map(v => {
        const info = viralScore.getScoreLabel(v.viralScore);
        return {
          ...v,
          whyViral:   viralScore.getWhyViral(v),
          scoreLabel: info.label,
          scoreBadge: info.cls
        };
      });

    const variants = qe.allVariants(keyword, market);

    return res.json({ ok: true, data, count: data.length, hasMore, nextOffset, matchedQuery: query, variants });
  } catch (err) {
    console.error('[/api/search]', err.message);
    const status = (err.code === 'YOUTUBE_QUOTA_EXCEEDED' || err.code === 'TIKHUB_QUOTA_EXCEEDED') ? 429 : 500;
    return res.status(status).json({ ok: false, error: err.message, code: err.code || null });
  }
});

module.exports = router;
