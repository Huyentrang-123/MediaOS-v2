'use strict';

const express = require('express');
const search  = require('../services/search');

const router = express.Router();

const VALID_PLATFORMS = ['tiktok', 'facebook'];
const VALID_REGIONS   = ['global', 'vn', 'kr', 'cn', 'tw'];

/*
 * GET /api/research?keyword=serum+nám&platform=tiktok&region=vn
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

    const results = await search.search({ keyword: keyword.trim(), platform, region });
    res.json({ ok: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
