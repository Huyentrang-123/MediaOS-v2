'use strict';

const config = require('../config');

/*
 * Frontend region ID → TikHub uppercase ISO-3166-1 alpha-2 code.
 * 'global' is intentionally absent: omitting the param means worldwide search.
 * Never send lowercase codes (vn/kr/cn/tw) or display labels to TikHub.
 */
const REGION_MAP = {
  vn: 'VN',   /* Việt Nam   */
  kr: 'KR',   /* Hàn Quốc   */
  cn: 'CN',   /* Trung Quốc */
  tw: 'TW'    /* Đài Loan   */
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(err) {
  if (!err) return false;
  if (err.name === 'SocketError')               return true;
  if (err.cause?.code === 'UND_ERR_SOCKET')     return true;
  if (err.message?.includes('terminated'))      return true;
  if (err.message?.includes('other side closed')) return true;
  if (err.message?.includes('premature close')) return true;
  if (/^TikHub 5\d\d:/.test(err.message))       return true;
  return false;
}

/*
 * One HTTP attempt. No internal retry — callers own the retry loop.
 * Logs: region, attempt, status, bytes received, error code.
 * Never logs the API key.
 */
async function fetchOnce(url, headers, { region = null, attempt = 1, timeoutMs = 60_000 } = {}) {
  const tag = `[TikHub] region=${region || 'global'} attempt=${attempt}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });

    /* Read body as a stream — response.text() throws UND_ERR_SOCKET when TikHub
       closes the TCP connection before the body is fully delivered. */
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      totalBytes += buf.length;
    }

    const text = Buffer.concat(chunks).toString('utf-8');
    console.log(`${tag} ← ${response.status} ${response.statusText} bytes=${totalBytes}`);
    console.log(`${tag}   Body (first 500): ${text.slice(0, 500)}`);

    if (!response.ok) {
      throw new Error(`TikHub ${response.status}: ${text.slice(0, 300)}`);
    }

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.log(`${tag}   JSON parse failed length=${text.length} content-type=${response.headers.get('content-type')}`);
      console.log(`${tag}   Full body: ${text}`);
      throw new Error(`TikHub response is not valid JSON: ${parseErr.message}`);
    }
  } catch (err) {
    const code = err.cause?.code || err.name || 'unknown';
    console.log(`${tag} ERROR ${err.message} (${code})`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/*
 * Search TikTok videos by keyword.
 *
 * Endpoint: GET /api/v1/tiktok/app/v3/fetch_video_search_result
 * Note: /api/v1/tiktok/web/fetch_search_video returns HTTP 400 unconditionally (known TikHub bug).
 *
 * Regional requests use count=10 and a 90s timeout to reduce mid-stream close risk.
 * When all retries fail for a regional request, throws with code='TIKHUB_REGIONAL_UNAVAILABLE'.
 */
async function searchVideos({ keyword, region = 'global', offset = 0 }) {
  if (!config.tikhub.apiKey) {
    throw new Error('TIKHUB_API_KEY is not configured. Add it to backend/.env');
  }

  /* Resolve region: only append if we have an explicit TikHub code */
  const regionCode  = REGION_MAP[region] || null;
  const isRegional  = !!regionCode;

  /* Regional: smaller payload + longer timeout to survive TikHub's unstable stream */
  const count       = isRegional ? 10 : 20;
  const timeoutMs   = isRegional ? 90_000 : 60_000;
  const maxAttempts = isRegional ? 3 : 2;   /* 3 total (2 retries) for regional */

  const headers = {
    'Authorization': `Bearer ${config.tikhub.apiKey}`,
    'Content-Type':  'application/json',
  };

  const qp = {
    keyword,
    count:        String(count),
    offset:       String(offset),
    sort_type:    '0',
    publish_time: '0'
  };
  if (regionCode) qp.region = regionCode;

  const params = new URLSearchParams(qp);
  const url = `${config.tikhub.baseUrl}/api/v1/tiktok/app/v3/fetch_video_search_result?${params}`;

  console.log(`[TikHub]   Region: frontend="${region}" → TikHub ${regionCode ? `region=${regionCode}` : '(omitted — global)'}`);
  console.log('[TikHub]   Final URL:', url);

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fetchOnce(url, headers, { region: regionCode, attempt, timeoutMs });
      return extractVideos(data, region);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isRetryable(err)) {
        console.warn(`[TikHub] region=${regionCode || 'global'} attempt=${attempt} retrying in 2s — ${err.message}`);
        await sleep(2_000);
        continue;
      }
      break;
    }
  }

  /* All attempts exhausted — surface a friendly error for regional failures */
  if (isRegional && isRetryable(lastErr)) {
    const err = new Error('TikHub hiện chưa phản hồi ổn định khi lọc theo khu vực. Hãy thử lại hoặc chọn Toàn cầu.');
    err.code = 'TIKHUB_REGIONAL_UNAVAILABLE';
    throw err;
  }
  throw lastErr;
}

/*
 * Extract and normalise the video list from a TikHub app/v3 search response.
 *
 * App V3 shape: { code: 200, data: { search_item_list: [...], has_more, cursor } }
 * Each entry: { aweme_info: {...}, search_aweme_info: {...} }
 */
function extractVideos(data, region) {
  console.log('[TikHub]   Top-level keys:', Object.keys(data || {}));
  if (data?.data) console.log('[TikHub]   data.* keys:', Object.keys(data.data));

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
    console.log('[TikHub]   EMPTY — full parsed response:', JSON.stringify(data));
  } else {
    const firstAweme = items[0]?.aweme_info || items[0];
    console.log('[TikHub]   First item wrapper keys:', Object.keys(items[0]));
    console.log('[TikHub]   First aweme_info:', JSON.stringify(firstAweme));
  }

  const normalized = items.map(v => normalizeVideo(v, region)).filter(Boolean);
  console.log(`[TikHub]   After normalizeVideo: ${normalized.length}/${items.length}`);
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
 * Normalize one search_item_list entry to MediaOS standard format.
 *
 * Each entry is { aweme_info: {...}, search_aweme_info: {...} }.
 * All video data lives inside aweme_info.
 * Statistics may be absent — do NOT filter on views; let scoring decide.
 */
function normalizeVideo(item, requestedRegion) {
  try {
    /* Unwrap the container — fall back to the item itself for schema variants */
    const v = item?.aweme_info || item;

    const stats     = v.statistics || v.stats || {};
    const author    = v.author || {};
    const videoInfo = v.video || {};

    const views    = parseInt(stats.play_count    || stats.playCount    || 0, 10);
    const comments = parseInt(stats.comment_count || stats.commentCount || 0, 10);
    const shares   = parseInt(stats.share_count   || stats.shareCount   || 0, 10);
    const likes    = parseInt(stats.digg_count    || stats.diggCount    || stats.like_count || 0, 10);

    const videoId  = v.aweme_id || v.id || '';
    if (!videoId) return null;

    const postedAt = v.create_time
      ? new Date(v.create_time * 1000).toISOString()
      : null;

    /* Average views per hour since posting — NOT recent growth, just a time-adjusted reach signal */
    const hoursOld     = postedAt
      ? Math.max(1, (Date.now() - new Date(postedAt).getTime()) / 3_600_000)
      : null;
    const viewsPerHour = (hoursOld && views) ? views / hoursOld : null;

    /* Region: prefer what the API reports; fall back to the requested region */
    const region = (author.region || v.region || '').toLowerCase() || requestedRegion;

    return {
      id:            `tiktok:${videoId}`,
      platform:      'tiktok',
      video_id:      videoId,
      url:           `https://www.tiktok.com/@${author.unique_id}/video/${videoId}`,
      thumbnail:     coverUrl(videoInfo),
      caption:       v.desc || '',
      creator:       author.nickname || author.unique_id || '',
      creatorHandle: author.unique_id ? `@${author.unique_id}` : '',
      region,
      postedAt,
      views,
      comments,
      shares,
      likes,
      hashtags:      (v.text_extra || [])
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
