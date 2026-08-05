'use strict';

const express = require('express');
const config  = require('../config');
const router  = express.Router();

/* Allowed host suffixes for URL validation */
const ALLOWED_HOSTS = [
  'tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'm.tiktok.com',
  'douyin.com',
  'v.douyin.com',
  'facebook.com',
  'fb.watch'
];

/* TikTok public oEmbed endpoint (no auth required) */
const TIKTOK_OEMBED = 'https://www.tiktok.com/oembed';

/* Facebook oEmbed endpoint (requires app token) */
const FB_OEMBED     = 'https://graph.facebook.com/v18.0/oembed_video';

function validateUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

router.get('/', async (req, res) => {
  const { url, platform } = req.query;

  if (!url || !validateUrl(url)) {
    return res.status(400).json({ error: 'Invalid or unsupported URL' });
  }

  try {
    if (platform === 'tiktok' || platform === 'douyin') {
      /* TikTok public oEmbed — no auth, CORS-safe via backend */
      const endpoint = TIKTOK_OEMBED + '?url=' + encodeURIComponent(url);
      const resp     = await fetch(endpoint, {
        headers: { 'User-Agent': 'MediaOS/2.0 (+https://github.com)' }
      });

      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'oEmbed fetch failed', status: resp.status });
      }

      const data = await resp.json();
      return res.json({
        title:         data.title         || '',
        author_name:   data.author_name   || '',
        thumbnail_url: data.thumbnail_url || ''
      });
    }

    if (platform === 'facebook') {
      const token = config.facebookAppToken;
      if (!token) {
        return res.status(200).json({ title: '', author_name: '', thumbnail_url: '' });
      }

      const endpoint = FB_OEMBED
        + '?url='          + encodeURIComponent(url)
        + '&access_token=' + encodeURIComponent(token);

      const resp = await fetch(endpoint, {
        headers: { 'User-Agent': 'MediaOS/2.0' }
      });

      if (!resp.ok) {
        return res.status(resp.status).json({ error: 'oEmbed fetch failed', status: resp.status });
      }

      const data = await resp.json();
      return res.json({
        title:         data.title         || '',
        author_name:   data.author_name   || '',
        thumbnail_url: data.thumbnail_url || ''
      });
    }

    return res.status(400).json({ error: 'Unsupported platform: ' + platform });
  } catch (err) {
    console.error('[oEmbed] error:', err.message);
    return res.status(502).json({ error: 'oEmbed proxy error: ' + err.message });
  }
});

module.exports = router;
