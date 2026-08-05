'use strict';

const config = require('../config');

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
  if (/^Douyin 5\d\d:/.test(err.message))       return true;
  return false;
}

/*
 * One HTTP attempt. Same stream-accumulation pattern as the TikTok connector
 * to survive mid-stream TCP closes from TikHub.
 */
async function fetchOnce(url, headers, { attempt = 1, timeoutMs = 90_000 } = {}) {
  const tag = `[Douyin] attempt=${attempt}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
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
      const err = new Error(`Douyin ${response.status}: ${text.slice(0, 300)}`);
      if (response.status === 402) err.code = 'TIKHUB_QUOTA_EXCEEDED';
      throw err;
    }

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.log(`${tag}   JSON parse failed length=${text.length}`);
      console.log(`${tag}   Full body: ${text}`);
      throw new Error(`Douyin response is not valid JSON: ${parseErr.message}`);
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
 * Search Douyin videos by keyword via TikHub.
 *
 * Endpoint: GET /api/v1/douyin/app/v3/fetch_video_search_result_v2
 * This is the stable v2 endpoint (0.01$/request, better reliability).
 * Params: keyword, sort_type, publish_time, filter_duration, page, search_id
 */
async function searchVideos({ keyword, offset = 0 }) {
  if (!config.tikhub.apiKey) {
    throw new Error('TIKHUB_API_KEY is not configured. Add it to backend/.env');
  }

  const headers = {
    'Authorization': `Bearer ${config.tikhub.apiKey}`,
    'Content-Type':  'application/json',
  };

  const pageInt = Math.floor(offset / 10) + 1;
  const page    = String(pageInt);
  const qp = {
    keyword,
    sort_type:       '0',
    publish_time:    '0',
    filter_duration: '0',
    page
  };

  const params = new URLSearchParams(qp);
  const url = `${config.tikhub.baseUrl}/api/v1/douyin/app/v3/fetch_video_search_result_v2?${params}`;

  console.log(`[Douyin]   keyword="${keyword}" page=${page}`);

  const maxAttempts = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fetchOnce(url, headers, { attempt, timeoutMs: 90_000 });
      return extractVideos(data, pageInt);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isRetryable(err)) {
        console.warn(`[Douyin] attempt=${attempt} retrying in 2s — ${err.message}`);
        await sleep(2_000);
        continue;
      }
      break;
    }
  }

  if (isRetryable(lastErr)) {
    const err = new Error('Douyin hiện không phản hồi ổn định. Hãy thử lại hoặc chọn khu vực khác.');
    err.code = 'DOUYIN_UNAVAILABLE';
    throw err;
  }
  throw lastErr;
}

/* Returns { videos, hasMore, nextOffset }. page is 1-based. */
function extractVideos(data, page = 1) {
  console.log('[Douyin]   Top-level keys:', Object.keys(data || {}));
  if (data?.data) console.log('[Douyin]   data.* keys:', Object.keys(data.data));

  let items = null;
  let itemsPath = null;
  if (Array.isArray(data?.data?.search_item_list)) { items = data.data.search_item_list; itemsPath = 'data.data.search_item_list'; }
  else if (Array.isArray(data?.data?.item_list))   { items = data.data.item_list;         itemsPath = 'data.data.item_list'; }
  else if (Array.isArray(data?.data?.data))        { items = data.data.data;              itemsPath = 'data.data.data'; }
  else if (Array.isArray(data?.data?.video_list))  { items = data.data.video_list;        itemsPath = 'data.data.video_list'; }
  else if (Array.isArray(data?.data))              { items = data.data;                   itemsPath = 'data.data (direct array)'; }
  else                                             { items = [];                          itemsPath = 'none found'; }

  console.log(`[Douyin]   Array path: ${itemsPath}, length: ${items.length}`);

  const hasMore    = data?.data?.has_more === 1 || data?.data?.has_more === true;
  const nextOffset = hasMore ? page * 10 : null;

  if (items.length === 0) {
    console.log('[Douyin]   EMPTY — full parsed response:', JSON.stringify(data));
  } else {
    const first = items[0]?.aweme_info || items[0];
    console.log('[Douyin]   First item wrapper keys:', Object.keys(items[0]));
    console.log('[Douyin]   First aweme_info:', JSON.stringify(first));
  }

  const videos = items.map(v => normalizeVideo(v)).filter(Boolean);
  console.log(`[Douyin]   After normalizeVideo: ${videos.length}/${items.length} hasMore=${hasMore} nextOffset=${nextOffset}`);
  return { videos, hasMore, nextOffset };
}

function coverUrl(videoInfo) {
  const c = videoInfo?.cover || videoInfo?.dynamic_cover || videoInfo?.origin_cover;
  if (!c) return '';
  if (typeof c === 'string') return c;
  return c.url_list?.[0] || '';
}

function normalizeVideo(item) {
  try {
    const v = item?.aweme_info || item;
    const stats     = v.statistics || v.stats || {};
    const author    = v.author || {};
    const videoInfo = v.video || {};

    const views    = parseInt(stats.play_count    || stats.playCount    || 0, 10);
    const comments = parseInt(stats.comment_count || stats.commentCount || 0, 10);
    const shares   = parseInt(stats.share_count   || stats.shareCount   || 0, 10);
    const likes    = parseInt(stats.digg_count    || stats.diggCount    || stats.like_count || 0, 10);

    const videoId = v.aweme_id || v.id || '';
    if (!videoId) return null;

    const postedAt = v.create_time
      ? new Date(v.create_time * 1000).toISOString()
      : null;

    const hoursOld     = postedAt
      ? Math.max(1, (Date.now() - new Date(postedAt).getTime()) / 3_600_000)
      : null;
    const viewsPerHour = (hoursOld && views) ? views / hoursOld : null;

    return {
      id:            `douyin:${videoId}`,
      platform:      'douyin',
      video_id:      videoId,
      url:           `https://www.douyin.com/video/${videoId}`,
      thumbnail:     coverUrl(videoInfo),
      caption:       v.desc || '',
      creator:       author.nickname || author.unique_id || '',
      creatorHandle: author.unique_id ? `@${author.unique_id}` : '',
      region:        'cn',
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
    console.warn('[Douyin] normalizeVideo error:', err.message);
    return null;
  }
}

module.exports = { searchVideos };
