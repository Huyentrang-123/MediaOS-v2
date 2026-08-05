'use strict';

const config = require('../config');

const NAME = 'tikhub-tiktok';

/* Frontend market ID → TikHub uppercase region code */
const REGION_MAP = { vn: 'VN', kr: 'KR', cn: 'CN', tw: 'TW' };

function isActive() { return !!config.tikhub.apiKey; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isRetryable(err) {
  if (!err) return false;
  return err.name === 'SocketError'
    || err.cause?.code === 'UND_ERR_SOCKET'
    || /terminated|other side closed|premature close/.test(err.message || '')
    || /^TikHub 5\d\d:/.test(err.message || '');
}

async function fetchOnce(url, headers, { region = null, attempt = 1, timeoutMs = 60_000 } = {}) {
  const tag = `[TikHub/TikTok] region=${region || 'global'} attempt=${attempt}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const chunks = [];
    for await (const chunk of res.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString('utf-8');
    console.log(`${tag} ← ${res.status} bytes=${text.length}`);
    if (!res.ok) {
      const err = new Error(`TikHub ${res.status}: ${text.slice(0, 300)}`);
      if (res.status === 402) err.code = 'TIKHUB_QUOTA_EXCEEDED';
      throw err;
    }
    return JSON.parse(text);
  } catch (err) {
    console.log(`${tag} ERROR ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function search({ query, market = 'global', offset = 0 }) {
  const regionCode  = REGION_MAP[market] || null;
  const isRegional  = !!regionCode;
  const count       = isRegional ? 10 : 20;
  const timeoutMs   = isRegional ? 90_000 : 60_000;
  const maxAttempts = isRegional ? 3 : 2;

  const headers = {
    'Authorization': `Bearer ${config.tikhub.apiKey}`,
    'Content-Type':  'application/json',
  };
  const qp = { keyword: query, count: String(count), offset: String(offset), sort_type: '0', publish_time: '0' };
  if (regionCode) qp.region = regionCode;
  const url = `${config.tikhub.baseUrl}/api/v1/tiktok/app/v3/fetch_video_search_result?${new URLSearchParams(qp)}`;
  console.log(`[TikHub/TikTok] query="${query}" market=${market} offset=${offset}`);

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fetchOnce(url, headers, { region: regionCode, attempt, timeoutMs });
      return extractVideos(data, market, offset);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isRetryable(err)) { await sleep(2_000); continue; }
      break;
    }
  }

  if (isRegional && isRetryable(lastErr)) {
    const err = new Error('TikHub chưa phản hồi ổn định khi lọc theo khu vực. Hãy thử Toàn cầu.');
    err.code = 'TIKHUB_REGIONAL_UNAVAILABLE';
    throw err;
  }
  throw lastErr;
}

function extractVideos(data, market, requestedOffset = 0) {
  let items = [];
  if (Array.isArray(data?.data?.search_item_list)) items = data.data.search_item_list;
  else if (Array.isArray(data?.data?.item_list))   items = data.data.item_list;
  else if (Array.isArray(data?.data?.data))        items = data.data.data;
  else if (Array.isArray(data?.data))              items = data.data;

  const hasMore    = data?.data?.has_more === 1 || data?.data?.has_more === true;
  const rawCursor  = data?.data?.cursor ?? null;
  const nextOffset = hasMore ? (rawCursor != null ? Number(rawCursor) : requestedOffset + items.length) : null;

  const videos = items.map(v => normalizeVideo(v, market)).filter(Boolean);
  console.log(`[TikHub/TikTok] normalized=${videos.length}/${items.length} hasMore=${hasMore}`);
  return { videos, hasMore, nextOffset };
}

function coverUrl(videoInfo) {
  const c = videoInfo?.cover || videoInfo?.dynamic_cover || videoInfo?.origin_cover;
  if (!c) return '';
  return typeof c === 'string' ? c : (c.url_list?.[0] || '');
}

function normalizeVideo(item, market) {
  try {
    const v      = item?.aweme_info || item;
    const stats  = v.statistics || v.stats || {};
    const author = v.author || {};
    const vi     = v.video  || {};

    const views    = parseInt(stats.play_count    || stats.playCount    || 0, 10);
    const comments = parseInt(stats.comment_count || stats.commentCount || 0, 10);
    const shares   = parseInt(stats.share_count   || stats.shareCount   || 0, 10);
    const likes    = parseInt(stats.digg_count    || stats.diggCount    || stats.like_count || 0, 10);
    const videoId  = v.aweme_id || v.id || '';
    if (!videoId) return null;

    const postedAt     = v.create_time ? new Date(v.create_time * 1000).toISOString() : null;
    const hoursOld     = postedAt ? Math.max(1, (Date.now() - new Date(postedAt).getTime()) / 3_600_000) : null;
    const viewsPerHour = (hoursOld && views) ? views / hoursOld : null;
    const handle       = author.unique_id || '';

    return {
      id:             `tiktok:${videoId}`,
      platform:       'tiktok',
      market:         (author.region || v.region || '').toLowerCase() || market,
      url:            `https://www.tiktok.com/@${handle}/video/${videoId}`,
      thumbnail:      coverUrl(vi),
      caption:        v.desc || '',
      creator:        author.nickname || handle || '',
      creatorHandle:  handle ? `@${handle}` : '',
      postedAt,
      views,
      likes,
      comments,
      shares,
      hashtags:       (v.text_extra || []).filter(t => t.hashtag_name).map(t => t.hashtag_name),
      viewsPerHour,
      statsAvailable: true,
      sourceProvider: NAME
    };
  } catch (err) {
    console.warn('[TikHub/TikTok] normalizeVideo error:', err.message);
    return null;
  }
}

module.exports = { name: NAME, isActive, search };
