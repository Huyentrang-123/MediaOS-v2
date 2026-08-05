'use strict';

const express = require('express');
const search  = require('../services/search');

const router = express.Router();

const VALID_PLATFORMS = ['tiktok', 'facebook'];
const VALID_REGIONS   = ['global', 'vn', 'kr', 'cn', 'tw'];

/*
 * GET /api/research?keyword=serum+nám&platform=tiktok&region=vn[&query=...&offset=0]
 * Response: { ok, count, data, fallback, hasMore, nextOffset, rawCount, returnedCount, variants }
 *   fallback=true  — no video met minViralScore; top results labeled "Kết quả tham khảo".
 *   hasMore        — whether the current query has more pages.
 *   nextOffset     — pass as `offset` on the next request to page forward.
 *   variants       — all localized query variants for this keyword+region (for "Tìm thêm gợi ý").
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      keyword  = '',
      platform = 'tiktok',
      region   = 'global',
      query    = '',
      offset   = '0'
    } = req.query;

    if (!keyword.trim()) {
      return res.status(400).json({ error: 'keyword là bắt buộc' });
    }
    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `platform không hợp lệ. Dùng: ${VALID_PLATFORMS.join(', ')}` });
    }
    if (!VALID_REGIONS.includes(region)) {
      return res.status(400).json({ error: `region không hợp lệ. Dùng: ${VALID_REGIONS.join(', ')}` });
    }

    const offsetNum = Math.max(0, parseInt(offset, 10) || 0);

    const result = await search.search({
      keyword:  keyword.trim(),
      platform,
      region,
      query:    query.trim() || undefined,
      offset:   offsetNum
    });

    const { data, fallback, hasMore, nextOffset, rawCount, returnedCount, variants } = result;

    res.json({
      ok:            true,
      count:         data.length,
      data,
      fallback:      fallback || false,
      hasMore:       hasMore  || false,
      nextOffset:    nextOffset ?? null,
      rawCount:      rawCount  || 0,
      returnedCount: returnedCount || 0,
      variants:      variants  || []
    });
  } catch (err) {
    if (err.code === 'TIKHUB_QUOTA_EXCEEDED') {
      return res.status(402).json({ error: 'TikHub đã hết số dư hoặc free credit. Hãy Check-in hoặc nạp thêm credit.' });
    }
    if (err.code === 'TIKHUB_REGIONAL_UNAVAILABLE' || err.code === 'DOUYIN_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
