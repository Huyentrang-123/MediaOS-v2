'use strict';

const express = require('express');
const search  = require('../services/search');

const router = express.Router();

const VALID_PLATFORMS = ['tiktok', 'facebook'];
const VALID_REGIONS   = ['global', 'vn', 'kr', 'cn', 'tw'];

/*
 * GET /api/research?keyword=serum+nám&platform=tiktok&region=vn
 * Response: { ok, count, data, fallback }
 *   fallback=true means no video met minViralScore; top 10 returned anyway.
 */
router.get('/', async (req, res, next) => {
  try {
    const { keyword = '', platform = 'tiktok', region = 'global' } = req.query;

    if (!keyword.trim()) {
      return res.status(400).json({ error: 'keyword là bắt buộc' });
    }
    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `platform không hợp lệ. Dùng: ${VALID_PLATFORMS.join(', ')}` });
    }
    if (!VALID_REGIONS.includes(region)) {
      return res.status(400).json({ error: `region không hợp lệ. Dùng: ${VALID_REGIONS.join(', ')}` });
    }

    const { data, fallback } = await search.search({ keyword: keyword.trim(), platform, region });
    res.json({ ok: true, count: data.length, data, fallback: fallback || false });
  } catch (err) {
    if (err.code === 'TIKHUB_REGIONAL_UNAVAILABLE' || err.code === 'DOUYIN_UNAVAILABLE') {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
