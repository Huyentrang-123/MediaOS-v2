'use strict';

const config = require('../config');

/* MediaOS region codes → TikHub region codes */
const REGION_MAP = {
  vn: 'VN',
  kr: 'KR',
  cn: 'CN',
  tw: 'TW'
  /* 'global' is intentionally absent — omit region param to search globally */
};

async function fetchJson(url, options = {}) {
  const { default: fetch } = await import('node-fetch');

  const headers = {
    'Authorization': `Bearer ${config.tikhub.apiKey}`,
    'Content-Type':  'application/json',
    ...(options.headers || {})
  };

  /* Full request log (key masked) */
  console.log('[TikHub] →', options.method || 'GET', url);
  console.log('[TikHub]   Headers:', JSON.stringify({
    ...headers,
    Authorization: 'Bearer ***'
  }));

  const res = await fetch(url, { ...options, headers });

  /* Full response log */
  const body = await res.text();
  console.log(`[TikHub] ← ${res.status} ${res.statusText}`);
  console.log('[TikHub]   Body:', body.slice(0, 500));

  if (!res.ok) {
    throw new Error(`TikHub ${res.status}: ${body.slice(0, 300)}`);
  }

  return JSON.parse(body);
}

/*
 * Search TikTok videos by keyword.
 *
 * Endpoint: GET /api/v1/tiktok/app/v3/fetch_video_search_result
 * Note: /api/v1/tiktok/web/fetch_search_video returns HTTP 400 unconditionally (known TikHub bug).
 *
 * Parameters:
 *   keyword      (required)  — search term
 *   count        (optional)  — results per page, default 20
 *   offset       (optional)  — pagination offset, default 0
 *   sort_type    (optional)  — 0 relevance (default), 1 most liked, 2 newest
 *   publish_time (optional)  — 0 all time (default)
 *   region       (optional)  — region code (VN/KR/CN/TW); omit for global
 */
async function searchVideos({ keyword, region = 'global', count = 30, offset = 0 }) {
  if (!config.tikhub.apiKey) {
    throw new Error('TIKHUB_API_KEY is not configured. Add it to backend/.env');
  }

  const qp = {
    keyword,
    count:        String(count),
    offset:       String(offset),
    sort_type:    '0',
    publish_time: '0'
  };

  const regionCode = REGION_MAP[region];
  if (regionCode) qp.region = regionCode;

  const params = new URLSearchParams(qp);
  const url = `${config.tikhub.baseUrl}/api/v1/tiktok/app/v3/fetch_video_search_result?${params}`;

  console.log('[TikHub]   Query params:', JSON.stringify(qp));

  const data = await fetchJson(url);

  /*
   * App V3 search response shape:
   *   { code: 200, data: { search_item_list: [...], has_more: bool, cursor: N } }
   * Fallbacks for schema variations observed in the wild.
   */
  const items =
    data?.data?.search_item_list ||
    data?.data?.item_list         ||
    data?.data?.data              ||
    data?.data?.video_list        ||
    [];

  console.log(`[TikHub]   Parsed items: ${items.length}`);

  return items.map(v => normalizeVideo(v, region)).filter(Boolean);
}

/* Extract thumbnail — cover can be a string or { url_list: [...] } */
function coverUrl(videoInfo) {
  const c = videoInfo?.cover || videoInfo?.dynamic_cover || videoInfo?.origin_cover;
  if (!c) return '';
  if (typeof c === 'string') return c;
  return c.url_list?.[0] || '';
}

/*
 * Normalize a raw TikHub app/v3 video item to MediaOS standard format.
 */
function normalizeVideo(raw, requestedRegion) {
  try {
    const stats     = raw.statistics || raw.stats || {};
    const author    = raw.author || {};
    const videoInfo = raw.video || {};

    const views    = parseInt(stats.play_count    || stats.playCount    || 0, 10);
    const comments = parseInt(stats.comment_count || stats.commentCount || 0, 10);
    const shares   = parseInt(stats.share_count   || stats.shareCount   || 0, 10);
    const likes    = parseInt(stats.digg_count    || stats.diggCount    || stats.like_count || 0, 10);

    /* Skip videos with no views (deleted / private) */
    if (!views) return null;

    const videoId  = raw.aweme_id || raw.id || '';
    const postedAt = raw.create_time
      ? new Date(raw.create_time * 1000).toISOString()
      : null;

    /* Average views per hour since posting — NOT recent growth, just a time-adjusted reach signal */
    const hoursOld     = postedAt
      ? Math.max(1, (Date.now() - new Date(postedAt).getTime()) / 3_600_000)
      : null;
    const viewsPerHour = hoursOld ? views / hoursOld : null;

    /* Region: prefer what the API reports; fall back to the requested region */
    const region = (author.region || raw.region || '').toLowerCase() || requestedRegion;

    return {
      id:            `tiktok:${videoId}`,
      platform:      'tiktok',
      video_id:      videoId,
      url:           `https://www.tiktok.com/@${author.unique_id}/video/${videoId}`,
      thumbnail:     coverUrl(videoInfo),
      caption:       raw.desc || '',
      creator:       author.nickname || author.unique_id || '',
      creatorHandle: author.unique_id ? `@${author.unique_id}` : '',
      region,
      postedAt,
      views,
      comments,
      shares,
      likes,
      hashtags:      (raw.text_extra || [])
                       .filter(t => t.hashtag_name)
                       .map(t => t.hashtag_name),
      viewsPerHour
    };
  } catch (err) {
    console.warn('[TikHub] normalizeVideo error:', err.message);
    return null;
  }
}

module.exports = { searchVideos };
