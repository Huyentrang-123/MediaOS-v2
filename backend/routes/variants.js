'use strict';

const express        = require('express');
const { allVariants } = require('../services/query-expansion');

const router = express.Router();

const VALID_REGIONS = ['global', 'vn', 'kr', 'cn', 'tw'];

/*
 * GET /api/variants?keyword=serum+nám&region=vn
 *
 * Free endpoint — zero cost, no external API calls.
 * Returns all localized query variants generated from the internal dictionary.
 * Used by the frontend for query suggestion chips and library search.
 */
router.get('/', (req, res) => {
  const { keyword = '', region = 'global' } = req.query;

  if (!keyword.trim()) {
    return res.status(400).json({ error: 'keyword là bắt buộc' });
  }
  if (!VALID_REGIONS.includes(region)) {
    return res.status(400).json({ error: `region không hợp lệ. Dùng: ${VALID_REGIONS.join(', ')}` });
  }

  const variants = allVariants(keyword.trim(), region);
  res.json({ ok: true, keyword: keyword.trim(), region, variants });
});

module.exports = router;
