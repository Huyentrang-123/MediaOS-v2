'use strict';

const config = require('../config');

async function fetchJson(url, options = {}) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.tikhub.apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tikhub ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/*
 * Search TikTok videos by keyword.
 * Endpoint: GET /api/v1/tiktok/web/fetch_search_video
 * Docs:     https://api.tikhub.io/#/TikTok-Web-API/fetch_search_video_...
 */
async function searchVideos({ keyword, region = 'global', count = 30, offset = 0 }) {
  if (!config.tikhub.apiKey) {
    throw new Error('TIKHUB_API_KEY is not configured. Add it to backend/.env');
  }

  const params = new URLSearchParams({
    keyword,
    count:  String(count),
    offset: String(offset)
  });

  const url = `${config.tikhub.baseUrl}/api/v1/tiktok/web/fetch_search_video?${params}`;
  console.log('[TikHub] GET', url.replace(config.tikhub.apiKey, '***'));

  const data = await fetchJson(url);

  /* TikHub web search: items at data.data.item_list (primary) or fallbacks */
  const items = data?.data?.item_list
    || data?.data?.data
    || data?.data?.video_list
    || [];

  console.log(`[TikHub] raw items: ${items.length}`);

  return items.map(v => normalizeVideo(v, region)).filter(Boolean);
}

/* Extract thumbnail URL — cover can be a string or {url_list: [...]} object */
function coverUrl(raw) {
  const c = raw?.cover || raw?.dynamic_cover || raw?.origin_cover;
  if (!c) return '';
  if (typeof c === 'string') return c;
  return c.url_list?.[0] || '';
}

/*
 * Normalize a raw TikHub web-search item to MediaOS standard format.
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

    /* Region: prefer what the API reports, fall back to the requested region */
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
  } catch {
    return null;
  }
}

module.exports = { searchVideos };
