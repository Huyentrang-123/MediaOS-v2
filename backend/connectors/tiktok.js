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
  const headers = {
    'Authorization': `Bearer ${config.tikhub.apiKey}`,
    'Content-Type':  'application/json',
    ...(options.headers || {})
  };

  console.log('[TikHub] →', options.method || 'GET', url);
  console.log('[TikHub]   Headers:', JSON.stringify({
    Authorization: '[REDACTED]',
    'Content-Type': headers['Content-Type']
  }));

  /* Retry once on socket/stream errors — TikHub closes mid-stream intermittently */
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });

      console.log(`[TikHub] ← ${response.status} ${response.statusText} (attempt ${attempt})`);
      console.log('[TikHub]   Response headers:', JSON.stringify({
        'content-type':   response.headers.get('content-type'),
        'content-length': response.headers.get('content-length')
      }));

      /* Read body as a stream, concatenating Uint8Array chunks into a Buffer.
         response.text() / response.json() throw UND_ERR_SOCKET when TikHub
         closes the TCP connection before the body is fully delivered. */
      const chunks = [];
      let totalBytes = 0;
      for await (const chunk of response.body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buf);
        totalBytes += buf.length;
      }

      const text = Buffer.concat(chunks).toString('utf-8');
      console.log(`[TikHub]   Bytes received: ${totalBytes}`);
      console.log('[TikHub]   Body (first 500):', text.slice(0, 500));

      if (!response.ok) {
        throw new Error(`TikHub ${response.status}: ${text.slice(0, 300)}`);
      }

      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.log('[TikHub]   JSON parse failed — length:', text.length,
          'content-type:', response.headers.get('content-type'));
        console.log('[TikHub]   Full body:', text);
        throw new Error(`TikHub response is not valid JSON: ${parseErr.message}`);
      }
    } catch (err) {
      clearTimeout(timer);

      const isStreamError =
        err.name === 'SocketError'                          ||
        err.cause?.code === 'UND_ERR_SOCKET'               ||
        err.message?.includes('terminated')                ||
        err.message?.includes('other side closed');

      if (attempt < 2 && isStreamError) {
        console.warn(`[TikHub]   Stream closed early (attempt ${attempt}), retrying — ${err.message}`);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
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
async function searchVideos({ keyword, region = 'global', count = 20, offset = 0 }) {
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

  /* Log top-level keys so we know the real shape even if body was truncated */
  console.log('[TikHub]   Top-level keys:', Object.keys(data || {}));
  if (data?.data) {
    console.log('[TikHub]   data.* keys:', Object.keys(data.data));
  }

  /*
   * App V3 search response shape:
   *   { code: 200, data: { search_item_list: [...], has_more: bool, cursor: N } }
   * Fallbacks for schema variations observed in the wild.
   */
  let items = null;
  let itemsPath = null;
  if (Array.isArray(data?.data?.search_item_list)) { items = data.data.search_item_list; itemsPath = 'data.data.search_item_list'; }
  else if (Array.isArray(data?.data?.item_list))   { items = data.data.item_list;         itemsPath = 'data.data.item_list'; }
  else if (Array.isArray(data?.data?.data))        { items = data.data.data;              itemsPath = 'data.data.data'; }
  else if (Array.isArray(data?.data?.video_list))  { items = data.data.video_list;        itemsPath = 'data.data.video_list'; }
  else if (Array.isArray(data?.data))              { items = data.data;                   itemsPath = 'data.data (direct array)'; }
  else                                             { items = [];                          itemsPath = 'none found'; }

  console.log(`[TikHub]   Array path used: ${itemsPath}, length: ${items.length}`);

  if (items.length === 0) {
    /* Log the whole response so we can find the real array */
    console.log('[TikHub]   EMPTY — full parsed response:', JSON.stringify(data));
  } else {
    /* Log field names of first item to verify normalizeVideo can read them */
    console.log('[TikHub]   First item keys:', Object.keys(items[0]));
    const s = items[0].statistics || items[0].stats || {};
    console.log('[TikHub]   First item stats keys:', Object.keys(s));
    console.log('[TikHub]   First item stats sample:', JSON.stringify(s));
  }

  const normalized = items.map(v => normalizeVideo(v, region)).filter(Boolean);
  console.log(`[TikHub]   After normalizeVideo (views > 0 filter): ${normalized.length}/${items.length}`);

  return normalized;
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
